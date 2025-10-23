import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import {
  Background,
  Controls,
  MarkerType,
  ReactFlow,
  useEdgesState,
  useNodesState,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import api from "../../utils/api";
import "./ChannelDiagram.css";

import NodeWithHandles from "./NodeWithHandles";
import CustomDirectionalEdge from "./CustomDirectionalEdge";
import {
  getHandlesForNodeType,
  isValidHandle,
  makeHandle,
} from "./handles";

const nodeTypes = {
  default: NodeWithHandles,
  satelite: NodeWithHandles,
  ird: NodeWithHandles,
  switch: NodeWithHandles,
  router: NodeWithHandles,
};

const edgeTypes = {
  customDirectional: CustomDirectionalEdge,
};

const DIRECTION_STYLES = {
  ida: {
    stroke: "#dc2626",
    markerStart: null,
    markerEnd: { type: MarkerType.ArrowClosed, color: "#dc2626" },
  },
  vuelta: {
    stroke: "#16a34a",
    markerStart: { type: MarkerType.ArrowClosed, color: "#16a34a" },
    markerEnd: null,
  },
  bi: {
    stroke: "#2563eb",
    markerStart: { type: MarkerType.ArrowClosed, color: "#2563eb" },
    markerEnd: { type: MarkerType.ArrowClosed, color: "#2563eb" },
  },
};

const DEFAULT_SOURCE_HANDLE = makeHandle("out", "right", 1);
const DEFAULT_TARGET_HANDLE = makeHandle("in", "left", 1);

function withFallbackHandle(handleId, fallback) {
  return isValidHandle(handleId) ? handleId : fallback;
}

function sanitizeNode(node) {
  if (!node || typeof node !== "object") {
    return node;
  }
  const { type } = node;
  const handles = getHandlesForNodeType(type);
  const safeNode = {
    ...node,
    type: type || "default",
    data: { ...node.data },
  };

  // Ensure nodes expose handles in React Flow metadata
  safeNode.data.handles = handles;

  return safeNode;
}

function sanitizeEdge(edge) {
  if (!edge || typeof edge !== "object") {
    return edge;
  }
  const direction = edge?.data?.direction || "ida";
  const styleConfig = DIRECTION_STYLES[direction] || DIRECTION_STYLES.ida;

  return {
    ...edge,
    id: edge.id || `e-${Date.now()}`,
    type: "customDirectional",
    sourceHandle: withFallbackHandle(edge.sourceHandle, DEFAULT_SOURCE_HANDLE),
    targetHandle: withFallbackHandle(edge.targetHandle, DEFAULT_TARGET_HANDLE),
    label: edge.label || "",
    data: {
      labelStart: edge?.data?.labelStart || "",
      labelEnd: edge?.data?.labelEnd || "",
      direction,
    },
    markerStart: styleConfig.markerStart || undefined,
    markerEnd: styleConfig.markerEnd || undefined,
    style: {
      strokeWidth: 2,
      ...(edge.style || {}),
      stroke: styleConfig.stroke,
    },
  };
}

function sanitizeDiagram(diagram) {
  if (!diagram || typeof diagram !== "object") {
    return { nodes: [], edges: [], viewport: null };
  }
  const nodes = Array.isArray(diagram.nodes)
    ? diagram.nodes.map((node) => sanitizeNode(node))
    : [];
  const edges = Array.isArray(diagram.edges)
    ? diagram.edges.map((edge) => sanitizeEdge(edge))
    : [];
  const viewport =
    diagram.viewport && typeof diagram.viewport === "object"
      ? (() => {
          const rawX = Number(diagram.viewport.x);
          const rawY = Number(diagram.viewport.y);
          const rawZoom = Number(diagram.viewport.zoom);
          return {
            x: Number.isFinite(rawX) ? rawX : 0,
            y: Number.isFinite(rawY) ? rawY : 0,
            zoom: Number.isFinite(rawZoom) && rawZoom > 0 ? rawZoom : 1,
          };
        })()
      : null;
  return { nodes, edges, viewport };
}

export default function ChannelDiagram({ channelId: channelIdProp } = {}) {
  const { id: routeChannelId } = useParams();
  const channelId = channelIdProp ?? routeChannelId ?? null;

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(Boolean(channelId));
  const [error, setError] = useState(null);
  const [viewportState, setViewportState] = useState(null);
  const [didApplyViewport, setDidApplyViewport] = useState(false);

  const flowRef = useRef(null);

  const fetchDiagram = useCallback(async () => {
    if (!channelId) {
      setNodes([]);
      setEdges([]);
      setViewportState(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await api.getChannelDiagram(channelId);
      const payload = sanitizeDiagram(response || {});
      setNodes(payload.nodes);
      setEdges(payload.edges);
      setViewportState(payload.viewport);
      setDidApplyViewport(false);
    } catch (err) {
      console.error("Failed to load channel diagram", err);
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "No se pudo cargar el diagrama"
      );
      setNodes([]);
      setEdges([]);
      setViewportState(null);
    } finally {
      setLoading(false);
    }
  }, [channelId, setEdges, setNodes]);

  useEffect(() => {
    fetchDiagram();
  }, [fetchDiagram]);

  const handleInit = useCallback((instance) => {
    flowRef.current = instance;
  }, []);

  useEffect(() => {
    if (didApplyViewport) return;
    if (!flowRef.current) return;
    if (loading) return;
    if (!nodes.length && !edges.length) return;

    if (viewportState && typeof viewportState === "object") {
      flowRef.current.setViewport(viewportState, { duration: 0 });
    } else {
      flowRef.current.fitView({ padding: 0.2, duration: 300 });
    }
    setDidApplyViewport(true);
  }, [didApplyViewport, edges.length, loading, nodes.length, viewportState]);

  const handleConnect = useCallback(
    (connection) => {
      if (!connection?.source || !connection?.target) {
        return;
      }
      setEdges((prev) => {
        const nextEdge = sanitizeEdge({
          id: `e-${Date.now()}`,
          source: connection.source,
          target: connection.target,
          sourceHandle:
            connection.sourceHandle || DEFAULT_SOURCE_HANDLE,
          targetHandle:
            connection.targetHandle || DEFAULT_TARGET_HANDLE,
          data: { direction: "ida", labelStart: "", labelEnd: "" },
          label: "",
        });
        return [...prev, nextEdge];
      });
    },
    [setEdges]
  );

  const onMoveEnd = useCallback((_event, viewport) => {
    if (viewport) {
      setViewportState(viewport);
    }
  }, []);

  const isEmpty = useMemo(
    () => !nodes.length && !edges.length,
    [nodes.length, edges.length]
  );

  return (
    <div className="channel-diagram__container" style={{ height: "100%", width: "100%" }}>
      {error ? (
        <div className="channel-diagram__error">{error}</div>
      ) : null}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={handleConnect}
        onInit={handleInit}
        onMoveEnd={onMoveEnd}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#e2e8f0" gap={16} />
        <Controls position="top-left" />
      </ReactFlow>
      {loading ? (
        <div className="channel-diagram__loading">Cargando diagrama…</div>
      ) : null}
      {!loading && isEmpty ? (
        <div className="channel-diagram__empty">No hay elementos en el diagrama.</div>
      ) : null}
    </div>
  );
}
