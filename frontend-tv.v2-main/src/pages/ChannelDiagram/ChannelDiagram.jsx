import { useEffect, useMemo, useState, useCallback, useRef, useContext } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  useEdgesState,
  useNodesState,
  addEdge,
  applyNodeChanges,
  ReactFlowProvider,
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
import { DiagramContext } from "./DiagramContext";
import {
  toApiNode,
  toApiEdge,
  getEdgeColor,
  withMarkerColor,
  clampPositionWithinBounds,
  createPatchScheduler,
  MAX_LABEL_LENGTH,
  prepareDiagramState,
} from "./diagramUtils";

const AUTO_SAVE_DELAY = 320;
const FIT_VIEW_PADDING = 0.2;
const ZOOM_DURATION = 160;
const BOUNDS_MARGIN = 480;
const DEFAULT_BOUNDS = { minX: -4000, maxX: 4000, minY: -4000, maxY: 4000 };

const computeBoundsFromNodes = (nodesList) => {
  if (!Array.isArray(nodesList) || nodesList.length === 0) {
    return DEFAULT_BOUNDS;
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  nodesList.forEach((node) => {
    const x = Number(node?.position?.x);
    const y = Number(node?.position?.y);
    if (Number.isFinite(x)) {
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
    }
    if (Number.isFinite(y)) {
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  });

  if (!Number.isFinite(minX) || !Number.isFinite(maxX) || !Number.isFinite(minY) || !Number.isFinite(maxY)) {
    return DEFAULT_BOUNDS;
  }

  return {
    minX: minX - BOUNDS_MARGIN,
    maxX: maxX + BOUNDS_MARGIN,
    minY: minY - BOUNDS_MARGIN,
    maxY: maxY + BOUNDS_MARGIN,
  };
};

const clampLabelText = (value) => {
  if (value === undefined || value === null) return "";
  const str = String(value);
  return str.length > MAX_LABEL_LENGTH ? str.slice(0, MAX_LABEL_LENGTH) : str;
};

const toPositionOrNull = (point) => {
  if (!point || typeof point !== "object") return null;
  const x = Number(point.x);
  const y = Number(point.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
};

const cloneEndpointPositions = (positions) => {
  if (!positions || typeof positions !== "object") {
    return {};
  }
  const next = {};
  const source = toPositionOrNull(positions.source);
  const target = toPositionOrNull(positions.target);
  if (source) next.source = source;
  if (target) next.target = target;
  return next;
};

const ChannelDiagram = () => {
  const { id: signalId } = useParams();

  console.log(signalId)

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
  const [nodes, setNodesState] = useNodesState([]);
  const [edges, setEdgesState, onEdgesChange] = useEdgesState([]);
  const [error, setError] = useState(null);
  const [channelId, setChannelId] = useState(null);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [reactFlowInstance, setReactFlowInstance] = useState(null);

  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  const confirmedNodePositionsRef = useRef(new Map());
  const confirmedEdgePositionsRef = useRef(new Map());

  const syncConfirmedNodePositions = useCallback((nodesList) => {
    const store = confirmedNodePositionsRef.current;
    store.clear();
    nodesList.forEach((node) => {
      const position = toPositionOrNull(node?.position) || { x: 0, y: 0 };
      store.set(node.id, position);
    });
  }, []);

  const syncConfirmedEdgePositions = useCallback((edgesList) => {
    const store = confirmedEdgePositionsRef.current;
    store.clear();
    edgesList.forEach((edge) => {
      const labelPosition =
        toPositionOrNull(edge?.data?.labelPosition) ||
        toPositionOrNull(edge?.labelPosition);
      const endpointPositions = cloneEndpointPositions(
        edge?.data?.endpointLabelPositions
      );
      store.set(edge.id, {
        labelPosition: labelPosition || null,
        endpointLabelPositions: endpointPositions,
      });
    });
  }, []);

  const updateNodes = useCallback(
    (updater) => {
      setNodesState((current) => {
        const next =
          typeof updater === "function" ? updater(current) : Array.isArray(updater) ? updater : current;
        nodesRef.current = next;
        return next;
      });
    },
    [setNodesState]
  );

  const updateEdges = useCallback(
    (updater) => {
      setEdgesState((current) => {
        const next =
          typeof updater === "function" ? updater(current) : Array.isArray(updater) ? updater : current;
        edgesRef.current = next;
        return next;
      });
    },
    [setEdgesState]
  );

  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedNodeId) || null,
    [nodes, selectedNodeId]
  );

  const computeBounds = useCallback(() => computeBoundsFromNodes(nodesRef.current), []);

  const clampPosition = useCallback(
    (pos) => clampPositionWithinBounds(pos, computeBounds()),
    [computeBounds]
  );

  const saveTimer = useRef(null);

  const saveDiagram = useCallback(async () => {
    if (!channelId || !signalId || !isAuth) return;
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
    } catch (errorUpdate) {
      console.error("Error al guardar diagrama:", errorUpdate);
    }
  }, [channelId, signalId, isAuth]);

  const requestSave = useCallback(() => {
    if (!isAuth) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(saveDiagram, AUTO_SAVE_DELAY);
  }, [isAuth, saveDiagram]);

  useEffect(
    () => () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    },
    []
  );

  useEffect(() => {
    let cancelled = false;

    const fetchDiagram = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await api.getChannelDiagramById(
          String(signalId || "").trim()
          
        );
        console.log(response)
        const payload = response?.data ?? response;
        const diagram = Array.isArray(payload) ? payload[0] : payload;
        
        if (!diagram) {
          throw new Error("No existen diagramas para la señal indicada.");
        }

        const { nodes: normalizedNodes, edges: normalizedEdges } =
          prepareDiagramState(diagram);

        if (cancelled) return;

        setChannelId(String(diagram._id));
        updateNodes(() => normalizedNodes);
        updateEdges(() => normalizedEdges);
        syncConfirmedNodePositions(normalizedNodes);
        syncConfirmedEdgePositions(normalizedEdges);
        setSelectedNodeId(null);
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || "Error al cargar el diagrama");
          updateNodes(() => []);
          updateEdges(() => []);
          syncConfirmedNodePositions([]);
          syncConfirmedEdgePositions([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchDiagram();

    return () => {
      cancelled = true;
    };
  }, [
    signalId,
    updateNodes,
    updateEdges,
    syncConfirmedNodePositions,
    syncConfirmedEdgePositions,
  ]);

  const nodePatchScheduler = useMemo(() => {
    if (!channelId || !isAuth) return null;
    return createPatchScheduler((nodeKey, payload) =>
      api.patchChannelNode(channelId, nodeKey, payload)
    );
  }, [channelId, isAuth]);

  const edgePatchScheduler = useMemo(() => {
    if (!channelId || !isAuth) return null;
    return createPatchScheduler((edgeKey, payload) =>
      api.patchChannelEdge(channelId, edgeKey, payload)
    );
  }, [channelId, isAuth]);

  useEffect(
    () => () => {
      nodePatchScheduler?.cancelAll();
    },
    [nodePatchScheduler]
  );

  useEffect(
    () => () => {
      edgePatchScheduler?.cancelAll();
    },
    [edgePatchScheduler]
  );

  const scheduleNodePatch = useCallback(
    (nodeId, patch, options) => {
      if (!nodePatchScheduler) return;
      nodePatchScheduler.schedule(nodeId, patch, options);
    },
    [nodePatchScheduler]
  );

  const scheduleEdgePatch = useCallback(
    (edgeId, patch, options) => {
      if (!edgePatchScheduler) return;
      edgePatchScheduler.schedule(edgeId, patch, options);
    },
    [edgePatchScheduler]
  );

  const handleNodeLabelChange = useCallback(
    (nodeId, nextLabel) => {
      const sanitized = clampLabelText(nextLabel);
      updateNodes((current) =>
        current.map((node) =>
          node.id === nodeId
            ? { ...node, data: { ...(node.data || {}), label: sanitized } }
            : node
        )
      );
      if (isAuth) {
        scheduleNodePatch(nodeId, { label: sanitized });
      }
      requestSave();
    },
    [isAuth, scheduleNodePatch, updateNodes, requestSave]
  );

  const handleNodeLabelPositionChange = useCallback(
    (nodeId, position) => {
      const clamped = position ? clampPosition(position) : null;
      updateNodes((current) =>
        current.map((node) =>
          node.id === nodeId
            ? {
                ...node,
                data: {
                  ...(node.data || {}),
                  labelPosition: clamped ?? undefined,
                },
              }
            : node
        )
      );
      if (isAuth) {
        scheduleNodePatch(nodeId, { labelPosition: clamped });
      }
      requestSave();
    },
    [clampPosition, isAuth, scheduleNodePatch, updateNodes, requestSave]
  );

  const handleEdgeLabelChange = useCallback(
    (edgeId, nextLabel) => {
      const sanitized = clampLabelText(nextLabel);
      updateEdges((current) =>
        current.map((edge) =>
          edge.id === edgeId
            ? {
                ...edge,
                label: sanitized,
                data: { ...(edge.data || {}), label: sanitized },
              }
            : edge
        )
      );
      if (isAuth) {
        scheduleEdgePatch(edgeId, { label: sanitized });
      }
      requestSave();
    },
    [isAuth, scheduleEdgePatch, updateEdges, requestSave]
  );

  const handleEdgeLabelPositionChange = useCallback(
    (edgeId, position) => {
      const clamped = position ? clampPosition(position) : null;
      const previousEdge = edgesRef.current.find((edge) => edge.id === edgeId);
      const fallbackState =
        confirmedEdgePositionsRef.current.get(edgeId) || {
          labelPosition:
            toPositionOrNull(previousEdge?.data?.labelPosition) ||
            toPositionOrNull(previousEdge?.labelPosition) ||
            null,
          endpointLabelPositions: cloneEndpointPositions(
            previousEdge?.data?.endpointLabelPositions
          ),
        };
      updateEdges((current) =>
        current.map((edge) =>
          edge.id === edgeId
            ? {
                ...edge,
                labelPosition: clamped ?? undefined,
                data: { ...(edge.data || {}), labelPosition: clamped ?? undefined },
              }
            : edge
        )
      );
      if (isAuth) {
        scheduleEdgePatch(edgeId, { labelPosition: clamped }, {
          onSuccess: () => {
            const existing = confirmedEdgePositionsRef.current.get(edgeId);
            const endpointPositions = {
              ...((existing && existing.endpointLabelPositions) ||
                fallbackState.endpointLabelPositions || {}),
            };
            confirmedEdgePositionsRef.current.set(edgeId, {
              labelPosition: clamped ? { ...clamped } : null,
              endpointLabelPositions: endpointPositions,
            });
          },
          onError: () => {
            updateEdges((current) =>
              current.map((edge) => {
                if (edge.id !== edgeId) return edge;
                const fallback = fallbackState.labelPosition;
                return {
                  ...edge,
                  labelPosition: fallback || undefined,
                  data: {
                    ...(edge.data || {}),
                    labelPosition: fallback || undefined,
                  },
                };
              })
            );
          },
        });
      }
      requestSave();
    },
    [
      clampPosition,
      isAuth,
      scheduleEdgePatch,
      updateEdges,
      requestSave,
    ]
  );

  const handleEdgeEndpointLabelChange = useCallback(
    (edgeId, endpoint, nextLabel) => {
      const sanitized = clampLabelText(nextLabel).trim();
      updateEdges((current) =>
        current.map((edge) => {
          if (edge.id !== edgeId) return edge;
          const currentLabels = { ...(edge.data?.endpointLabels || {}) };
          if (!sanitized) {
            delete currentLabels[endpoint];
          } else {
            currentLabels[endpoint] = sanitized;
          }
          return {
            ...edge,
            data: {
              ...(edge.data || {}),
              endpointLabels: currentLabels,
            },
          };
        })
      );
      if (isAuth) {
        scheduleEdgePatch(edgeId, {
          endpointLabels: { [endpoint]: sanitized || null },
        });
      }
      requestSave();
    },
    [isAuth, scheduleEdgePatch, updateEdges, requestSave]
  );

  const handleEdgeEndpointLabelPositionChange = useCallback(
    (edgeId, endpoint, position) => {
      const clamped = position ? clampPosition(position) : null;
      const previousEdge = edgesRef.current.find((edge) => edge.id === edgeId);
      const fallbackState =
        confirmedEdgePositionsRef.current.get(edgeId) || {
          labelPosition:
            toPositionOrNull(previousEdge?.data?.labelPosition) ||
            toPositionOrNull(previousEdge?.labelPosition) ||
            null,
          endpointLabelPositions: cloneEndpointPositions(
            previousEdge?.data?.endpointLabelPositions
          ),
        };
      updateEdges((current) =>
        current.map((edge) => {
          if (edge.id !== edgeId) return edge;
          const currentPositions = {
            ...(edge.data?.endpointLabelPositions || {}),
          };
          if (!clamped) {
            delete currentPositions[endpoint];
          } else {
            currentPositions[endpoint] = clamped;
          }
          return {
            ...edge,
            data: {
              ...(edge.data || {}),
              endpointLabelPositions: currentPositions,
            },
          };
        })
      );
      if (isAuth) {
        scheduleEdgePatch(
          edgeId,
          {
            endpointLabelPositions: { [endpoint]: clamped || null },
          },
          {
            onSuccess: () => {
              const existing = confirmedEdgePositionsRef.current.get(edgeId);
              const nextPositions = {
                ...((existing && existing.endpointLabelPositions) ||
                  fallbackState.endpointLabelPositions || {}),
              };
              if (clamped) {
                nextPositions[endpoint] = { ...clamped };
              } else {
                delete nextPositions[endpoint];
              }
              confirmedEdgePositionsRef.current.set(edgeId, {
                labelPosition:
                  (existing && existing.labelPosition) ||
                  fallbackState.labelPosition ||
                  null,
                endpointLabelPositions: nextPositions,
              });
            },
            onError: () => {
              updateEdges((current) =>
                current.map((edge) => {
                  if (edge.id !== edgeId) return edge;
                  const fallbackPositions = {
                    ...(fallbackState.endpointLabelPositions || {}),
                  };
                  const nextPositions = {
                    ...(edge.data?.endpointLabelPositions || {}),
                  };
                  if (fallbackPositions[endpoint]) {
                    nextPositions[endpoint] = fallbackPositions[endpoint];
                  } else {
                    delete nextPositions[endpoint];
                  }
                  return {
                    ...edge,
                    data: {
                      ...(edge.data || {}),
                      endpointLabelPositions: nextPositions,
                    },
                  };
                })
              );
            },
          }
        );
      }
      requestSave();
    },
    [clampPosition, isAuth, scheduleEdgePatch, updateEdges, requestSave]
  );

  const handleNodeDragStop = useCallback(() => {
    requestSave();
  }, [requestSave]);

  const handleEdgeUpdate = useCallback(
    (oldEdge, newConnection) => {
      if (!isAuth) return;
      updateEdges((current) =>
        current.map((edge) =>
          edge.id === oldEdge.id
            ? {
                ...edge,
                source: newConnection.source,
                target: newConnection.target,
                sourceHandle: newConnection.sourceHandle,
                targetHandle: newConnection.targetHandle,
                updatable: true,
              }
            : edge
        )
      );
      requestSave();
    },
    [isAuth, requestSave, updateEdges]
  );

  const handleConnect = useCallback(
    (connection) => {
      if (!isAuth) return;
      const direction = "ida";
      const color = getEdgeColor(undefined, direction);
      updateEdges((current) =>
        addEdge(
          {
            ...connection,
            id: `edge-${Date.now()}`,
            type: "directional",
            data: {
              label: "",
              direction,
              labelPosition: null,
              endpointLabels: {},
              endpointLabelPositions: {},
            },
            label: "",
            style: { stroke: color, strokeWidth: 2 },
            markerEnd: withMarkerColor(undefined, color),
            animated: true,
            updatable: true,
          },
          current
        )
      );
      requestSave();
    },
    [isAuth, requestSave, updateEdges]
  );

  const handleNodesChange = useCallback(
    (changes) => {
      const previousNodes = nodesRef.current;
      const previousPositions = new Map();
      previousNodes.forEach((node) => {
        previousPositions.set(
          node.id,
          toPositionOrNull(node.position) || { x: 0, y: 0 }
        );
      });
      updateNodes((current) => applyNodeChanges(changes, current));
      const finalPositionChanges = changes.filter(
        (change) => change.type === "position" && change.dragging === false
      );

      if (finalPositionChanges.length && isAuth) {
        finalPositionChanges.forEach(({ id }) => {
          const nextNode = nodesRef.current.find((node) => node.id === id);
          if (!nextNode) return;
          const nextPosition = toPositionOrNull(nextNode.position) || {
            x: 0,
            y: 0,
          };
          const confirmedPosition =
            confirmedNodePositionsRef.current.get(id) ||
            previousPositions.get(id) || { x: 0, y: 0 };

          scheduleNodePatch(
            id,
            { position: nextPosition },
            {
              onSuccess: () => {
                confirmedNodePositionsRef.current.set(id, { ...nextPosition });
              },
              onError: () => {
                updateNodes((current) =>
                  current.map((node) =>
                    node.id === id
                      ? { ...node, position: { ...confirmedPosition } }
                      : node
                  )
                );
              },
            }
          );
        });
      }

      if (finalPositionChanges.length) {
        requestSave();
      }
    },
    [isAuth, scheduleNodePatch, updateNodes, requestSave]
  );
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

  const fitViewToContent = useCallback(() => {
    if (!reactFlowInstance) return;
    requestAnimationFrame(() => {
      reactFlowInstance.fitView({ padding: FIT_VIEW_PADDING });
    });
  }, [reactFlowInstance]);

  const handleInit = useCallback((instance) => {
    setReactFlowInstance(instance);
    requestAnimationFrame(() => {
      instance.fitView({ padding: FIT_VIEW_PADDING });
    });
  }, []);

  useEffect(() => {
    if (!reactFlowInstance || loading) return;
    fitViewToContent();
  }, [
    reactFlowInstance,
    channelId,
    loading,
    nodes.length,
    edges.length,
    fitViewToContent,
  ]);

  useEffect(() => {
    if (!reactFlowInstance) return;
    const handleKey = (event) => {
      if (event.target instanceof HTMLElement) {
        const tagName = event.target.tagName.toLowerCase();
        if (tagName === "input" || tagName === "textarea" || event.target.isContentEditable) {
          return;
        }
      }

      if (event.key === "+" || event.key === "=") {
        if (typeof reactFlowInstance.zoomIn === "function") {
          reactFlowInstance.zoomIn({ duration: ZOOM_DURATION });
        } else {
          const currentZoom = reactFlowInstance.getZoom?.() ?? 1;
          reactFlowInstance.zoomTo?.(currentZoom * 1.2, { duration: ZOOM_DURATION });
        }
      }

      if (event.key === "-" || event.key === "_") {
        if (typeof reactFlowInstance.zoomOut === "function") {
          reactFlowInstance.zoomOut({ duration: ZOOM_DURATION });
        } else {
          const currentZoom = reactFlowInstance.getZoom?.() ?? 1;
          reactFlowInstance.zoomTo?.(currentZoom / 1.2, { duration: ZOOM_DURATION });
        }
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [reactFlowInstance]);

  const contextValue = useMemo(
    () => ({
      isReadOnly,
      onNodeLabelChange: handleNodeLabelChange,
      onNodeLabelPositionChange: handleNodeLabelPositionChange,
      onEdgeLabelChange: handleEdgeLabelChange,
      onEdgeLabelPositionChange: handleEdgeLabelPositionChange,
      onEdgeEndpointLabelChange: handleEdgeEndpointLabelChange,
      onEdgeEndpointLabelPositionChange: handleEdgeEndpointLabelPositionChange,
      clampPosition,
    }),
    [
      clampPosition,
      handleEdgeEndpointLabelChange,
      handleEdgeEndpointLabelPositionChange,
      handleEdgeLabelChange,
      handleEdgeLabelPositionChange,
      handleNodeLabelChange,
      handleNodeLabelPositionChange,
      isReadOnly,
    ]
  );

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
    <ReactFlowProvider>
      <div className="channel-diagram__wrapper">
        <div className="channel-diagram__layout">
          <div className="channel-diagram__canvas">
            {isReadOnly && (
              <div className="diagram-readonly-banner">Modo solo lectura.</div>
            )}
            <DiagramContext.Provider value={contextValue}>
              <ReactFlow
                className="channel-diagram__flow"
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                nodesDraggable={!isReadOnly}
                nodesConnectable={!isReadOnly}
                elementsSelectable
                edgesUpdatable={!isReadOnly}
                edgeUpdaterRadius={20}
                onNodeDragStop={handleNodeDragStop}
                onEdgeUpdate={handleEdgeUpdate}
                onConnect={handleConnect}
                onNodesChange={handleNodesChange}
                onEdgesChange={handleEdgesChange}
                onNodeClick={handleNodeClick}
                onPaneClick={handlePaneClick}
                onSelectionChange={handleSelectionChange}
                onInit={handleInit}
                zoomOnScroll
                panOnDrag
              >
                <Background variant="dots" gap={16} size={1} />
                <Controls position="bottom-right" />
              </ReactFlow>
            </DiagramContext.Provider>
          </div>
          <NodeEquipmentSidebar node={selectedNode} />
        </div>
      </div>
    </ReactFlowProvider>
  );
};

export default ChannelDiagram;
