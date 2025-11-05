// src/pages/ChannelDiagram/DiagramFlow.jsx
import { useEffect, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ReactFlow,
  Background,
  Controls,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import api from "../../utils/api";
import "./DiagramFlow.css";

// Componentes personalizados
import CustomNode from "./CustomNode";
import DraggableDirectionalEdge from "./DraggableDirectionalEdge";

// --- Config: alterna entre API real y MOCK local ---
const USE_MOCK = false; // pon en true si quieres probar con MOCK

// Si usas MOCK, define aquí un objeto con la misma forma que responde tu API
// Estructura esperada: { nodes: [], edges: [], logoChannel, nameChannel, tipoTecnologia }
const MOCK_FLOW = {
  logoChannel: "https://via.placeholder.com/120x72?text=LOGO",
  nameChannel: "Canal Demo",
  tipoTecnologia: "IPTV",
  nodes: [
    {
      id: "n1",
      type: "imageNode", // ← coincide con nodeTypes
      position: { x: 100, y: 100 },
      data: { label: "Nodo 1" },
    },
    {
      id: "n2",
      type: "imageNode",
      position: { x: 420, y: 200 },
      data: { label: "Nodo 2" },
    },
  ],
  edges: [
    {
      id: "e1-2",
      type: "draggableDirectional", // ← coincide con edgeTypes
      source: "n1",
      target: "n2",
      data: { label: "Edge 1-2" },
    },
  ],
};

// Tipos de nodo/edge registrados en React Flow
const nodeTypes = {
  imageNode: CustomNode,
};

const edgeTypes = {
  draggableDirectional: DraggableDirectionalEdge,
};

// Defaults/alias para normalizar lo que venga del backend
const DEFAULT_NODE_TYPE = "imageNode";
const DEFAULT_EDGE_TYPE = "draggableDirectional";

const KNOWN_NODE_TYPES = new Set(Object.keys(nodeTypes)); // p.ej. { "imageNode" }
const KNOWN_EDGE_TYPES = new Set(Object.keys(edgeTypes)); // p.ej. { "draggableDirectional" }

// Mapea aliases del backend → tipos registrados en React Flow
const NODE_TYPE_ALIAS = {
  custom: DEFAULT_NODE_TYPE, // si backend manda "custom", úsalo como "imageNode"
  // Agrega aquí otros alias si tu backend los emite (ej: "router", "ird", etc.)
};

const EDGE_TYPE_ALIAS = {
  customDirectional: DEFAULT_EDGE_TYPE, // si backend manda "customDirectional", úsalo como "draggableDirectional"
  // Agrega aquí otros alias si aparecen
};

// --- Helpers de normalización seguros ---
const normalizeNodes = (arr = []) =>
  (Array.isArray(arr) ? arr : []).map((n) => {
    const rawType = n?.type ?? DEFAULT_NODE_TYPE;
    const mappedType = NODE_TYPE_ALIAS[rawType] ?? rawType;
    const finalType = KNOWN_NODE_TYPES.has(mappedType) ? mappedType : DEFAULT_NODE_TYPE;

    if (finalType !== rawType) {
      console.warn(`[normalizeNodes] Remapeado type "${rawType}" → "${finalType}" para el nodo`, n?.id);
    }

    return {
      id: n?.id ?? crypto.randomUUID(),
      type: finalType,
      position: n?.position ?? { x: 0, y: 0 },
      data: n?.data ?? { label: n?.id ?? "Nodo" },
      ...n,
      type: finalType, // asegurar el type final
    };
  });

const normalizeEdges = (arr = []) =>
  (Array.isArray(arr) ? arr : []).map((e) => {
    const rawType = e?.type ?? DEFAULT_EDGE_TYPE;
    const mappedType = EDGE_TYPE_ALIAS[rawType] ?? rawType;
    const finalType = KNOWN_EDGE_TYPES.has(mappedType) ? mappedType : DEFAULT_EDGE_TYPE;

    if (finalType !== rawType) {
      console.warn(`[normalizeEdges] Remapeado type "${rawType}" → "${finalType}" para el edge`, e?.id);
    }

    return {
      id:
        e?.id ??
        `e-${e?.source ?? "unk"}-${e?.target ?? "unk"}-${Math.random()
          .toString(36)
          .slice(2)}`,
      type: finalType,
      source: e?.source,
      target: e?.target,
      data: e?.data ?? {},
      ...e,
      type: finalType, // asegurar el type final
    };
  });

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

  // --- Carga desde API ---
  const fetchDataFlow = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const res = await api.getChannelDiagramById(id);

      // Permitir varias formas de respuesta del backend
      const nodesRaw =
        res?.data?.nodes ??
        res?.data?.signal?.nodes ??
        res?.data?.channel?.nodes ??
        [];

      const edgesRaw =
        res?.data?.edges ??
        res?.data?.signal?.edges ??
        res?.data?.channel?.edges ??
        [];

      const channelRes =
        res?.data?.signal ??
        res?.data?.channel ??
        {
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

  // --- Carga desde MOCK ---
  const loadMock = useCallback(() => {
    try {
      setLoading(true);
      setError("");
      setNodes(normalizeNodes(MOCK_FLOW?.nodes));
      setEdges(normalizeEdges(MOCK_FLOW?.edges));
      setDataChannel({
        logoChannel: MOCK_FLOW?.logoChannel,
        nameChannel: MOCK_FLOW?.nameChannel,
        tipoTecnologia: MOCK_FLOW?.tipoTecnologia,
      });
    } catch (err) {
      console.error("Error al cargar MOCK:", err);
      setError("Error al cargar datos de prueba");
    } finally {
      setLoading(false);
    }
  }, []);

  // --- Efecto inicial ---
  useEffect(() => {
    if (USE_MOCK) {
      loadMock();
    } else {
      fetchDataFlow();
    }
  }, [fetchDataFlow, loadMock]);

  // --- Handlers de React Flow ---
  const onNodesChange = useCallback((changes) => {
    setNodes((prev) => applyNodeChanges(changes, prev));
  }, []);

  const onEdgesChange = useCallback((changes) => {
    setEdges((prev) => applyEdgeChanges(changes, prev));
  }, []);

  // Crea edges con el tipo correcto por defecto
  const onConnect = useCallback((params) => {
    setEdges((prev) => addEdge({ ...params, type: DEFAULT_EDGE_TYPE }, prev));
  }, []);

  const handleBackSubmit = () => navigate(-1);

  // --- Render ---
  if (loading) return <p>Cargando diagrama...</p>;
  if (error) return <p>{error}</p>;

  const titulo =
    (dataChannel?.nameChannel || "Canal sin nombre") +
    (dataChannel?.tipoTecnologia ? ` - ${dataChannel.tipoTecnologia}` : "");

  const logoSrc =
    dataChannel?.logoChannel || "https://via.placeholder.com/120x72?text=LOGO";

  return (
    <>
      <div className="outlet-main">
        <div className="container__header">
          <img
            className="logo__channel"
            src={logoSrc}
            alt={dataChannel?.nameChannel || "Logo canal"}
          />
          <h3 className="title__channel">{titulo}</h3>
        </div>

        <button className="button__back" onClick={handleBackSubmit}>
          ← Volver
        </button>

        <div className="container__flow" style={{ width: "83vw", height: "100vh" }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            fitView
          >
            <Background />
            <Controls position="top-left" />
          </ReactFlow>
        </div>
      </div>
    </>
  );
};

export default DiagramFlow;
