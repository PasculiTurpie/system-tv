// src/pages/ChannelDiagram/DiagramFlow.jsx
import React, { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import api from "../../utils/api";

export const DiagramFlow = () => {
  const [edges, setEdges] = useState([]);
  const [nodes, setNodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { id } = useParams();

  const fetchDataFlow = useCallback(async () => {
    try {
      const res = await api.getChannelDiagramById(id);
      if (res?.data) {
        setEdges(res.data.edges || []);
        setNodes(res.data.nodes || []);
        console.log("Edges cargados:", res.data.edges);
        console.log("Nodes cargados:", res.data.nodes);
      }
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
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
      >
        <Background />
        <MiniMap />
        <Controls position="top-left"/>
      </ReactFlow>
    </div>
  );
};

export default DiagramFlow;
