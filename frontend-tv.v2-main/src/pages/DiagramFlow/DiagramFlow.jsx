// src/pages/ChannelDiagram/DiagramFlow.jsx
import { useEffect, useState, useCallback, useMemo, useRef, useContext } from "react";
import { useParams } from "react-router-dom";
import {
  ReactFlow,
  Background,
  Controls,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  MarkerType,
  ConnectionLineType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import api from "../../utils/api";
import "./DiagramFlow.css";
import Swal from "sweetalert2";
import {
  createKeyedDebounce,
  withRetry,
  prepareOptimisticUpdate,
} from "../../utils/asyncUtils";
import ErrorBoundary from "../../components/ErrorBoundary";
import { HANDLE_CONFIG, makeHandleId, parseHandleId } from "../../config/handles.config";

// Componentes personalizados
import CustomNode from "./CustomNode";
import DraggableDirectionalEdge from "./DraggableDirectionalEdge";
import { getDirectionColor } from "./directionColors";
import { useOnlineStatus } from "../../hooks/useOnlineStatus";
import { useOfflineQueue } from "../../hooks/useOfflineQueue";
import { ConnectionBanner } from "../../components/ConnectionBanner";
import { UserContext } from "../../components/context/UserContext";

// --- Config ---
const USE_MOCK = false;

/** Cantidad máxima de handles por lado (importado de configuración centralizada) */
const MAX_HANDLES_PER_SIDE = HANDLE_CONFIG.MAX_HANDLES_PER_SIDE;

// Mapeo de imágenes por tipo inferido
const EQUIPO_TYPE_IMAGE_MAP = {
  router: "https://i.ibb.co/5WS77nQB/router.jpg",
  switch: "https://i.ibb.co/fGMRq8Fz/switch.jpg",
  ird: "https://i.ibb.co/fGM5NTcX/ird.jpg",
  titan: "https://i.ibb.co/wrJZLrqR/titan.jpg",
  satelite: "https://i.ibb.co/23VpLD2N/satelite.jpg",
  rtes: "https://i.ibb.co/VcfxF9hz/rtes.jpg",
};

const nodeTypes = { imageNode: CustomNode };
const edgeTypes = { draggableDirectional: DraggableDirectionalEdge };

const DEFAULT_NODE_TYPE = "imageNode";
const DEFAULT_EDGE_TYPE = "draggableDirectional";
const KNOWN_NODE_TYPES = new Set(Object.keys(nodeTypes));
const KNOWN_EDGE_TYPES = new Set(Object.keys(edgeTypes));
const NODE_TYPE_ALIAS = { custom: DEFAULT_NODE_TYPE };
const EDGE_TYPE_ALIAS = { customDirectional: DEFAULT_EDGE_TYPE };

/* -------------------- Helpers de normalización -------------------- */
const stripDiacritics = (value = "") =>
  String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();

const inferEquipoTipo = (node = {}) => {
  const rawTipo =
    node?.equipo?.tipoNombre?.tipoNombre ??
    node?.equipo?.tipoNombre ??
    node?.equipo?.tipoNombre?.nombre ??
    node?.equipo?.tipoNombre?.name ??
    node?.data?.equipo?.tipoNombre?.tipoNombre ??
    node?.data?.equipo?.tipoNombre ??
    node?.data?.equipo?.tipoNombre?.nombre ??
    node?.data?.equipo?.tipoNombre?.name ??
    node?.data?.equipoTipo ??
    node?.data?.tipo ??
    node?.data?.tipoNombre ??
    node?.type;
  if (!rawTipo) return "";
  return stripDiacritics(rawTipo);
};

const maybeWithImage = (node, currentData) => {
  if (currentData?.image) return currentData;
  const tipoKey = inferEquipoTipo(node);
  const imageUrl = EQUIPO_TYPE_IMAGE_MAP[tipoKey];
  if (!imageUrl) return currentData;
  return { ...currentData, image: imageUrl };
};

const normalizeNodes = (arr = []) =>
  (Array.isArray(arr) ? arr : []).map((n) => {
    const rawType = n?.type ?? DEFAULT_NODE_TYPE;
    const mappedType = NODE_TYPE_ALIAS[rawType] ?? rawType;
    const finalType = KNOWN_NODE_TYPES.has(mappedType) ? mappedType : DEFAULT_NODE_TYPE;

    const existingData = n?.data && typeof n.data === "object" ? { ...n.data } : {};
    const label = existingData.label ?? n?.label ?? n?.id ?? "Nodo";
    const dataWithLabel = maybeWithImage(n, { ...existingData, label });
    const position = n?.position ?? { x: 0, y: 0 };

    return {
      id: n?.id ?? crypto.randomUUID(),
      ...n,
      type: finalType,
      data: dataWithLabel,
      position,
    };
  });

const normalizeEdges = (arr = []) =>
  (Array.isArray(arr) ? arr : []).map((e) => {
    const rawType = e?.type ?? DEFAULT_EDGE_TYPE;
    const mappedType = EDGE_TYPE_ALIAS[rawType] ?? rawType;
    const finalType = KNOWN_EDGE_TYPES.has(mappedType) ? mappedType : DEFAULT_EDGE_TYPE;

    const direction = e?.data?.direction ?? e?.direction ?? "ida";
    const markerEnd = {
      ...(typeof e?.markerEnd === "object" && e?.markerEnd !== null ? e.markerEnd : {}),
      type: MarkerType.ArrowClosed,
      color: getDirectionColor(direction),
    };

    return {
      id:
        e?.id ??
        `e-${e?.source ?? "unk"}-${e?.target ?? "unk"}-${Math.random().toString(36).slice(2)}`,
      source: e?.source,
      target: e?.target,
      data: e?.data ?? {},
      ...e,
      type: finalType,
      markerEnd,
    };
  });

/* --------------------- Auto-asignación de handles --------------------- */
const HANDLE_ID_REGEX = HANDLE_CONFIG.HANDLE_ID_REGEX;

// lado sugerido (TARGET): lado opuesto al que mira hacia el source
const guessSideForTarget = (sourceNode, targetNode) => {
  if (!sourceNode || !targetNode) return "left";
  const dx = targetNode.position.x - sourceNode.position.x;
  const dy = targetNode.position.y - sourceNode.position.y;
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? "left" : "right";
  return dy >= 0 ? "top" : "bottom";
};

// lado sugerido (SOURCE): lado que mira hacia el target
const guessSideForSource = (sourceNode, targetNode) => {
  if (!sourceNode || !targetNode) return "right";
  const dx = targetNode.position.x - sourceNode.position.x;
  const dy = targetNode.position.y - sourceNode.position.y;
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? "right" : "left";
  return dy >= 0 ? "bottom" : "top";
};

const usedHandlesByNode = (allEdges, nodeId, endpoint = "target") => {
  const key = endpoint === "source" ? "sourceHandle" : "targetHandle";
  return new Set(
    (allEdges || [])
      .filter((e) => (endpoint === "source" ? e.source === nodeId : e.target === nodeId))
      .map((e) => e?.[key])
      .filter(Boolean)
  );
};

const firstFreeHandle = (occupiedSet, kind, side, maxPerSide) => {
  const max = Math.max(1, Number(maxPerSide || 0));
  for (let i = 1; i <= max; i++) {
    const candidate = makeHandleId(kind, side, i);
    if (!occupiedSet.has(candidate)) return candidate;
  }
  return null;
};

/* ============================== Componente ============================== */
export const DiagramFlow = () => {
  const { id } = useParams();
  const { isAuth } = useContext(UserContext);

  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [dataChannel, setDataChannel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const nodeOriginalPositionRef = useRef(new Map());
  const nodeSavingRef = useRef(new Set());
  const nodeRollbackRef = useRef(new Map());
  const edgeLocksRef = useRef(new Map());
  const edgeRollbackRef = useRef(new Map());

  // Estado de conexión y cola offline
  const { isOnline, wasOffline } = useOnlineStatus();
  const { enqueue, queueSize, isProcessing, clearQueue } = useOfflineQueue(isOnline);

  const notify = useCallback((options) => {
    Swal.fire({
      toast: true,
      position: "bottom-end",
      timer: options?.timer ?? 1600,
      timerProgressBar: true,
      showConfirmButton: false,
      ...options,
    });
  }, []);

  const nodeMap = useMemo(() => {
    const m = new Map();
    nodes.forEach((n) => m.set(n.id, n));
    return m;
  }, [nodes]);

  const patchNodePositionRetry = useMemo(
    () =>
      withRetry(
        (nodeId, position) =>
          api.patchChannelNodePosition(id, nodeId, position),
        { retries: 2, baseDelay: 180 }
      ),
    [id]
  );

  const patchEdgeReconnectRetry = useMemo(
    () =>
      withRetry(
        (edgeId, payload) =>
          api.patchChannelEdgeReconnect(id, edgeId, payload),
        { retries: 2, baseDelay: 200 }
      ),
    [id]
  );

  const patchEdgeTooltipRetry = useMemo(
    () =>
      withRetry(
        (edgeId, payload) =>
          api.patchChannelEdgeTooltip(id, edgeId, payload),
        { retries: 2, baseDelay: 200 }
      ),
    [id]
  );

  const nodePositionDebounce = useMemo(
    () =>
      createKeyedDebounce(async (nodeId, position) => {
        if (!position) return;
        const rollbackFn = nodeRollbackRef.current.get(nodeId);

        // Si no hay conexión, agregar a la cola
        if (!isOnline) {
          enqueue({
            type: 'node-position',
            entityId: nodeId,
            execute: async () => {
              await patchNodePositionRetry(nodeId, position);
              nodeSavingRef.current.delete(nodeId);
              nodeOriginalPositionRef.current.delete(nodeId);
              nodeRollbackRef.current.delete(nodeId);
              setNodes((prev) =>
                prev.map((node) =>
                  node.id === nodeId
                    ? {
                        ...node,
                        data: { ...(node.data || {}), savingPosition: false },
                      }
                    : node
                )
              );
            },
          });
          notify({ icon: "info", title: "Sin conexión - Cambio en cola", timer: 1500 });
          return;
        }

        try {
          await patchNodePositionRetry(nodeId, position);
          nodeSavingRef.current.delete(nodeId);
          nodeOriginalPositionRef.current.delete(nodeId);
          nodeRollbackRef.current.delete(nodeId);
          setNodes((prev) =>
            prev.map((node) =>
              node.id === nodeId
                ? {
                    ...node,
                    data: { ...(node.data || {}), savingPosition: false },
                  }
                : node
            )
          );
          notify({ icon: "success", title: "Posición guardada" });
        } catch (error) {
          // Si el error es de red, agregar a la cola
          if (error.message?.includes('Network') || error.code === 'ERR_NETWORK') {
            enqueue({
              type: 'node-position',
              entityId: nodeId,
              execute: async () => {
                await patchNodePositionRetry(nodeId, position);
                nodeSavingRef.current.delete(nodeId);
                nodeOriginalPositionRef.current.delete(nodeId);
                nodeRollbackRef.current.delete(nodeId);
                setNodes((prev) =>
                  prev.map((node) =>
                    node.id === nodeId
                      ? {
                          ...node,
                          data: { ...(node.data || {}), savingPosition: false },
                        }
                      : node
                  )
                );
              },
            });
            notify({ icon: "warning", title: "Error de red - Cambio en cola", timer: 1800 });
          } else {
            // Error no relacionado con red, hacer rollback
            nodeSavingRef.current.delete(nodeId);
            const original = nodeOriginalPositionRef.current.get(nodeId);
            nodeOriginalPositionRef.current.delete(nodeId);
            nodeRollbackRef.current.delete(nodeId);
            if (rollbackFn) {
              setNodes((prev) => rollbackFn(prev));
            } else if (original) {
              setNodes((prev) =>
                prev.map((node) =>
                  node.id === nodeId
                    ? {
                        ...node,
                        position: { ...original },
                        data: { ...(node.data || {}), savingPosition: false },
                      }
                    : node
                )
              );
            }
            notify({ icon: "error", title: "No se pudo guardar posición", timer: 2600 });
          }
        }
      }, 320),
    [patchNodePositionRetry, notify, isOnline, enqueue]
  );

  useEffect(() => {
    return () => {
      nodePositionDebounce.clearAll();
    };
  }, [nodePositionDebounce]);

  const scheduleEdgePersist = useCallback(
    (edgeId, payload, tooltipPayload) => {
      const rollback = edgeRollbackRef.current.get(edgeId);

      // Si no hay conexión, agregar a la cola
      if (!isOnline) {
        enqueue({
          type: 'edge-reconnect',
          entityId: edgeId,
          execute: async () => {
            await patchEdgeReconnectRetry(edgeId, payload);
            if (tooltipPayload) {
              await patchEdgeTooltipRetry(edgeId, tooltipPayload);
            }
            edgeLocksRef.current.delete(edgeId);
            edgeRollbackRef.current.delete(edgeId);
            setEdges((prev) =>
              prev.map((edge) =>
                edge.id === edgeId
                  ? {
                      ...edge,
                      data: {
                        ...(edge.data || {}),
                        isSaving: false,
                        ...(tooltipPayload || {}),
                      },
                    }
                  : edge
              )
            );
          },
        });
        notify({ icon: "info", title: "Sin conexión - Cambio en cola", timer: 1500 });
        return;
      }

      (async () => {
        try {
          await patchEdgeReconnectRetry(edgeId, payload);
          if (tooltipPayload) {
            await patchEdgeTooltipRetry(edgeId, tooltipPayload);
          }
          edgeLocksRef.current.delete(edgeId);
          edgeRollbackRef.current.delete(edgeId);
          setEdges((prev) =>
            prev.map((edge) =>
              edge.id === edgeId
                ? {
                    ...edge,
                    data: {
                      ...(edge.data || {}),
                      isSaving: false,
                      ...(tooltipPayload || {}),
                    },
                  }
                : edge
            )
          );
          notify({ icon: "success", title: "Enlace actualizado" });
        } catch (error) {
          // Si el error es de red, agregar a la cola
          if (error.message?.includes('Network') || error.code === 'ERR_NETWORK') {
            enqueue({
              type: 'edge-reconnect',
              entityId: edgeId,
              execute: async () => {
                await patchEdgeReconnectRetry(edgeId, payload);
                if (tooltipPayload) {
                  await patchEdgeTooltipRetry(edgeId, tooltipPayload);
                }
                edgeLocksRef.current.delete(edgeId);
                edgeRollbackRef.current.delete(edgeId);
                setEdges((prev) =>
                  prev.map((edge) =>
                    edge.id === edgeId
                      ? {
                          ...edge,
                          data: {
                            ...(edge.data || {}),
                            isSaving: false,
                            ...(tooltipPayload || {}),
                          },
                        }
                      : edge
                  )
                );
              },
            });
            notify({ icon: "warning", title: "Error de red - Cambio en cola", timer: 1800 });
          } else {
            // Error no relacionado con red, hacer rollback
            edgeLocksRef.current.delete(edgeId);
            edgeRollbackRef.current.delete(edgeId);
            if (rollback) {
              setEdges((prev) => rollback(prev));
            }
            notify({ icon: "error", title: "No se pudo reconectar el enlace", timer: 2600 });
          }
        }
      })();
    },
    [patchEdgeReconnectRetry, patchEdgeTooltipRetry, notify, isOnline, enqueue]
  );

  // Persistencia de label positions (PATCH /label-positions) con optimistic updates
  useEffect(() => {
    const pending = new Map(); // edgeId -> { x, y }
    const rollbacks = new Map(); // edgeId -> rollback function
    let t = null;

    const handler = (e) => {
      const { id: edgeId, x, y } = e.detail || {};
      if (!edgeId) return;

      // Optimistic update: actualizar el estado local inmediatamente
      setEdges((prev) => {
        const edgeIndex = prev.findIndex((edge) => edge.id === edgeId);
        if (edgeIndex === -1) return prev;

        const edge = prev[edgeIndex];
        const originalLabelPosition = edge.data?.labelPosition || null;

        // Guardar rollback
        rollbacks.set(edgeId, () => {
          setEdges((current) =>
            current.map((e) =>
              e.id === edgeId
                ? {
                    ...e,
                    data: {
                      ...(e.data || {}),
                      labelPosition: originalLabelPosition,
                      isSavingLabel: false,
                    },
                  }
                : e
            )
          );
        });

        const next = [...prev];
        next[edgeIndex] = {
          ...edge,
          data: {
            ...(edge.data || {}),
            labelPosition: { x, y },
            isSavingLabel: true,
          },
        };
        return next;
      });

      pending.set(edgeId, { x, y });

      if (t) clearTimeout(t);
      t = setTimeout(async () => {
        try {
          const edgesPayload = {};
          for (const [edgeId, pos] of pending.entries()) {
            edgesPayload[edgeId] = { labelPosition: pos };
          }

          const edgeIds = Array.from(pending.keys());
          pending.clear();

          await api.patchChannelLabelPositions(id, {
            labelPositions: { edges: edgesPayload },
          });

          // Success: remover indicador de guardado
          setEdges((prev) =>
            prev.map((edge) =>
              edgeIds.includes(edge.id)
                ? {
                    ...edge,
                    data: {
                      ...(edge.data || {}),
                      isSavingLabel: false,
                    },
                  }
                : edge
            )
          );

          // Limpiar rollbacks exitosos
          edgeIds.forEach((edgeId) => rollbacks.delete(edgeId));

          notify({ icon: "success", title: "Posiciones de etiquetas guardadas" });
        } catch (err) {
          console.error("PATCH label-positions error:", err);

          // Rollback en caso de error
          rollbacks.forEach((rollbackFn) => rollbackFn());
          rollbacks.clear();

          notify({ icon: "error", title: "No se pudo guardar las posiciones", timer: 2600 });
        }
      }, 250);
    };

    window.addEventListener("rf-edge-label-move", handler);
    return () => {
      window.removeEventListener("rf-edge-label-move", handler);
      if (t) clearTimeout(t);
      rollbacks.clear();
    };
  }, [id, notify]);

  // --- Carga desde API ---
  const fetchDataFlow = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const res = await api.getChannelDiagramById(id);

      const nodesRaw =
        res?.data?.nodes ?? res?.data?.signal?.nodes ?? res?.data?.channel?.nodes ?? [];
      const edgesRaw =
        res?.data?.edges ?? res?.data?.signal?.edges ?? res?.data?.channel?.edges ?? [];

      const channelRes =
        res?.data?.signal ??
        res?.data?.channel ?? {
          logoChannel: res?.data?.logoChannel,
          nameChannel: res?.data?.nameChannel,
          tipoTecnologia: res?.data?.tipoTecnologia,
        };

      const nodesRes = normalizeNodes(nodesRaw);
      const edgesRes = normalizeEdges(edgesRaw);

      setNodes(nodesRes);
      setEdges(edgesRes);
      setDataChannel(channelRes ?? null);
    } catch (err) {
      console.error("Error al obtener diagrama:", err);
      setError("Error al cargar el diagrama");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (USE_MOCK) {
      setLoading(false);
    } else {
      fetchDataFlow();
    }
  }, [fetchDataFlow]);

  // --- Handlers React Flow ---
  const onNodesChange = useCallback(
    (changes) => {
      setNodes((prev) => {
        changes.forEach((change) => {
          // Guardar posición original cuando empieza el drag
          if (change.type === "position" && !nodeOriginalPositionRef.current.has(change.id)) {
            const originalNode = prev.find((node) => node.id === change.id);
            if (originalNode) {
              nodeOriginalPositionRef.current.set(change.id, {
                x: originalNode.position?.x ?? 0,
                y: originalNode.position?.y ?? 0,
              });
            }
          }

          // Cleanup de refs cuando se eliminan nodos
          if (change.type === "remove") {
            nodeOriginalPositionRef.current.delete(change.id);
            nodeSavingRef.current.delete(change.id);
            nodeRollbackRef.current.delete(change.id);
            nodePositionDebounce.cancel(change.id);
          }
        });

        const next = applyNodeChanges(changes, prev);

        changes.forEach((change) => {
          if (change.type === "position" && change.position) {
            const snapshot = {
              x: change.position.x,
              y: change.position.y,
            };
            nodeRollbackRef.current.set(change.id, (current) =>
              current.map((node) =>
                node.id === change.id
                  ? {
                      ...node,
                      position: {
                        x: nodeOriginalPositionRef.current.get(change.id)?.x ?? node.position.x,
                        y: nodeOriginalPositionRef.current.get(change.id)?.y ?? node.position.y,
                      },
                      data: { ...(node.data || {}), savingPosition: false },
                    }
                  : node
              )
            );
            nodePositionDebounce(change.id, snapshot);
          }
        });

        return next.map((node) => {
          const shouldFlag = nodeSavingRef.current.has(node.id);
          const currentFlag = Boolean(node.data?.savingPosition);
          if (shouldFlag === currentFlag) return node;
          return {
            ...node,
            data: { ...(node.data || {}), savingPosition: shouldFlag },
          };
        });
      });
    },
    [nodePositionDebounce]
  );

  const onEdgesChange = useCallback((changes) => {
    setEdges((prev) => {
      // Cleanup de refs cuando se eliminan edges
      changes.forEach((change) => {
        if (change.type === "remove") {
          edgeLocksRef.current.delete(change.id);
          edgeRollbackRef.current.delete(change.id);
        }
      });
      return applyEdgeChanges(changes, prev);
    });
  }, []);

  const onNodeDragStop = useCallback(
    (_event, node) => {
      if (!node?.id) return;
      nodeSavingRef.current.add(node.id);
      setNodes((prev) =>
        prev.map((entry) =>
          entry.id === node.id
            ? {
                ...entry,
                data: { ...(entry.data || {}), savingPosition: true },
              }
            : entry
        )
      );
      nodePositionDebounce.flush(node.id);
    },
    [nodePositionDebounce]
  );

  const defaultEdgeOptions = useMemo(
    () => ({
      type: DEFAULT_EDGE_TYPE,
      markerEnd: { type: MarkerType.ArrowClosed, color: getDirectionColor() },
      animated: true,
    }),
    []
  );

  /* ------------------- onConnect: crear edge + persistir ------------------- */
  const onConnect = useCallback(
    (params) => {
      let {
        source,
        target,
        sourceHandle: rawSourceHandle,
        targetHandle: rawTargetHandle,
      } = params || {};
      if (!source || !target) return;

      const sNode = nodeMap.get(source);
      const tNode = nodeMap.get(target);

      // SOURCE: auto libre si no viene o está ocupado
      const srcUsed = usedHandlesByNode(edges, source, "source");
      let sourceHandle = rawSourceHandle;
      if (!sourceHandle || srcUsed.has(sourceHandle)) {
        const side = guessSideForSource(sNode, tNode);
        sourceHandle = firstFreeHandle(srcUsed, "out", side, MAX_HANDLES_PER_SIDE[side]);
        if (!sourceHandle) {
          const sides = ["right", "left", "top", "bottom"].filter((x) => x !== side);
          for (const alt of sides) {
            sourceHandle = firstFreeHandle(srcUsed, "out", alt, MAX_HANDLES_PER_SIDE[alt]);
            if (sourceHandle) break;
          }
        }
      }

      // TARGET: auto libre si no viene o está ocupado
      const tgtUsed = usedHandlesByNode(edges, target, "target");
      let targetHandle = rawTargetHandle;
      if (!targetHandle || tgtUsed.has(targetHandle)) {
        const side = guessSideForTarget(sNode, tNode);
        targetHandle = firstFreeHandle(tgtUsed, "in", side, MAX_HANDLES_PER_SIDE[side]);
        if (!targetHandle) {
          const sides = ["left", "right", "top", "bottom"].filter((x) => x !== side);
          for (const alt of sides) {
            targetHandle = firstFreeHandle(tgtUsed, "in", alt, MAX_HANDLES_PER_SIDE[alt]);
            if (targetHandle) break;
          }
        }
      }

      if (!sourceHandle || !targetHandle) {
        console.warn("No hay handles libres disponibles para conectar");
        return;
      }

      const sourceLabel = sNode?.data?.label ?? source;
      const targetLabel = tNode?.data?.label ?? target;

      const newEdge = {
        ...defaultEdgeOptions,
        id: `e-${source}-${target}-${Math.random().toString(36).slice(2)}`,
        source,
        target,
        sourceHandle,
        targetHandle,
        data: {
          direction: "ida",
          labelStart: sourceLabel,
          labelEnd: targetLabel,
          tooltipTitle: "Etiqueta centro",
          tooltip: `${sourceLabel} to ${targetLabel}`,
        },
      };

      // Optimistic update: agregar edge al estado local inmediatamente
      setEdges((prev) => addEdge(newEdge, prev));

      // Persistir usando el nuevo endpoint POST
      api
        .createChannelEdge(id, newEdge)
        .then((result) => {
          if (result.ok) {
            notify({ icon: "success", title: "Enlace creado" });
          } else {
            throw new Error(result.message || "Error al crear enlace");
          }
        })
        .catch((error) => {
          console.error("Error creando edge:", error);
          // Rollback: remover el edge del estado local
          setEdges((prev) => prev.filter((e) => e.id !== newEdge.id));
          notify({
            icon: "error",
            title: "No se pudo crear el enlace",
            text: error.message || "Error desconocido",
            timer: 2600,
          });
        });
    },
    [edges, nodeMap, defaultEdgeOptions, id, notify]
  );

  /* --------------- onEdgeUpdate: reasigna libre + PATCH por edge --------------- */
  const onEdgeUpdate = useCallback(
    (oldEdge, newConnection) => {
      if (!oldEdge?.id) return;
      if (edgeLocksRef.current.get(oldEdge.id)) {
        notify({ icon: "info", title: "Guardando enlace...", timer: 1800 });
        return;
      }

      setEdges((prev) => {
        let patchPayload = null;
        let tooltipPayload = null;
        let aborted = false;

        const { next, rollback } = prepareOptimisticUpdate(prev, oldEdge.id, (edge) => {
          const source = newConnection.source ?? edge.source;
          const target = newConnection.target ?? edge.target;

          if (!source || !target) {
            aborted = true;
            notify({ icon: "warning", title: "Conexión incompleta" });
            return edge;
          }

          const sourceNode = nodeMap.get(source);
          const targetNode = nodeMap.get(target);
          const others = prev.filter((entry) => entry.id !== edge.id);

          let sourceHandle = newConnection.sourceHandle ?? edge.sourceHandle;
          const usedSource = usedHandlesByNode(others, source, "source");
          if (!sourceHandle || usedSource.has(sourceHandle)) {
            const preferred = guessSideForSource(sourceNode, targetNode);
            sourceHandle =
              firstFreeHandle(usedSource, "out", preferred, MAX_HANDLES_PER_SIDE[preferred]) ||
              ["right", "left", "top", "bottom"]
                .filter((side) => side !== preferred)
                .map((alt) => firstFreeHandle(usedSource, "out", alt, MAX_HANDLES_PER_SIDE[alt]))
                .find(Boolean) ||
              null;
          }

          let targetHandle = newConnection.targetHandle ?? edge.targetHandle;
          const usedTarget = usedHandlesByNode(others, target, "target");
          if (!targetHandle || usedTarget.has(targetHandle)) {
            const preferred = guessSideForTarget(sourceNode, targetNode);
            targetHandle =
              firstFreeHandle(usedTarget, "in", preferred, MAX_HANDLES_PER_SIDE[preferred]) ||
              ["left", "right", "top", "bottom"]
                .filter((side) => side !== preferred)
                .map((alt) => firstFreeHandle(usedTarget, "in", alt, MAX_HANDLES_PER_SIDE[alt]))
                .find(Boolean) ||
              null;
          }

          if (!sourceHandle || !targetHandle) {
            aborted = true;
            notify({ icon: "warning", title: "No hay handles libres disponibles" });
            return edge;
          }

          if (!HANDLE_ID_REGEX.test(sourceHandle) || !HANDLE_ID_REGEX.test(targetHandle)) {
            aborted = true;
            notify({ icon: "error", title: "Handle inválido" });
            return edge;
          }

          const sourceLabel = sourceNode?.data?.label ?? source;
          const targetLabel = targetNode?.data?.label ?? target;

          patchPayload = {
            source,
            target,
            sourceHandle,
            targetHandle,
          };

          tooltipPayload = {
            tooltipTitle: "Etiqueta centro",
            tooltip: `${sourceLabel} to ${targetLabel}`,
          };

          return {
            ...edge,
            source,
            target,
            sourceHandle,
            targetHandle,
            data: {
              ...(edge.data || {}),
              direction: edge.data?.direction ?? "ida",
              tooltipTitle: tooltipPayload.tooltipTitle,
              tooltip: tooltipPayload.tooltip,
              isSaving: true,
            },
            markerEnd:
              newConnection?.markerEnd ?? edge.markerEnd ?? defaultEdgeOptions.markerEnd,
          };
        });

        if (!patchPayload || aborted) {
          return prev;
        }

        edgeRollbackRef.current.set(oldEdge.id, rollback);
        edgeLocksRef.current.set(oldEdge.id, true);
        scheduleEdgePersist(oldEdge.id, patchPayload, tooltipPayload);
        return next;
      });
    },
    [nodeMap, defaultEdgeOptions, scheduleEdgePersist, notify]
  );

  // --- Render ---
  if (loading) return <p>Cargando diagrama...</p>;
  if (error) return <p>{error}</p>;

  return (
    <ErrorBoundary
      showDetails={process.env.NODE_ENV === "development"}
      onError={(error, errorInfo) => {
        console.error("Error en DiagramFlow:", error, errorInfo);
      }}
    >
      <ConnectionBanner
        isOnline={isOnline}
        wasOffline={wasOffline}
        queueSize={queueSize}
      />
      {!isAuth && (
        <div className="read-only-banner" role="status" aria-live="polite">
          Modo lectura: inicia sesión para editar el diagrama.
        </div>
      )}
      <div className="outlet-main">
        <div className="dashboard_flow">
          <div className="container__flow">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              onNodesChange={onNodesChange}
              onNodeDragStop={onNodeDragStop}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onReconnect={onEdgeUpdate}
              defaultEdgeOptions={defaultEdgeOptions}
              connectionLineType={ConnectionLineType.SmoothStep}
              reconnectRadius={20}
              fitView
            >
              <Background />
              <Controls position="top-left" />
            </ReactFlow>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default DiagramFlow;
