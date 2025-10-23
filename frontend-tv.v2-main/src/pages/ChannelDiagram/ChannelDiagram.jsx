// src/pages/ChannelDiagram/ChannelDiagram.jsx
import { useEffect, useMemo, useState, useCallback, useRef } from "react";
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
import CustomNode from "./CustomNode";
import RouterNode from "./RouterNode";
import SateliteNode from "./nodes/SateliteNode";
import IrdNode from "./nodes/IrdNode";
import SwitchNode from "./nodes/SwitchNode";
import CustomDirectionalEdge from "./CustomDirectionalEdge";
import CustomWaypointEdge from "./CustomWaypointEdge";
import { prepareDiagramState, ensureRouterTemplateEdges } from "./diagramUtils";
import "./ChannelDiagram.css";

/* --- Mapeo de tipos de nodos --- */
const nodeTypes = {
  custom: CustomNode,
  router: RouterNode,
  satelite: SateliteNode,
  ird: IrdNode,
  switch: SwitchNode,
};

/* --- Mapeo de tipos de edges --- */
const edgeTypes = {
  directional: CustomDirectionalEdge,
  waypoint: CustomWaypointEdge,
};

export default function ChannelDiagram({
  channelId,
  isReadOnly = false,
}) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(!!channelId);
  const [error, setError] = useState(null);

  const flowRef = useRef(null);

  /* --- Cargar diagrama desde API --- */
  useEffect(() => {
    let active = true;
    if (!channelId) {
      setLoading(false);
      return;
    }

    (async () => {
      try {
        setLoading(true);
        const res = await api.getChannelDiagramById(channelId);
        const payload = Array.isArray(res?.data) ? res.data[0] : res?.data ?? res;
        const { nodes: n, edges: e } = prepareDiagramState(payload);
        if (!active) return;
        setNodes(n);
        setEdges(e);
      } catch (err) {
        if (!active) return;
        const msg =
          err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          "Error al cargar el diagrama.";
        setError(msg);
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [channelId, setNodes, setEdges]);

  /* --- Asegurar edges plantilla para routers --- */
  const materializeRouterTemplates = useCallback(
    (opts = { force: false }) => {
      setEdges((prevEdges) => {
        let nextEdges = [...prevEdges];
        let changed = false;

        nodes.forEach((node) => {
          const { toAdd, toRemove } = ensureRouterTemplateEdges(node, nextEdges, {
            force: !!opts.force,
          });

          if (toRemove?.length) {
            const idsToRemove = new Set(toRemove.map((e) => e.id));
            nextEdges = nextEdges.filter((e) => !idsToRemove.has(e.id));
            changed = true;
          }
          if (toAdd?.length) {
            nextEdges = [...nextEdges, ...toAdd];
            changed = true;
          }
        });

        return changed ? nextEdges : prevEdges;
      });
    },
    [nodes, setEdges]
  );

  /* --- Ejecutar en cambios de nodos --- */
  useEffect(() => {
    if (nodes.length > 0) {
      materializeRouterTemplates({ force: false });
    }
  }, [nodes, materializeRouterTemplates]);

  /* --- Cuando se conecta un nuevo edge manual --- */
  const onConnect = useCallback(
    (params) => {
      setEdges((eds) => addEdge({ ...params, type: "directional" }, eds));
    },
    [setEdges]
  );

  const handleForceTemplates = useCallback(() => {
    materializeRouterTemplates({ force: true });
  }, [materializeRouterTemplates]);

  const proOptions = useMemo(() => ({ hideAttribution: true }), []);

  if (loading) {
    return <div className="chd__status chd__status--info">Cargando diagrama...</div>;
  }

  if (error) {
    return (
      <div className="chd__status chd__status--error">
        <strong>Error:</strong> {error}
      </div>
    );
  }

  return (
    <div className="channel-diagram__container">
      <div className="channel-diagram__toolbar">
        <button
          type="button"
          className="chd__btn chd__btn--secondary"
          onClick={handleForceTemplates}
          title="Regenerar edges plantilla de routers"
        >
          ↻ Regenerar edges router
        </button>
      </div>

      <div className="channel-diagram__flow" ref={flowRef}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          proOptions={proOptions}
          fitView
        >
          <Background />
          <MiniMap pannable zoomable />
          <Controls />
        </ReactFlow>
      </div>
    </div>
  );
}
