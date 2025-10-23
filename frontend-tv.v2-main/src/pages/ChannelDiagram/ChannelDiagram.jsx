// src/pages/ChannelDiagram/ChannelDiagram.jsx
import React, {
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
  useContext,
} from "react";
import { useParams } from "react-router-dom";
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

import api from "../../utils/api";
import "./ChannelDiagram.css";

import CustomNode from "./CustomNode";
import RouterNode from "./RouterNode";
import SateliteNode from "./nodes/SateliteNode";
import IrdNode from "./nodes/IrdNode";
import SwitchNode from "./nodes/SwitchNode";
import CustomDirectionalEdge from "./CustomDirectionalEdge";
import CustomWaypointEdge from "./CustomWaypointEdge";

import { UserContext } from "../../components/context/UserContext.jsx";

import {
  prepareDiagramState,
  ensureRouterTemplateEdges,
  toApiNode,
  toApiEdge,
  createPatchScheduler,
} from "./diagramUtils";
import { ensureEdgeHandlesForNodes, ensureHandleId } from "./handleStandard.js";

import { DiagramContext } from "./DiagramContext";

/* ===================== Tipos de nodos / edges ===================== */
const nodeTypes = {
  custom: CustomNode,
  router: RouterNode,
  satelite: SateliteNode,
  ird: IrdNode,
  switch: SwitchNode,
};

const edgeTypes = {
  directional: CustomDirectionalEdge,
  waypoint: CustomWaypointEdge,
};

/* ===================== Panel de información del nodo ===================== */
function NodeInfoPanel({ node, equipoIndex, onClose }) {
  if (!node) return null;

  const equipoId =
    node.data?.equipoId || node.equipo || node.data?.equipo || null;

  const equipo =
    equipoIndex?.get?.(String(equipoId)) ||
    null;

  const isIRD =
    (node.type === "ird") ||
    (node.data?.type === "ird") ||
    (node.data?.equipoTipo === "ird") ||
    (equipo?.tipoNombre && String(equipo.tipoNombre).toLowerCase() === "ird");

  return (
    <aside
      className="chd__node-panel"
      style={{
        position: "absolute",
        right: 12,
        top: 12,
        width: 320,
        maxHeight: "85vh",
        overflow: "auto",
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        boxShadow: "0 8px 30px rgba(0,0,0,.08)",
        padding: 14,
        zIndex: 9,
      }}
      aria-live="polite"
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <h3 style={{ margin: 0, fontSize: 16 }}>Información del nodo</h3>
        <button
          type="button"
          onClick={onClose}
          title="Cerrar panel"
          aria-label="Cerrar panel"
          style={{
            border: "1px solid #e5e7eb",
            background: "#fff",
            borderRadius: 8,
            padding: "4px 8px",
            cursor: "pointer",
          }}
        >
          ✕
        </button>
      </div>

      <div style={{ marginTop: 10 }}>
        <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6 }}>Nodo</div>
        <div style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "6px 8px" }}>
          {node.id}
        </div>
        <div style={{ marginTop: 8 }}>
          <div><b>Etiqueta:</b> {node.data?.label || "—"}</div>
          <div><b>Tipo:</b> {node.type || node.data?.type || "custom"}</div>
          <div><b>EquipoId:</b> {equipoId || "—"}</div>
          <div><b>Posición:</b> x: {Number(node.position?.x ?? 0)}, y: {Number(node.position?.y ?? 0)}</div>
        </div>
      </div>

      <hr style={{ border: 0, borderTop: "1px solid #f1f5f9", margin: "12px 0" }} />

      <div>
        <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6 }}>Equipo</div>
        {!equipo ? (
          <div style={{ color: "#64748b" }}>No hay datos de equipo.</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 6 }}>
            <div><b>Nombre:</b> {equipo?.nombre || "—"}</div>
            <div><b>Tipo:</b> {equipo?.tipoNombre || equipo?.tipo || node.data?.equipoTipo || "—"}</div>
            {equipo?.satelliteRef?.satelliteType?.typePolarization ? (
              <div><b>Polarización:</b> {String(equipo.satelliteRef.satelliteType.typePolarization)}</div>
            ) : null}
            {equipo?.marca ? <div><b>Marca:</b> {equipo.marca}</div> : null}
            {equipo?.modelo ? <div><b>Modelo:</b> {equipo.modelo}</div> : null}
            {equipo?.serie ? <div><b>Serie:</b> {equipo.serie}</div> : null}
          </div>
        )}
      </div>

      {isIRD ? (
        <>
          <hr style={{ border: 0, borderTop: "1px solid #f1f5f9", margin: "12px 0" }} />
          <div>
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6 }}>IRD</div>
            <div style={{ color: "#111827" }}>
              {/* Si tienes campos específicos del IRD, colócalos aquí. */}
              {equipo?.irdInfo ? (
                <pre style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: 8, overflow: "auto" }}>
                  {JSON.stringify(equipo.irdInfo, null, 2)}
                </pre>
              ) : (
                <span>Sin información detallada de IRD.</span>
              )}
            </div>
          </div>
        </>
      ) : null}
    </aside>
  );
}

/* ===================== Componente principal ===================== */
export default function ChannelDiagram({
  channelId: channelIdProp,
  isAuthenticated: isAuthenticatedProp,
} = {}) {
  const { id: routeChannelId } = useParams();
  const { isAuth: contextIsAuth } = useContext(UserContext) || {};

  const channelId = channelIdProp ?? routeChannelId ?? null;
  const isAuthenticated =
    typeof isAuthenticatedProp === "boolean"
      ? isAuthenticatedProp
      : !!contextIsAuth;

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(!!channelId);
  const [error, setError] = useState(null);

  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [equipoIndex, setEquipoIndex] = useState(() => new Map());

  const flowRef = useRef(null);

  /* -------- flags de interacción según autenticación -------- */
  const isReadOnly = !isAuthenticated; // Se propaga al DiagramContext y a los nodos/edges
  const interactivity = useMemo(
    () => ({
      nodesDraggable: isAuthenticated,
      nodesConnectable: isAuthenticated,
      elementsSelectable: isAuthenticated,
      selectionOnDrag: isAuthenticated,
      panOnDrag: !isAuthenticated ? [1] : true, // en lectura, arrastrar siempre panea
      panOnScroll: true,
      zoomOnScroll: true,
      zoomOnPinch: true,
    }),
    [isAuthenticated]
  );

  const edgeInteractivity = useMemo(
    () => ({ updatable: isAuthenticated }),
    [isAuthenticated]
  );

  useEffect(() => {
    setEdges((prev) =>
      prev.map((edge) =>
        edge?.updatable === isAuthenticated ? edge : { ...edge, updatable: isAuthenticated }
      )
    );
  }, [isAuthenticated, setEdges]);

  /* ===================== Persistencia y helpers ===================== */

  const applyEdgePatchInMemory = useCallback(
    (patch) => {
      setEdges((prev) => {
        const byId = new Map(prev.map((e) => [e.id, { ...e, data: { ...(e.data || {}) } }]));
        Object.entries(patch || {}).forEach(([edgeId, changes]) => {
          const e = byId.get(edgeId);
          if (!e) return;
          Object.entries(changes || {}).forEach(([k, v]) => {
            if (k === "labelPosition" || k === "multicastPosition") {
              e.data[k] = { ...v };
            } else if (k === "endpointLabelPositions") {
              const current = e.data.endpointLabelPositions || {};
              e.data.endpointLabelPositions = {
                ...current,
                ...(v?.source ? { source: { ...v.source } } : {}),
                ...(v?.target ? { target: { ...v.target } } : {}),
              };
            } else if (k === "label") {
              e.data.label = v;
              e.label = v;
            } else {
              e.data[k] = v;
            }
          });
        });
        return Array.from(byId.values());
      });
    },
    [setEdges]
  );

  const applyNodePatchInMemory = useCallback(
    (patch) => {
      setNodes((prev) => {
        const byId = new Map(prev.map((n) => [n.id, { ...n, data: { ...(n.data || {}) } }]));
        Object.entries(patch || {}).forEach(([nodeId, changes]) => {
          const n = byId.get(nodeId);
          if (!n) return;
          Object.entries(changes || {}).forEach(([k, v]) => {
            if (k === "labelPosition" || k === "multicastPosition") {
              n.data[k] = { ...v };
            } else if (k === "handles" && Array.isArray(v)) {
              n.data.handles = v.map((h) => ({ ...h }));
            } else if (k === "label") {
              n.data.label = v;
            } else if (k === "position") {
              n.position = { x: Number(v?.x ?? 0), y: Number(v?.y ?? 0) };
            } else {
              n.data[k] = v;
            }
          });
        });
        return Array.from(byId.values());
      });
    },
    [setNodes]
  );

  const buildApiPayload = useCallback(() => {
    const apiNodes = nodes.map(toApiNode);
    const apiEdges = edges.map(toApiEdge);
    return { nodes: apiNodes, edges: apiEdges };
  }, [nodes, edges]);

  const scheduler = useMemo(
    () =>
      createPatchScheduler(async (_key, patch) => {
        // Si no está autenticado, no persistimos (pero actualizamos memoria por consistencia visual)
        if (patch?.nodes) applyNodePatchInMemory(patch.nodes);
        if (patch?.edges) applyEdgePatchInMemory(patch.edges);
        if (!isAuthenticated) return;

        const payload = buildApiPayload();
        await api.updateChannelDiagram(channelId, payload);
      }),
    [applyNodePatchInMemory, applyEdgePatchInMemory, buildApiPayload, channelId, isAuthenticated]
  );

  /* ===================== Carga inicial ===================== */

  // Diagrama
  useEffect(() => {
    let active = true;
    if (!channelId) {
      setLoading(false);
      return;
    }

    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await api.getChannelDiagramById(channelId);
        const payload = Array.isArray(res?.data) ? res.data[0] : res?.data ?? res;
        const { nodes: n, edges: e } = prepareDiagramState(payload);
        if (!active) return;
        setNodes(n);
        setEdges(e);
      } catch (err) {
        if (!active) return;
        setError(err?.response?.data?.message || err?.response?.data?.error || err?.message || "Error al cargar el diagrama.");
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [channelId, setNodes, setEdges]);

  // Índice de equipos para panel de info
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await api.getEquipo?.();
        const arr = Array.isArray(res?.data) ? res.data : [];
        if (!mounted) return;
        const idx = new Map();
        arr.forEach((eq) => {
          if (eq?._id) idx.set(String(eq._id), eq);
        });
        setEquipoIndex(idx);
      } catch {
        // Silencioso: si falla, el panel muestra "sin datos"
      }
    })();
    return () => { mounted = false; };
  }, []);

  /* ===================== Autoedges para routers ===================== */
  const materializeRouterTemplates = useCallback(
    (opts = { force: false }) => {
      setEdges((prev) => {
        let next = [...prev];
        let changed = false;

        nodes.forEach((node) => {
          const { toAdd, toRemove } = ensureRouterTemplateEdges(node, next, { force: !!opts.force });
          if (toRemove?.length) {
            const ids = new Set(toRemove.map((e) => e.id));
            next = next.filter((e) => !ids.has(e.id));
            changed = true;
          }
          if (toAdd?.length) {
            next = [...next, ...toAdd];
            changed = true;
          }
        });

        return changed ? next : prev;
      });
    },
    [nodes, setEdges]
  );

  useEffect(() => {
    if (nodes.length > 0) materializeRouterTemplates({ force: false });
  }, [nodes, materializeRouterTemplates]);

  /* ===================== Eventos ReactFlow ===================== */

  const onConnect = useCallback(
    (params) => {
      if (!isAuthenticated) return; // bloqueo en lectura

      const sourceNode = nodes.find((n) => String(n.id) === String(params.source));
      const targetNode = nodes.find((n) => String(n.id) === String(params.target));

      const baseHandles = {
        sourceHandle: ensureHandleId(params.sourceHandle),
        targetHandle: ensureHandleId(params.targetHandle),
      };

      const ensuredHandles = ensureEdgeHandlesForNodes(
        { sourceHandle: baseHandles.sourceHandle, targetHandle: baseHandles.targetHandle },
        sourceNode,
        targetNode,
        baseHandles
      );

      const sanitizedHandles = {};
      const sourceHandle = ensuredHandles.sourceHandle || baseHandles.sourceHandle;
      const targetHandle = ensuredHandles.targetHandle || baseHandles.targetHandle;
      if (sourceHandle) sanitizedHandles.sourceHandle = sourceHandle;
      if (targetHandle) sanitizedHandles.targetHandle = targetHandle;

      const newEdge = {
        ...params,
        ...sanitizedHandles,
        type: "directional",
      };

      setEdges((eds) => addEdge(newEdge, eds));
      // Generamos un id en caso de que ReactFlow aún no lo haya asignado
      const edgeId = newEdge.id || crypto.randomUUID();
      scheduler.schedule(channelId, { edges: { [edgeId]: newEdge } });
    },
    [
      channelId,
      isAuthenticated,
      nodes,
      scheduler,
      setEdges,
    ]
  );

  const handleNodeDragStop = useCallback(
    (_, node) => {
      if (!isAuthenticated) return; // bloqueo en lectura
      scheduler.schedule(channelId, { nodes: { [node.id]: { position: node.position } } });
    },
    [scheduler, channelId, isAuthenticated]
  );

  const handleForceTemplates = useCallback(() => {
    if (!isAuthenticated) return; // no regenerar en lectura
    materializeRouterTemplates({ force: true });
  }, [materializeRouterTemplates, isAuthenticated]);

  const handleNodeClick = useCallback((_, nd) => {
    setSelectedNodeId(nd?.id || null);
  }, []);

  const handlePaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, []);

  /* ===================== Contexto del diagrama (respeta auth) ===================== */

  const guard = useCallback(
    (fn) => (...args) => {
      if (!isAuthenticated) return; // ignora en modo lectura
      return fn?.(...args);
    },
    [isAuthenticated]
  );

  const onNodeLabelChange = guard((nodeId, label) => {
    setNodes((prev) =>
      prev.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, label } } : n))
    );
    scheduler.schedule(channelId, { nodes: { [nodeId]: { label } } });
  });

  const onNodeHandlesChange = guard((nodeId, handles, options = {}) => {
    const prevHandles = nodes.find((n) => n.id === nodeId)?.data?.handles || [];
    setNodes((prev) =>
      prev.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, handles } } : n))
    );
    scheduler.schedule(
      channelId,
      { nodes: { [nodeId]: { handles } } },
      {
        onError: () => {
          // rollback
          setNodes((prev) =>
            prev.map((n) =>
              n.id === nodeId ? { ...n, data: { ...n.data, handles: prevHandles } } : n
            )
          );
          options?.onError?.();
        },
        onSuccess: options?.onSuccess,
      }
    );
  });

  const onEdgeLabelChange = guard((edgeId, label) => {
    setEdges((prev) =>
      prev.map((e) => (e.id === edgeId ? { ...e, data: { ...e.data, label }, label } : e))
    );
    scheduler.schedule(channelId, { edges: { [edgeId]: { label } } });
  });

  const onEdgeLabelPositionChange = guard((edgeId, position) => {
    setEdges((prev) =>
      prev.map((e) =>
        e.id === edgeId ? { ...e, data: { ...e.data, labelPosition: position } } : e
      )
    );
    scheduler.schedule(channelId, { edges: { [edgeId]: { labelPosition: position } } });
  });

  const onEdgeEndpointLabelChange = guard((edgeId, endpoint, value) => {
    setEdges((prev) =>
      prev.map((e) => {
        if (e.id !== edgeId) return e;
        const labels = { ...(e.data?.endpointLabels || {}) };
        labels[endpoint] = value;
        return { ...e, data: { ...e.data, endpointLabels: labels } };
      })
    );
    scheduler.schedule(channelId, { edges: { [edgeId]: {} } });
  });

  const onEdgeEndpointLabelPositionChange = guard((edgeId, endpoint, position) => {
    scheduler.schedule(channelId, {
      edges: { [edgeId]: { endpointLabelPositions: { [endpoint]: position } } },
    });
  });

  const onEdgeEndpointLabelPersist = guard((edgeId, endpoint, position) => {
    scheduler.schedule(channelId, {
      edges: { [edgeId]: { endpointLabelPositions: { [endpoint]: position } } },
    });
  });

  const onEdgeMulticastPositionChange = guard((edgeId, position) => {
    scheduler.schedule(channelId, { edges: { [edgeId]: { multicastPosition: position } } });
  });

  const persistLabelPositions = guard((patch) => {
    scheduler.schedule(channelId, patch);
  });

  const contextValue = useMemo(
    () => ({
      isReadOnly,
      onNodeLabelChange,
      onNodeHandlesChange,
      onEdgeLabelChange,
      onEdgeLabelPositionChange,
      onEdgeEndpointLabelChange,
      onEdgeEndpointLabelPositionChange,
      onEdgeEndpointLabelPersist,
      onEdgeMulticastPositionChange,
      persistLabelPositions,
    }),
    [
      isReadOnly,
      onNodeLabelChange,
      onNodeHandlesChange,
      onEdgeLabelChange,
      onEdgeLabelPositionChange,
      onEdgeEndpointLabelChange,
      onEdgeEndpointLabelPositionChange,
      onEdgeEndpointLabelPersist,
      onEdgeMulticastPositionChange,
      persistLabelPositions,
    ]
  );

  /* ===================== UI ===================== */
  if (loading) return <div className="chd__status chd__status--info">Cargando diagrama…</div>;
  if (error) return <div className="chd__status chd__status--error">{error}</div>;

  const selectedNode = selectedNodeId
    ? nodes.find((n) => String(n.id) === String(selectedNodeId))
    : null;

  return (
    <DiagramContext.Provider value={contextValue}>
      <div
        className="channel-diagram__container"
        style={{ width: "100%", height: "90vh", position: "relative" }}
      >
        {/* Barra superior */}
        <div className="channel-diagram__toolbar" style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            className="chd__btn chd__btn--secondary"
            onClick={handleForceTemplates}
            disabled={!isAuthenticated}
            title={isAuthenticated ? "Regenerar edges plantilla de routers" : "Requiere autenticación"}
          >
            ↻ Regenerar edges router
          </button>

          {!isAuthenticated && (
            <span
              className="chd__badge chd__badge--muted"
              style={{
                marginLeft: "auto",
                padding: "6px 10px",
                borderRadius: 8,
                background: "#f1f5f9",
                color: "#334155",
                border: "1px solid #e2e8f0",
              }}
            >
              🔒 Modo lectura (pan/zoom habilitado)
            </span>
          )}
        </div>

        {/* Lienzo */}
        <div
          className="channel-diagram__flow"
          ref={flowRef}
          style={{ width: "100%", height: "90vh" }}
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeDragStop={handleNodeDragStop}
            onNodeClick={handleNodeClick}
            onPaneClick={handlePaneClick}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            proOptions={{ hideAttribution: true }}
            fitView
            nodesDraggable={interactivity.nodesDraggable}
            nodesConnectable={interactivity.nodesConnectable}
            elementsSelectable={interactivity.elementsSelectable}
            selectionOnDrag={interactivity.selectionOnDrag}
            panOnDrag={interactivity.panOnDrag}
            panOnScroll={interactivity.panOnScroll}
            zoomOnScroll={interactivity.zoomOnScroll}
            zoomOnPinch={interactivity.zoomOnPinch}
            defaultEdgeOptions={edgeInteractivity}
          >
            <Background />
            <MiniMap pannable zoomable />
            <Controls />
          </ReactFlow>
        </div>

        {/* Panel info de nodo */}
        {selectedNode && (
          <NodeInfoPanel
            node={selectedNode}
            equipoIndex={equipoIndex}
            onClose={() => setSelectedNodeId(null)}
          />
        )}
      </div>
    </DiagramContext.Provider>
  );
}
