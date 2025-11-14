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

const EQUIPO_ID_PATHS = [
  ["data", "equipoId"],
  ["data", "equipo", "equipoId"],
  ["data", "equipo", "id"],
  ["data", "equipo", "_id"],
  ["data", "equipo", "equipo"],
  ["data", "equipo", "equipoRef"],
  ["equipoId"],
  ["equipo", "_id"],
  ["equipo", "id"],
  ["equipo", "equipoId"],
  ["equipo"],
];

const IRD_ID_PATHS = [
  ["data", "equipo", "irdRef", "_id"],
  ["data", "irdRef", "_id"],
  ["data", "irdId"],
  ["data", "ird", "_id"],
  ["data", "ird", "id"],
  ["data", "ird", "irdId"],
  ["data", "ird", "irdRef"],
  ["data", "equipo", "irdId"],
  ["data", "equipo", "irdRef"],
  ["data", "equipo", "ird", "_id"],
  ["data", "equipo", "ird", "id"],
  ["data", "equipo", "ird"],
  ["irdId"],
  ["ird", "_id"],
  ["ird", "id"],
  ["ird"],
];

const EQUIPO_ID_KEYS = [
  "_id",
  "id",
  "equipoId",
  "equipoID",
  "equipo",
  "idEquipo",
  "id_equipo",
  "value",
  "key",
];

const IRD_ID_KEYS = [
  "_id",
  "id",
  "irdId",
  "irdID",
  "ird",
  "idIrd",
  "id_ird",
  "irdRef",
  "value",
  "key",
];

const getValueAtPath = (source, path = []) => {
  if (!source || typeof source !== "object") return undefined;
  return path.reduce((acc, key) => {
    if (acc === undefined || acc === null) return undefined;
    return acc?.[key];
  }, source);
};

const extractIdentifier = (value, priorityKeys = []) => {
  if (value === null || value === undefined) return null;

  if (typeof value === "string" || typeof value === "number" || typeof value === "bigint") {
    const normalized = String(value).trim();
    return normalized ? normalized : null;
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const extracted = extractIdentifier(item, priorityKeys);
      if (extracted) return extracted;
    }
    return null;
  }

  if (typeof value === "object") {
    const keysToCheck = priorityKeys.length > 0 ? priorityKeys : [
      "_id",
      "id",
      "value",
      "key",
      "equipoId",
      "equipoID",
      "equipo",
      "idEquipo",
      "id_equipo",
      "irdId",
      "irdID",
      "ird",
      "idIrd",
      "id_ird",
      "codigo",
      "code",
    ];

    for (const key of keysToCheck) {
      if (!Object.prototype.hasOwnProperty.call(value, key)) continue;
      const extracted = extractIdentifier(value[key], priorityKeys);
      if (extracted) return extracted;
    }

    for (const nestedValue of Object.values(value)) {
      const extracted = extractIdentifier(nestedValue, priorityKeys);
      if (extracted) return extracted;
    }
  }

  return null;
};

const getNodeIdentifier = (node, paths, priorityKeys) => {
  if (!node || !Array.isArray(paths)) return null;
  for (const path of paths) {
    const rawValue = getValueAtPath(node, path);
    const extracted = extractIdentifier(rawValue, priorityKeys);
    if (extracted) return extracted;
  }
  return null;
};

const getIrdRefIdentifier = (node) => {
  if (!node) return null;
  const rawEquipoRef = getValueAtPath(node, ["data", "equipo", "irdRef"]);
  const fromEquipo = extractIdentifier(rawEquipoRef, ["_id", "id", "irdId", "ird"]);
  if (fromEquipo) return fromEquipo;
  const rawNodeRef = getValueAtPath(node, ["data", "irdRef"]);
  return extractIdentifier(rawNodeRef, ["_id", "id", "irdId", "ird"]);
};

const formatKeyLabel = (key) =>
  String(key)
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (char) => char.toUpperCase());

const normalizeDetailValue = (value) => {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "bigint") return String(value);
  if (typeof value === "boolean") return value ? "Sí" : "No";
  return String(value);
};

const IRD_FIELD_MAP = [
  { key: "nombreIrd", label: "Nombre IRD" },
  { key: "ipAdminIrd", label: "IP administración" },
  { key: "marcaIrd", label: "Marca" },
  { key: "modelIrd", label: "Modelo" },
  { key: "versionIrd", label: "Versión" },
  { key: "uaIrd", label: "UA" },
  { key: "tidReceptor", label: "TID receptor" },
  { key: "typeReceptor", label: "Tipo receptor" },
  { key: "feqReceptor", label: "Frecuencia receptor" },
  { key: "symbolRateIrd", label: "Symbol rate" },
  { key: "fecReceptorIrd", label: "FEC receptor" },
  { key: "modulationReceptorIrd", label: "Modulación receptor" },
  { key: "rellOfReceptor", label: "Roll-off receptor" },
  { key: "nidReceptor", label: "NID receptor" },
  { key: "cvirtualReceptor", label: "Canal virtual" },
  { key: "vctReceptor", label: "VCT receptor" },
  { key: "outputReceptor", label: "Output receptor" },
  { key: "multicastReceptor", label: "Multicast receptor" },
  { key: "ipVideoMulticast", label: "IP video multicast" },
  { key: "locationRow", label: "Fila ubicación" },
  { key: "locationCol", label: "Columna ubicación" },
  { key: "swAdmin", label: "Switch administración" },
  { key: "portSw", label: "Puerto switch" },
];

const buildSelectedNodeDetail = (node, apiData, options = {}) => {
  const isIrd = Boolean(options?.isIrd);
  const nodeEquipo = node?.data?.equipo && typeof node.data.equipo === "object" ? node.data.equipo : {};
  const sourceData = apiData && typeof apiData === "object" ? apiData : {};

  const nodeIrd =
    isIrd && node?.data?.ird && typeof node.data.ird === "object"
      ? node.data.ird
      : isIrd && nodeEquipo?.irdRef && typeof nodeEquipo.irdRef === "object"
      ? nodeEquipo.irdRef
      : {};

  const apiIrd =
    isIrd && sourceData?.irdRef && typeof sourceData.irdRef === "object"
      ? sourceData.irdRef
      : isIrd
      ? sourceData
      : {};

  const mergedEquipo = { ...nodeEquipo, ...sourceData };
  const mergedIrd = isIrd ? { ...nodeIrd, ...(apiIrd || {}) } : {};
  const detailSource = isIrd ? mergedIrd : mergedEquipo;

  const fallbackLabel =
    normalizeDetailValue(detailSource?.nombre) ||
    normalizeDetailValue(detailSource?.nombreIrd) ||
    normalizeDetailValue(node?.data?.label) ||
    normalizeDetailValue(node?.label) ||
    node?.id ||
    "Equipo";

  const image =
    detailSource?.image ??
    detailSource?.urlIrd ??
    mergedEquipo?.image ??
    mergedEquipo?.urlIrd ??
    node?.data?.image ??
    null;

  const details = [];
  const detailDedup = new Set();

  const pushDetail = (label, value) => {
    const normalizedLabel = typeof label === "string" ? label.trim() : "";
    if (!normalizedLabel) return;
    const normalizedValue = normalizeDetailValue(value);
    if (!normalizedValue) return;
    const key = `${normalizedLabel}::${normalizedValue}`;
    if (detailDedup.has(key)) return;
    detailDedup.add(key);
    details.push({ label: normalizedLabel, value: normalizedValue });
  };

  pushDetail("ID del nodo", node?.id);

  if (options?.equipoId) {
    pushDetail("ID equipo", options.equipoId);
  }

  if (options?.irdId) {
    pushDetail("ID IRD", options.irdId);
  }

  if (isIrd) {
    const usedKeys = new Set();
    IRD_FIELD_MAP.forEach(({ key, label }) => {
      usedKeys.add(key);
      pushDetail(label, detailSource?.[key]);
    });

    Object.entries(detailSource || {}).forEach(([key, value]) => {
      if (usedKeys.has(key)) return;
      if (["_id", "createdAt", "updatedAt", "__v"].includes(key)) return;
      pushDetail(formatKeyLabel(key), value);
    });
  } else {
    const tipo =
      mergedEquipo?.tipoNombre?.tipoNombre ??
      mergedEquipo?.tipoNombre?.nombre ??
      mergedEquipo?.tipoNombre?.name ??
      mergedEquipo?.tipoNombre ??
      node?.data?.tipo ??
      node?.data?.tipoNombre ??
      inferEquipoTipo(node);

    pushDetail("Nombre", mergedEquipo?.nombre ?? fallbackLabel);
    pushDetail("Tipo de equipo", tipo);
    pushDetail("IP de gestión", mergedEquipo?.ip_gestion ?? mergedEquipo?.ipGestion ?? mergedEquipo?.ip);
    pushDetail("Marca", mergedEquipo?.marca ?? mergedEquipo?.brand);
    pushDetail("Modelo", mergedEquipo?.modelo ?? mergedEquipo?.model);
    pushDetail("N° de serie", mergedEquipo?.serie ?? mergedEquipo?.serial);
    pushDetail("Ubicación", mergedEquipo?.ubicacion ?? mergedEquipo?.location);
    pushDetail("Estado", mergedEquipo?.estado ?? mergedEquipo?.status);
    pushDetail("Descripción", mergedEquipo?.descripcion ?? mergedEquipo?.description);

    const parametros = mergedEquipo?.parametros ?? mergedEquipo?.parameters ?? null;

    if (Array.isArray(parametros)) {
      parametros
        .filter((param) => param && (param.nombre || param.name) && (param.valor ?? param.value))
        .forEach((param) => {
          const label = param.nombre ?? param.name;
          const value = param.valor ?? param.value;
          pushDetail(label, value);
        });
    } else if (parametros && typeof parametros === "object") {
      Object.entries(parametros).forEach(([key, value]) => {
        pushDetail(formatKeyLabel(key), value);
      });
    }
  }

  if (
    node?.position &&
    (typeof node.position.x === "number" || typeof node.position.y === "number")
  ) {
    const x = Number.isFinite(node.position.x) ? Math.round(node.position.x) : node.position.x;
    const y = Number.isFinite(node.position.y) ? Math.round(node.position.y) : node.position.y;
    pushDetail("Posición", `${x}, ${y}`);
  }

  return {
    title: fallbackLabel,
    image,
    details,
  };
};

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
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [selectedNodeDetail, setSelectedNodeDetail] = useState(null);
  const [selectedNodeDetailLoading, setSelectedNodeDetailLoading] = useState(false);
  const [selectedNodeDetailMessage, setSelectedNodeDetailMessage] = useState(null);

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

  useEffect(() => {
    if (selectedNodeId && !nodeMap.has(selectedNodeId)) {
      setSelectedNodeId(null);
    }
  }, [nodeMap, selectedNodeId]);

  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    return nodeMap.get(selectedNodeId) ?? null;
  }, [nodeMap, selectedNodeId]);

  useEffect(() => {
    let cancelled = false;

    if (!selectedNode) {
      setSelectedNodeDetail(null);
      setSelectedNodeDetailMessage(null);
      setSelectedNodeDetailLoading(false);
      return () => {
        cancelled = true;
      };
    }

    const isIrdNode = inferEquipoTipo(selectedNode) === "ird";
    const equipoId = getNodeIdentifier(selectedNode, EQUIPO_ID_PATHS, EQUIPO_ID_KEYS);
    const irdRefId = getIrdRefIdentifier(selectedNode);
    const irdId = getNodeIdentifier(selectedNode, IRD_ID_PATHS, IRD_ID_KEYS);
    const resolvedIrdId = irdRefId ?? irdId;
    const idToUse = isIrdNode ? resolvedIrdId : equipoId ?? resolvedIrdId;

    const fallbackDetail = buildSelectedNodeDetail(selectedNode, null, {
      isIrd: isIrdNode,
      equipoId,
      irdId: resolvedIrdId ?? irdId,
    });

    setSelectedNodeDetail(fallbackDetail);
    setSelectedNodeDetailMessage(null);

    if (!idToUse) {
      if (isIrdNode && !resolvedIrdId) {
        setSelectedNodeDetailMessage({
          type: "error",
          text: "No se encontró el irdRef._id asociado a este IRD.",
        });
      } else if (!isIrdNode && !equipoId) {
        setSelectedNodeDetailMessage({
          type: "error",
          text: "No se encontró un identificador de equipo para este nodo.",
        });
      }
      setSelectedNodeDetailLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setSelectedNodeDetailLoading(true);

    const fetchDetail = async () => {
      let nextMessage = null;

      try {
        let data = null;

        if (isIrdNode) {
          try {
            const response = await api.getIdIrd(idToUse);
            data = response?.data ?? null;
          } catch (irdError) {
            console.error("Error al obtener IRD:", irdError);
            if (equipoId) {
              try {
                const response = await api.getIdEquipo(equipoId);
                data = response?.data ?? null;
                nextMessage = {
                  type: "warning",
                  text: "No se pudo obtener el detalle del IRD. Se muestran los datos del equipo asociado.",
                };
              } catch (equipoError) {
                console.error("Error al obtener equipo asociado:", equipoError);
                throw equipoError;
              }
            } else {
              throw irdError;
            }
          }
        } else {
          const response = await api.getIdEquipo(idToUse);
          data = response?.data ?? null;
        }

        if (cancelled) return;

        const detail = buildSelectedNodeDetail(selectedNode, data, {
          isIrd: isIrdNode,
          equipoId,
          irdId: resolvedIrdId ?? irdId,
        });

        setSelectedNodeDetail(detail);
        setSelectedNodeDetailMessage(nextMessage);
      } catch (err) {
        if (cancelled) return;
        console.error("Error al obtener detalle del equipo:", err);
        setSelectedNodeDetailMessage({
          type: "error",
          text: "No se pudo cargar la información actualizada.",
        });
      } finally {
        if (!cancelled) {
          setSelectedNodeDetailLoading(false);
        }
      }
    };

    fetchDetail();

    return () => {
      cancelled = true;
    };
  }, [selectedNode]);

  const handleNodeClick = useCallback((_, node) => {
    if (!node || !node.id) return;
    setSelectedNodeId((prev) => (prev === node.id ? null : node.id));
  }, []);

  const handlePaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, []);

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

  const wrapperClassName = `diagram-flow-wrapper${selectedNode ? " diagram-flow-wrapper--with-sidebar" : ""}`;
  const sidebarMessageClassName = selectedNodeDetailMessage?.type === "error"
    ? "diagram-sidebar__status diagram-sidebar__status--error"
    : selectedNodeDetailMessage?.type === "warning"
    ? "diagram-sidebar__status diagram-sidebar__status--warning"
    : "diagram-sidebar__status";

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
      <div className={wrapperClassName}>
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
                onNodeClick={handleNodeClick}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onReconnect={onEdgeUpdate}
                onPaneClick={handlePaneClick}
                defaultEdgeOptions={defaultEdgeOptions}
                connectionLineType={ConnectionLineType.SmoothStep}
                reconnectRadius={20}
                fitView
              >
                <Background />
                <Controls position="top-left" />
              </ReactFlow>
            </div>
            <aside
              className={`diagram-sidebar${selectedNode ? " is-open" : ""}`}
              aria-label="Detalle del equipo seleccionado"
            >
              {selectedNode ? (
                <div className="diagram-sidebar__content">
                  <div className="diagram-sidebar__header">
                    <h2 className="diagram-sidebar__title">{selectedNodeDetail?.title ?? "Equipo"}</h2>
                    <button
                      type="button"
                      className="diagram-sidebar__close"
                      onClick={() => setSelectedNodeId(null)}
                      aria-label="Cerrar panel de detalles"
                    >
                      ×
                    </button>
                  </div>

                  {selectedNodeDetailLoading ? (
                    <p className="diagram-sidebar__status diagram-sidebar__status--loading">
                      Cargando información...
                    </p>
                  ) : null}

                  {selectedNodeDetailMessage ? (
                    <p className={sidebarMessageClassName}>
                      {selectedNodeDetailMessage.text}
                    </p>
                  ) : null}

                  {selectedNodeDetail?.image ? (
                    <div className="diagram-sidebar__image">
                      <img
                        src={selectedNodeDetail.image}
                        alt={`Imagen del equipo ${selectedNodeDetail.title}`}
                      />
                    </div>
                  ) : null}

                  {selectedNodeDetail?.details?.length ? (
                    <dl className="diagram-sidebar__list">
                      {selectedNodeDetail.details.map((item, index) => (
                        <div key={`${item.label}-${index}`} className="diagram-sidebar__list-item">
                          <dt>{item.label}</dt>
                          <dd>{item.value}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : (
                    <p className="diagram-sidebar__empty-section">
                      No hay parámetros adicionales para este equipo.
                    </p>
                  )}
                </div>
              ) : (
                <div className="diagram-sidebar__empty">
                  <h2>Panel de parámetros</h2>
                  <p>Selecciona un equipo del diagrama para ver sus detalles.</p>
                </div>
              )}
            </aside>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default DiagramFlow;
