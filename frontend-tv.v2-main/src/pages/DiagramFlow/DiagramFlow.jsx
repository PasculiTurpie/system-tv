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
import CustomNode from "./CustomNode";
import DraggableDirectionalEdge from "./DraggableDirectionalEdge";
// ⚠️ Revisa el nombre real del archivo: "constants" vs "contants"
import dataFlow from "../../utils/contants";

// --- Config: alterna entre API real y MOCK local ---
const USE_MOCK = true; // pon en false para usar API real

// Tipos de nodo (asegúrate que tus nodos tienen type: "imageNode")
const nodeTypes = {
    imageNode: CustomNode,
};

const edgeTypes = {
    draggableDirectional: DraggableDirectionalEdge,
};

export const DiagramFlow = () => {
    const { id } = useParams();
    const navigate = useNavigate();

    // ✅ Arrays (no strings) para React Flow
    const [nodes, setNodes] = useState([]);
    const [edges, setEdges] = useState([]);

    const [dataChannel, setDataChannel] = useState(null);
    const [loading, setLoading] = useState(!USE_MOCK); // si usamos mock, no partimos en loading
    const [error, setError] = useState("");

    // --- Carga desde API ---
    const fetchDataFlow = useCallback(async () => {
        try {
            setLoading(true);
            const res = await api.getChannelDiagramById(id);

            // Estructura esperada: { nodes: [], edges: [], signal: { ... } }
            const nodesRes = Array.isArray(res?.data?.nodes)
                ? res.data.nodes
                : [];
            const edgesRes = Array.isArray(res?.data?.edges)
                ? res.data.edges
                : [];
            const channelRes = res?.data?.signal ?? null;

            setNodes(nodesRes);
            setEdges(edgesRes);
            setDataChannel(channelRes);
            setError("");
        } catch (err) {
            console.error("Error al obtener diagrama:", err);
            setError("Error al cargar el diagrama");
        } finally {
            setLoading(false);
        }
    }, [id]);

    // --- Carga desde MOCK ---
    const loadMock = useCallback(() => {
        // Estructura esperada en dataFlow: { nodes: [], edges: [], logoChannel, nameChannel, tipoTecnologia }
        setNodes(Array.isArray(dataFlow?.nodes) ? dataFlow.nodes : []);
        setEdges(Array.isArray(dataFlow?.edges) ? dataFlow.edges : []);
        setDataChannel({
            logoChannel: dataFlow?.logoChannel,
            nameChannel: dataFlow?.nameChannel,
            tipoTecnologia: dataFlow?.tipoTecnologia,
        });
        setError("");
        setLoading(false);
    }, []);

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

    const onConnect = useCallback((params) => {
        setEdges((prev) => addEdge(params, prev));
    }, []);

    const handleBackSubmit = () => navigate(-1);

    // --- Render ---
    if (loading) return <p>Cargando diagrama...</p>;
    if (error) return <p>{error}</p>;

    const logo =
        dataChannel?.logoChannel ||
        "https://via.placeholder.com/100x60?text=LOGO";
    const titulo =
        (dataChannel?.nameChannel || "Canal sin nombre") +
        (dataChannel?.tipoTecnologia ? ` - ${dataChannel.tipoTecnologia}` : "");

    return (
        <>
            <div className="outlet-main">
                <div className="container__header">
                    <img
                        className="logo__channel"
                        src={dataChannel?.logoChannel}
                    />
                    <h3 className="title__channel">{titulo}</h3>
                </div>
                <button className="button__back" onClick={handleBackSubmit}>
                    ← Volver
                </button>
                <div
                    className="conatiner__flow"
                    style={{ width: "83vw", height: "100vh" }}
                >
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
