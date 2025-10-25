// src/pages/ChannelDiagram/DiagramFlow.jsx
import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import {
    ReactFlow,
    Background,
    Controls
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import api from "../../utils/api";
import "./DiagramFlow.css";



export const DiagramFlow = () => {
    const [edges, setEdges] = useState([]);
    const [nodes, setNodes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [dataChannel, setDataChannel] = useState();
    const [error, setError] = useState("");
    const { id } = useParams();

    const fetchDataFlow = useCallback(async () => {
        try {
            const res = await api.getChannelDiagramById(id);
            console.log(res.data.nodes);
            setNodes(res.data.nodes);
            setEdges(res.data.edges);
            const channel = res.data.signal;
            console.log(nodes);
            console.log(edges);

            console.log(channel);

            setDataChannel(channel);
        } catch (err) {
            console.error("Error al obtener diagrama:", err);
            setError("Error al cargar el diagrama");
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        fetchDataFlow();
    }, [fetchDataFlow]);

    if (loading) return <p>Cargando diagrama...</p>;
    if (error) return <p>{error}</p>;
 

    return (
        <div style={{ width: "100%", height: "90vh" }}>
            <div className="container__header">
                <img
                    className="logo__channel"
                    src={`${dataChannel.logoChannel}`}
                />
                <h3 className="title__channel">{`${dataChannel.nameChannel} - ${dataChannel.tipoTecnologia}`}</h3>
            </div>
            <ReactFlow
                nodes={nodes}
                edges={edges}
                fitView
            >
                <Background />
                <Controls position="top-left" />
            </ReactFlow>
        </div>
    );
};

export default DiagramFlow;
