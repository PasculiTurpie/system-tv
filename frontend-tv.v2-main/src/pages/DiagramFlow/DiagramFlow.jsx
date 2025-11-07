// src/pages/ChannelDiagram/DiagramFlow.jsx
import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
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

// Componentes personalizados
import CustomNode from "./CustomNode";
import DraggableDirectionalEdge from "./DraggableDirectionalEdge";
import { getDirectionColor } from "./directionColors";

// --- Config ---
const USE_MOCK = false;

/** Si quieres forzar la cantidad “máxima” de handles por lado al autocompletar.
 *  Debe coincidir con lo que renderizas en tus nodos (CustomNode.jsx).
 *  (En tu CustomNode actual: 4 por lado en vertical, 4 top, 4 bottom)
 */
const MAX_HANDLES_PER_SIDE = {
  left: 4,
  right: 4,
  top: 4,
  bottom: 4,
};

// Tipos de nodo/edge registrados en React Flow
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

// Defaults/alias para normalizar lo que venga del backend
const DEFAULT_NODE_TYPE = "imageNode";
const DEFAULT_EDGE_TYPE = "draggableDirectional";
const KNOWN_NODE_TYPES = new Set(Object.keys(nodeTypes));
const KNOWN_EDGE_TYPES = new Set(Object.keys(edgeTypes));
const NODE_TYPE_ALIAS = { custom: DEFAULT_NODE_TYPE };
const EDGE_TYPE_ALIAS = { customDirectional: DEFAULT_EDGE_TYPE };

// --- Helpers de normalización seguros ---
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

/* ========================  NUEVO: Auto-handles libres  ======================== */

const HANDLE_ID_REGEX = /^(in|out)-(left|right|top|bottom)-([1-9]\d*)$/;

const parseHandle = (id = "") => {
  const m = String(id).match(HANDLE_ID_REGEX);
  if (!m) return null;
  return { kind: m[1], side: m[2], idx: Number(m[3]) };
};

// Lado sugerido en función de la geometría de nodes (aproximado)
// - para target: lado opuesto al que mira hacia el source (para entradas)
const guessSideForTarget = (sourceNode, targetNode) => {
  if (!sourceNode || !targetNode) return "left";
  const dx = targetNode.position.x - sourceNode.position.x;
  const dy = targetNode.position.y - sourceNode.position.y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    // horizontal domina
    return dx >= 0 ? "left" : "right";
  }
  // vertical domina
  return dy >= 0 ? "top" : "bottom";
};

// - para source: lado que mira hacia el target (para salidas)
const guessSideForSource = (sourceNode, targetNode) => {
  if (!sourceNode || !targetNode) return "right";
  const dx = targetNode.position.x - sourceNode.position.x;
  const dy = targetNode.position.y - sourceNode.position.y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? "right" : "left";
  }
  return dy >= 0 ? "bottom" : "top";
};

// Set de handles ya usados en un nodo por tipo (source/target) -> evitamos duplicados
const usedHandlesByNode = (allEdges, nodeId, endpoint = "target") => {
  const key = endpoint === "source" ? "sourceHandle" : "targetHandle";
  return new Set(
    (allEdges || [])
      .filter((e) => (endpoint === "source" ? e.source === nodeId : e.target === nodeId))
      .map((e) => e?.[key])
      .filter(Boolean)
  );
};

const makeHandleId = (kind, side, idx) => `${kind}-${side}-${idx}`;

const firstFreeHandle = (occupiedSet, kind, side, maxPerSide) => {
  const max = Math.max(1, Number(maxPerSide || 0));
  for (let i = 1; i <= max; i++) {
    const candidate = makeHandleId(kind, side, i);
    if (!occupiedSet.has(candidate)) return candidate;
  }
  return null;
};

/* ============================================================================ */

export const DiagramFlow = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  // Arrays para React Flow
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);

  // Datos del canal (encabezado)
  const [dataChannel, setDataChannel] = useState(null);

  // Estados UI
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const nodeMap = useMemo(() => {
    const m = new Map();
    nodes.forEach((n) => m.set(n.id, n));
    return m;
  }, [nodes]);

  // persistencia “debounced” para no saturar backend si mueves seguido
  const persistTimer = useRef(null);
  const schedulePersist = useCallback(
    (nextNodes, nextEdges) => {
      if (persistTimer.current) clearTimeout(persistTimer.current);
      persistTimer.current = setTimeout(async () => {
        try {
          await api.updateChannelFlow(id, {
            nodes: nextNodes ?? nodes,
            edges: nextEdges ?? edges,
          });
        } catch (e) {
          console.error("Persistencia fallida:", e);
        }
      }, 350); // pequeño debounce
    },
    [id, nodes, edges]
  );

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

  // --- Efecto inicial ---
  useEffect(() => {
    if (USE_MOCK) {
      setLoading(false);
    } else {
      fetchDataFlow();
    }
  }, [fetchDataFlow]);

  // --- Handlers de React Flow ---
  const onNodesChange = useCallback((changes) => {
    setNodes((prev) => {
      const next = applyNodeChanges(changes, prev);
      schedulePersist(next, edges);
      return next;
    });
  }, [edges, schedulePersist]);

  const onEdgesChange = useCallback((changes) => {
    setEdges((prev) => {
      const next = applyEdgeChanges(changes, prev);
      schedulePersist(nodes, next);
      return next;
    });
  }, [nodes, schedulePersist]);

  const defaultEdgeOptions = useMemo(
    () => ({
      type: DEFAULT_EDGE_TYPE,
      markerEnd: { type: MarkerType.ArrowClosed, color: getDirectionColor() },
      animated: true,
    }),
    []
  );

  /* ===================  onConnect con auto-handle libre  =================== */
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

      // SOURCE: si no viene handle o viene ocupado → asigna el primer libre del lado sugerido
      const srcUsed = usedHandlesByNode(edges, source, "source");
      let sourceHandle = rawSourceHandle;
      if (!sourceHandle || srcUsed.has(sourceHandle)) {
        const side = guessSideForSource(sNode, tNode);
        sourceHandle = firstFreeHandle(srcUsed, "out", side, MAX_HANDLES_PER_SIDE[side]);
        // fallback a otro lado si ese lado está lleno
        if (!sourceHandle) {
          const sides = ["right", "left", "top", "bottom"].filter((x) => x !== side);
          for (const alt of sides) {
            sourceHandle = firstFreeHandle(srcUsed, "out", alt, MAX_HANDLES_PER_SIDE[alt]);
            if (sourceHandle) break;
          }
        }
      }

      // TARGET: si no viene handle o viene ocupado → asigna el primer libre del lado sugerido
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

      // si aún no hay handle libre en alguno de los extremos, cancela
      if (!sourceHandle || !targetHandle) {
        console.warn("No hay handles libres disponibles para conectar");
        return;
      }

      const newEdge = {
        ...defaultEdgeOptions,
        source,
        target,
        sourceHandle,
        targetHandle,
        data: { direction: "ida" },
      };

      setEdges((prev) => {
        const next = addEdge(newEdge, prev);
        schedulePersist(nodes, next);
        return next;
      });
    },
    [edges, nodeMap, nodes, defaultEdgeOptions, schedulePersist]
  );

  /* ===========  onEdgeUpdate: respeta colisiones y reasigna libre  =========== */
  const onEdgeUpdate = useCallback(
    (oldEdge, newConnection) => {
      setEdges((prev) => {
        const next = prev.map((edge) => {
          if (edge.id !== oldEdge.id) return edge;

          // ¿estamos moviendo el source o el target?
          const movingSource = newConnection.source && newConnection.source !== edge.source;
          const movingTarget = newConnection.target && newConnection.target !== edge.target;

          let source = newConnection.source ?? edge.source;
          let target = newConnection.target ?? edge.target;

          let sourceHandle = newConnection.sourceHandle ?? edge.sourceHandle;
          let targetHandle = newConnection.targetHandle ?? edge.targetHandle;

          const sNode = nodeMap.get(source);
          const tNode = nodeMap.get(target);

          // Si el handle de source está ocupado por otro edge → reasigna
          if (source) {
            const usedSrc = usedHandlesByNode(prev.filter((e) => e.id !== edge.id), source, "source");
            if (!sourceHandle || usedSrc.has(sourceHandle)) {
              const side = guessSideForSource(sNode, tNode);
              sourceHandle = firstFreeHandle(usedSrc, "out", side, MAX_HANDLES_PER_SIDE[side]);
              if (!sourceHandle) {
                const sides = ["right", "left", "top", "bottom"].filter((x) => x !== side);
                for (const alt of sides) {
                  sourceHandle = firstFreeHandle(usedSrc, "out", alt, MAX_HANDLES_PER_SIDE[alt]);
                  if (sourceHandle) break;
                }
              }
            }
          }

          // Si el handle de target está ocupado por otro edge → reasigna
          if (target) {
            const usedTgt = usedHandlesByNode(prev.filter((e) => e.id !== edge.id), target, "target");
            if (!targetHandle || usedTgt.has(targetHandle)) {
              const side = guessSideForTarget(sNode, tNode);
              targetHandle = firstFreeHandle(usedTgt, "in", side, MAX_HANDLES_PER_SIDE[side]);
              if (!targetHandle) {
                const sides = ["left", "right", "top", "bottom"].filter((x) => x !== side);
                for (const alt of sides) {
                  targetHandle = firstFreeHandle(usedTgt, "in", alt, MAX_HANDLES_PER_SIDE[alt]);
                  if (targetHandle) break;
                }
              }
            }
          }

          return {
            ...edge,
            ...newConnection,
            source,
            target,
            sourceHandle,
            targetHandle,
            type: edge.type || DEFAULT_EDGE_TYPE,
            markerEnd: newConnection?.markerEnd ?? edge.markerEnd ?? defaultEdgeOptions.markerEnd,
          };
        });

        schedulePersist(nodes, next);
        return next;
      });
    },
    [nodeMap, nodes, defaultEdgeOptions, schedulePersist]
  );

  const handleBackSubmit = () => navigate(-1);

  // --- Render ---
  if (loading) return <p>Cargando diagrama...</p>;
  if (error) return <p>{error}</p>;

  const titulo =
    (dataChannel?.nameChannel || "Canal sin nombre") +
    (dataChannel?.tipoTecnologia ? ` - ${dataChannel.tipoTecnologia}` : "");

  const logoSrc = dataChannel?.logoChannel || "https://via.placeholder.com/120x72?text=LOGO";

  return (
    <>
      <div className="outlet-main">
        <div className="dashboard_flow">
          <div className="container__flow">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onEdgeUpdate={onEdgeUpdate}
              defaultEdgeOptions={defaultEdgeOptions}
              connectionLineType={ConnectionLineType.SmoothStep}
              edgesUpdatable
              fitView
            >
              <Background />
              <Controls position="top-left" />
            </ReactFlow>
          </div>
        </div>
      </div>
    </>
  );
};

export default DiagramFlow;
