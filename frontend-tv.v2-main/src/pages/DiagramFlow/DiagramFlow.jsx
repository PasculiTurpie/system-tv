// src/pages/ChannelDiagram/DiagramFlow.jsx
import React, { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { ReactFlow, Background, Controls } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import CustomDirectionalEdge from "./CustomDirectionalEdges.jsx";
import api from "../../utils/api";
import './DiagramFlow.css'

const edgeTypes = {
    directional: CustomDirectionalEdge,
};

// Normaliza edges que vienen desde la API a lo que espera React Flow + tu edge custom
function normalizeEdges(apiEdges = []) {
    return apiEdges.map((e, idx) => {
        const direction = e.direction ?? e?.data?.direction ?? "ida"; // ida | vuelta
        const baseStroke =
            e?.style?.stroke ?? (direction === "vuelta" ? "green" : "red");

        return {
            id: e.id ?? `edge-${idx + 1}`,
            type: e.type || "directional",
            source: e.source,
            target: e.target,
            sourceHandle: e.sourceHandle,
            targetHandle: e.targetHandle,
            // style explícito (permite override desde API)
            style: {
                stroke: baseStroke,
                strokeWidth: e?.style?.strokeWidth ?? 2,
                ...(e?.style || {}),
            },
            // Pasa labels y metadatos por data para el edge custom
            data: {
                label: e.label ?? e?.data?.label ?? "",
                labelStart: e.labelStart ?? e?.data?.labelStart ?? "",
                labelEnd: e.labelEnd ?? e?.data?.labelEnd ?? "",
                labelPosition: e.labelPosition ?? e?.data?.labelPosition, // {x, y} opcional
                direction, // "ida" | "vuelta"
            },
            // Opcional: si tu backend ya guarda markerStart/markerEnd puedes pasarlos acá
            markerStart: e.markerStart,
            markerEnd: e.markerEnd,
        };
    });
}

// Normaliza nodos por si faltan mínimos
function normalizeNodes(apiNodes = []) {
    return apiNodes.map((n, idx) => ({
        id: n.id ?? n._id ?? `node-${idx + 1}`,
        type: n.type ?? "default",
        position: n.position ?? { x: 0, y: 0 },
        data: n.data ?? { label: n.label ?? n.name ?? `Nodo ${idx + 1}` },
        width: n.width,
        height: n.height,
        style: n.style,
        parentNode: n.parentNode,
        extent: n.extent,
        draggable: n.draggable,
        selected: n.selected,
        hidden: n.hidden,
    }));
}

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
            const apiNodes = res?.data?.nodes ?? [];
            const apiEdges = res?.data?.edges ?? [];
            const channel = res.data.signal;
            const nfNodes = normalizeNodes(apiNodes);
            const nfEdges = normalizeEdges(apiEdges);

console.log(channel)

            setNodes(nfNodes);
            setEdges(nfEdges);
            setDataChannel(channel);

            console.log("Nodes cargados (norm):", nfNodes);
            console.log("Edges cargados (norm):", nfEdges);
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
                <h3 className="title__channel">{`${dataChannel.nameChannel} - ${dataChannel.tipoTecnologia}`}</h3>
            </div>
            <ReactFlow
                nodes={nodes}
                edges={edges}
                edgeTypes={edgeTypes} // <-- usa tu CustomDirectionalEdge
                fitView
            >
                <Background />
                <Controls position="top-left" />
            </ReactFlow>
        </div>
    );
};

export default DiagramFlow;
