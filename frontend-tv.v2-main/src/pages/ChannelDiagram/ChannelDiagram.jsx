import { useEffect, useMemo, useState, useCallback, useRef, useContext } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useEdgesState,
  useNodesState,
  addEdge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useParams } from "react-router-dom";
import api from "../../utils/api";
import CustomNode from "./CustomNode";
import RouterNode from "./RouterNode";
import CustomDirectionalEdge from "./CustomDirectionalEdge";
import CustomWaypointEdge from "./CustomWaypointEdge";
import "./ChannelDiagram.css";
import { UserContext } from "../../components/context/UserContext";
import NodeEquipmentSidebar from "./NodeEquipmentSidebar";

/* ───────── utils ───────── */

const ARROW_CLOSED = { type: "arrowclosed" };

const toNumberOr = (val, def = 0) => {
  const n = Number(val);
  return Number.isFinite(n) ? n : def;
};

const normalizeMarker = (m) => {
  if (!m || typeof m !== "object") return { type: "arrowclosed" };
  const t = m.type;
  if (t === "arrowclosed" || t === "arrow") return { ...m };
  if (t === 1 || t === "1") return { ...m, type: "arrowclosed" };
  if (t === 0 || t === "0") return { ...m, type: "arrow" };
  return { ...m, type: "arrowclosed" };
};

const getEdgeColor = (style, direction) =>
  style?.stroke || (direction === "vuelta" ? "green" : "red");

const withMarkerColor = (marker, color) => ({
  ...normalizeMarker(marker || ARROW_CLOSED),
  color,
});

const safeArray = (val) => (Array.isArray(val) ? val : []);

/* Map API → React Flow */
const mapNodeFromApi = (node) => {
  if (!node) return null;
  const id = String(node.id ?? node._id ?? node.key ?? "");
  if (!id) return null;

  const rawData = node.data || {};
  const getPos = (val, index) => {
    if (val !== undefined && val !== null) return val;
    if (Array.isArray(node.position)) return node.position[index];
    return undefined;
  };

  return {
    id,
    type: node.type || "custom",
    data: { label: rawData.label || node.label || id, ...rawData },
    position: {
      x: toNumberOr(getPos(node.position?.x, 0), 0),
      y: toNumberOr(getPos(node.position?.y, 1), 0),
    },
  };
};

const mapEdgeFromApi = (edge) => {
  if (!edge) return null;
  const id = String(edge.id ?? edge._id ?? "");
  if (!id || !edge.source || !edge.target) return null;

  const rawData = edge.data || {};
  const direction = rawData.direction || (edge.style?.stroke === "green" ? "vuelta" : "ida");
  const label = edge.label || rawData.label || id;

  const color = getEdgeColor(edge.style, direction);
  const style = edge.style
    ? { ...edge.style, stroke: edge.style.stroke || color }
    : { stroke: color, strokeWidth: 2 };

  return {
    id,
    source: String(edge.source),
    target: String(edge.target),
    sourceHandle: edge.sourceHandle,
    targetHandle: edge.targetHandle,
    type: edge.type || "directional",
    label,
    data: { ...rawData, label, direction },
    style,
    markerEnd: withMarkerColor(edge.markerEnd, color),
    markerStart: edge.markerStart ? withMarkerColor(edge.markerStart, color) : undefined,
    animated: edge.animated ?? true,
    updatable: true,
  };
};

/* Normalización → payload API */
const toApiNode = (node) => ({
  id: node.id,
  type: node.type || "custom",
  label: node.data?.label ?? node.label ?? node.id,
  data: { ...(node.data || {}), label: node.data?.label ?? node.label ?? node.id },
  position: {
    x: Number.isFinite(+node.position?.x) ? +node.position.x : 0,
    y: Number.isFinite(+node.position?.y) ? +node.position.y : 0,
  },
});

const toApiEdge = (edge) => {
  const label = edge.data?.label || edge.label || edge.id;
  const direction = edge.data?.direction || "ida";
  const color = getEdgeColor(edge.style, direction);
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle,
    targetHandle: edge.targetHandle,
    label,
    type: edge.type || "directional",
    style: edge.style || { stroke: color, strokeWidth: 2 },
    markerEnd: withMarkerColor(edge.markerEnd, color),
    markerStart: edge.markerStart ? withMarkerColor(edge.markerStart, color) : undefined,
    data: { ...(edge.data || {}), label, direction },
    animated: true,
    updatable: true,
  };
};

/* ───────── componente ───────── */

const ChannelDiagram = () => {
  const { id: signalId } = useParams();

  const nodeTypes = useMemo(
    () => ({
      custom: CustomNode,
      router: RouterNode,
    }),
    []
  );

  const edgeTypes = useMemo(
    () => ({
      directional: CustomDirectionalEdge,
      waypoint: CustomWaypointEdge,
    }),
    []
  );

  const { isAuth } = useContext(UserContext);
  const isReadOnly = !isAuth;

  const [loading, setLoading] = useState(true);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [error, setError] = useState(null);
  const [channelId, setChannelId] = useState(null);
  const [selectedNodeId, setSelectedNodeId] = useState(null);

  // refs para leer el estado más reciente dentro del debounce
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);
  useEffect(() => {
    edgesRef.current = edges;
  }, [edges]);

  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedNodeId) || null,
    [nodes, selectedNodeId]
  );

  const saveTimer = useRef(null);

  // Guardado (debounced) usando tu API
  const saveDiagram = useCallback(async () => {
    if (!channelId || !signalId) return;
    const payload = {
      signal: String(signalId),
      channel: String(channelId),
      signalId: String(signalId),
      channelId: String(channelId),
      nodes: nodesRef.current.map(toApiNode),
      edges: edgesRef.current.map(toApiEdge),
    };
    try {
      await api.updateChannelFlow(channelId, payload);
      // console.log("Diagrama guardado");
    } catch (e) {
      console.error("Error al guardar diagrama:", e);
    }
  }, [channelId, signalId]);

  const requestSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(saveDiagram, 500); // debounce 500ms
  }, [saveDiagram]);

  useEffect(() => {
    const handleFlowSave = () => {
      if (!isAuth) return;
      requestSave();
    };

    window.addEventListener("flow:save", handleFlowSave);
    return () => {
      window.removeEventListener("flow:save", handleFlowSave);
    };
  }, [isAuth, requestSave]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await api.getChannelDiagramBySignal(String(signalId).trim());
        const data = res?.data ?? res;
        const dataChannelDiagram = Array.isArray(data) ? data[0] : data;
        if (!dataChannelDiagram) throw new Error("No existen diagramas para la señal indicada.");

        setChannelId(String(dataChannelDiagram._id));

        const mappedNodes = safeArray(dataChannelDiagram.nodes).map(mapNodeFromApi).filter(Boolean);
        const mappedEdges = safeArray(dataChannelDiagram.edges).map(mapEdgeFromApi).filter(Boolean);

        if (cancelled) return;
        setNodes(mappedNodes);
        setEdges(mappedEdges);
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || "Error al cargar el diagrama");
          setNodes([]);
          setEdges([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [signalId, setNodes, setEdges]);

  /* ───────── Handlers edición ───────── */

  // Drag de nodos: guardamos al soltar
  const handleNodeDragStop = useCallback(() => {
    if (!isAuth) return;
    requestSave();
  }, [isAuth, requestSave]);

  // Reconexión de edges
  const handleEdgeUpdate = useCallback(
    (oldEdge, newConnection) => {
      if (!isAuth) return;
      setEdges((eds) =>
        eds.map((e) =>
          e.id === oldEdge.id
            ? {
              ...e,
              source: newConnection.source,
              target: newConnection.target,
              sourceHandle: newConnection.sourceHandle,
              targetHandle: newConnection.targetHandle,
              updatable: true,
            }
            : e
        )
      );
      requestSave();
    },
    [isAuth, setEdges, requestSave]
  );

  // Crear nuevos edges
  const handleConnect = useCallback(
    (connection) => {
      if (!isAuth) return;
      const direction = "ida";
      const color = getEdgeColor(undefined, direction);
      setEdges((eds) =>
        addEdge(
          {
            ...connection,
            id: `edge-${Date.now()}`,
            type: "directional",
            data: { label: connection.label || "", direction },
            label: connection.label || "",
            style: { stroke: color, strokeWidth: 2 },
            markerEnd: withMarkerColor(undefined, color),
            animated: true,
            updatable: true,
          },
          eds
        )
      );
      requestSave();
    },
    [isAuth, setEdges, requestSave]
  );

  // Passthrough para que React Flow actualice posiciones
  const handleNodesChange = useCallback((changes) => onNodesChange(changes), [onNodesChange]);
  const handleEdgesChange = useCallback((changes) => onEdgesChange(changes), [onEdgesChange]);

  const handleNodeClick = useCallback((_, node) => {
    setSelectedNodeId(node?.id ?? null);
  }, []);

  const handlePaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, []);

  const handleSelectionChange = useCallback((selection) => {
    const node = Array.isArray(selection?.nodes) ? selection.nodes[0] : null;
    setSelectedNodeId(node?.id ?? null);
  }, []);

  /* ───────── Render ───────── */

  if (loading) {
    return (
      <div style={{ width: "100%", height: "100vh", position: "relative" }}>
        <div className="diagram-overlay">Cargando diagrama…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ width: "100%", height: "100vh", position: "relative" }}>
        <div className="diagram-overlay">{error}</div>
      </div>
    );
  }

  return (
    <div className="channel-diagram__wrapper">
      <div className="channel-diagram__layout">
        <div className="channel-diagram__canvas">
          {isReadOnly && (
            <div className="diagram-readonly-banner">
              Modo solo lectura.
            </div>
          )}
          <ReactFlow
            className="channel-diagram__flow"
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            nodesDraggable={isAuth}
            nodesConnectable={isAuth}
            elementsSelectable={true}
            edgesUpdatable={isAuth}
            edgeUpdaterRadius={20}
            onNodeDragStop={handleNodeDragStop}
            onEdgeUpdate={handleEdgeUpdate}
            onConnect={handleConnect}
            onNodesChange={handleNodesChange}
            onEdgesChange={handleEdgesChange}
            onNodeClick={handleNodeClick}
            onPaneClick={handlePaneClick}
            onSelectionChange={handleSelectionChange}
            fitView
          >
            <Background variant="dots" gap={16} size={1} />
            <Controls position="bottom-right" />
            <MiniMap />
          </ReactFlow>
        </div>
        <NodeEquipmentSidebar node={selectedNode} />
      </div>
    </div>
  );
};

export default ChannelDiagram;
