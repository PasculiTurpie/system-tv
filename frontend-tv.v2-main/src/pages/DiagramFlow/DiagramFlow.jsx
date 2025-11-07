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

/** Cantidad máxima de handles por lado (debe coincidir con CustomNode.jsx) */
const MAX_HANDLES_PER_SIDE = {
  left: 4,
  right: 4,
  top: 4,
  bottom: 4,
};

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
const HANDLE_ID_REGEX = /^(in|out)-(left|right|top|bottom)-([1-9]\d*)$/;

const parseHandle = (id = "") => {
  const m = String(id).match(HANDLE_ID_REGEX);
  if (!m) return null;
  return { kind: m[1], side: m[2], idx: Number(m[3]) };
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

const makeHandleId = (kind, side, idx) => `${kind}-${side}-${idx}`;

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
  const navigate = useNavigate();

  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [dataChannel, setDataChannel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const nodeMap = useMemo(() => {
    const m = new Map();
    nodes.forEach((n) => m.set(n.id, n));
    return m;
  }, [nodes]);

  // --- Persistencia por edge (PATCH) con debounce por id ---
  const patchTimersRef = useRef(new Map());

  const patchEdgeDebounced = useCallback(
    (edge) => {
      if (!edge?.id) return;
      const key = edge.id;

      const doPatch = async () => {
        try {
          await api.patchChannelEdge(id, key, {
            source: edge.source,
            target: edge.target,
            sourceHandle: edge.sourceHandle ?? null,
            targetHandle: edge.targetHandle ?? null,
            type: edge.type,
            animated: Boolean(edge.animated),
            markerEnd: edge.markerEnd,
            data: edge.data && typeof edge.data === "object" ? edge.data : {},
          });
        } catch (e) {
          console.error("PATCH edge error:", e);
        }
      };

      const timers = patchTimersRef.current;
      if (timers.has(key)) clearTimeout(timers.get(key));
      const t = setTimeout(doPatch, 250);
      timers.set(key, t);
    },
    [id]
  );

  // Persistencia de label positions (PATCH /label-positions) desde edge draggable label
  useEffect(() => {
    const pending = new Map(); // edgeId -> { x, y }
    let t = null;

    const handler = (e) => {
      const { id: edgeId, x, y } = e.detail || {};
      if (!edgeId) return;
      pending.set(edgeId, { x, y });

      if (t) clearTimeout(t);
      t = setTimeout(async () => {
        try {
          const edgesPayload = {};
          for (const [edgeId, pos] of pending.entries()) {
            edgesPayload[edgeId] = { labelPosition: pos };
          }
          pending.clear();
          await api.patchChannelLabelPositions(id, {
            labelPositions: { edges: edgesPayload },
          });
        } catch (err) {
          console.error("PATCH label-positions error:", err);
        }
      }, 250);
    };

    window.addEventListener("rf-edge-label-move", handler);
    return () => window.removeEventListener("rf-edge-label-move", handler);
  }, [id]);

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
  const onNodesChange = useCallback((changes) => {
    setNodes((prev) => applyNodeChanges(changes, prev));
  }, []);

  const onEdgesChange = useCallback((changes) => {
    setEdges((prev) => applyEdgeChanges(changes, prev));
  }, []);

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

      const newEdge = {
        ...defaultEdgeOptions,
        id: `e-${source}-${target}-${Math.random().toString(36).slice(2)}`,
        source,
        target,
        sourceHandle,
        targetHandle,
        data: { direction: "ida" },
      };

      setEdges((prev) => {
        const next = addEdge(newEdge, prev);
        // Persistimos la creación con updateChannelFlow (payload completo)
        api.updateChannelFlow(id, { nodes, edges: next }).catch((e) =>
          console.error("Persist create edge (updateChannelFlow) error:", e)
        );
        return next;
      });
    },
    [edges, nodeMap, nodes, defaultEdgeOptions, id]
  );

  /* --------------- onEdgeUpdate: reasigna libre + PATCH por edge --------------- */
  const onEdgeUpdate = useCallback(
    (oldEdge, newConnection) => {
      setEdges((prev) => {
        let updatedEdgeForPatch = null;

        const next = prev.map((edge) => {
          if (edge.id !== oldEdge.id) return edge;

          const source = newConnection.source ?? edge.source;
          const target = newConnection.target ?? edge.target;

          let sourceHandle = newConnection.sourceHandle ?? edge.sourceHandle;
          let targetHandle = newConnection.targetHandle ?? edge.targetHandle;

          const sNode = nodeMap.get(source);
          const tNode = nodeMap.get(target);

          // Evitar colisión en source
          {
            const others = prev.filter((e) => e.id !== edge.id);
            const usedSrc = usedHandlesByNode(others, source, "source");
            if (!sourceHandle || usedSrc.has(sourceHandle)) {
              const side = guessSideForSource(sNode, tNode);
              sourceHandle =
                firstFreeHandle(usedSrc, "out", side, MAX_HANDLES_PER_SIDE[side]) ||
                ["right", "left", "top", "bottom"]
                  .filter((x) => x !== side)
                  .map((alt) => firstFreeHandle(usedSrc, "out", alt, MAX_HANDLES_PER_SIDE[alt]))
                  .find(Boolean) ||
                null;
            }
          }

          // Evitar colisión en target
          {
            const others = prev.filter((e) => e.id !== edge.id);
            const usedTgt = usedHandlesByNode(others, target, "target");
            if (!targetHandle || usedTgt.has(targetHandle)) {
              const side = guessSideForTarget(sNode, tNode);
              targetHandle =
                firstFreeHandle(usedTgt, "in", side, MAX_HANDLES_PER_SIDE[side]) ||
                ["left", "right", "top", "bottom"]
                  .filter((x) => x !== side)
                  .map((alt) => firstFreeHandle(usedTgt, "in", alt, MAX_HANDLES_PER_SIDE[alt]))
                  .find(Boolean) ||
                null;
            }
          }

          const patched = {
            ...edge,
            ...newConnection,
            source,
            target,
            sourceHandle,
            targetHandle,
            type: edge.type || DEFAULT_EDGE_TYPE,
            markerEnd: newConnection?.markerEnd ?? edge.markerEnd ?? defaultEdgeOptions.markerEnd,
          };

          updatedEdgeForPatch = patched;
          return patched;
        });

        if (updatedEdgeForPatch?.id) {
          patchEdgeDebounced(updatedEdgeForPatch);
        }

        return next;
      });
    },
    [nodeMap, defaultEdgeOptions, patchEdgeDebounced]
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
