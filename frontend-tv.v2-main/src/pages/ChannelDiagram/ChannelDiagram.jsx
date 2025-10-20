import { useEffect, useMemo, useState, useCallback, useRef, useContext } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  useEdgesState,
  useNodesState,
  addEdge,
  applyEdgeChanges,
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
  ensureRouterTemplateEdges,
  isRouterNode,
} from "./diagramUtils";
import { createPersistLabelPositions } from "./persistLabelPositions";
import { getSampleDiagramById } from "./samples";
import normalizeHandle from "../../utils/normalizeHandle";

const AUTO_SAVE_DELAY = 320;
const FIT_VIEW_PADDING = 0.2;
const ZOOM_DURATION = 160;
const BOUNDS_MARGIN = 480;
const DEFAULT_BOUNDS = { minX: -4000, maxX: 4000, minY: -4000, maxY: 4000 };

const computeBoundsFromNodes = (nodesList) => {
  if (!Array.isArray(nodesList) || nodesList.length === 0) return DEFAULT_BOUNDS;

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

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

  if (![minX, maxX, minY, maxY].every(Number.isFinite)) return DEFAULT_BOUNDS;

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
  if (!positions || typeof positions !== "object") return {};
  const next = {};
  const source = toPositionOrNull(positions.source);
  const target = toPositionOrNull(positions.target);
  if (source) next.source = source;
  if (target) next.target = target;
  return next;
};

const DEFAULT_CUSTOM_NODE_SLOTS = Object.freeze({
  top: [20, 50, 80],
  bottom: [20, 50, 80],
  left: [30, 70],
  right: [30, 70],
});

const ROUTER_HANDLE_OPTIONS = Object.freeze({
  source: [
    { id: "out-right-1", side: "right" },
    { id: "out-right-2", side: "right" },
    { id: "out-bottom-1", side: "bottom" },
    { id: "out-bottom-2", side: "bottom" },
    { id: "out-bottom-3", side: "bottom" },
  ],
  target: [
    { id: "in-left-1", side: "left" },
    { id: "in-left-2", side: "left" },
    { id: "in-bottom-1", side: "bottom" },
    { id: "in-bottom-2", side: "bottom" },
    { id: "in-bottom-3", side: "bottom" },
  ],
});

const SIDES = ["top", "bottom", "left", "right"];

const DIRECTION_HANDLE_PREFERENCES = Object.freeze({
  ida: { source: ["right", "bottom"], target: ["left", "top"] },
  vuelta: { source: ["left", "top"], target: ["right", "bottom"] },
});

const mergePreferredSides = (...inputs) => {
  const seen = new Set();
  const result = [];
  inputs.forEach((value) => {
    const list = Array.isArray(value)
      ? value
      : value
      ? [value]
      : [];
    list.forEach((side) => {
      if (typeof side === "string") {
        const normalized = side.toLowerCase();
        if (!seen.has(normalized)) {
          seen.add(normalized);
          result.push(normalized);
        }
      }
    });
  });
  return result;
};

const getCustomNodeHandleOptions = (node) => {
  if (!node) return [];
  const slots = node?.data?.slots || {};
  const handles = [];

  SIDES.forEach((side) => {
    const configured = Array.isArray(slots[side]) && slots[side].length
      ? slots[side]
      : DEFAULT_CUSTOM_NODE_SLOTS[side];
    const count = Array.isArray(configured) ? configured.length : 0;
    for (let index = 1; index <= count; index += 1) {
      handles.push({ id: `in-${side}-${index}`, kind: "target", side });
      handles.push({ id: `out-${side}-${index}`, kind: "source", side });
    }
  });

  return handles;
};

const getNodeHandleOptions = (node, kind) => {
  if (!node) return [];
  const normalizedKind = kind === "target" ? "target" : "source";
  if (isRouterNode(node)) return ROUTER_HANDLE_OPTIONS[normalizedKind] || [];
  return getCustomNodeHandleOptions(node).filter((h) => h.kind === normalizedKind);
};

const getNodePositionPoint = (node) => {
  if (!node) return null;
  const pos = node.position || {};
  const x = Number(pos.x);
  const y = Number(pos.y);
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
};

const computePreferredSide = (fromNode, toNode) => {
  const fromPos = getNodePositionPoint(fromNode);
  const toPos = getNodePositionPoint(toNode);
  if (!fromPos || !toPos) return null;
  const dx = toPos.x - fromPos.x;
  const dy = toPos.y - fromPos.y;
  if (Math.abs(dx) > Math.abs(dy)) return dx >= 0 ? "right" : "left";
  if (dy === 0) return dx >= 0 ? "right" : "left";
  return dy >= 0 ? "bottom" : "top";
};

const allocateHandleId = (node, kind, preferredSides, usedSet, fallbackNormalized) => {
  const options = getNodeHandleOptions(node, kind);
  if (!options.length) return fallbackNormalized || null;

  const ordered = options.slice();
  const preferences = mergePreferredSides(preferredSides);
  if (preferences.length) {
    ordered.sort((a, b) => {
      const aIndex = preferences.indexOf(a.side);
      const bIndex = preferences.indexOf(b.side);
      const normalizeIndex = (index) => (index === -1 ? Number.MAX_SAFE_INTEGER : index);
      return normalizeIndex(aIndex) - normalizeIndex(bIndex);
    });
  }

  if (fallbackNormalized) {
    const fallbackOption = ordered.find(
      (o) => normalizeHandle(o.id) === fallbackNormalized && !usedSet.has(fallbackNormalized)
    );
    if (fallbackOption) return normalizeHandle(fallbackOption.id);
  }

  const available = ordered.find((o) => !usedSet.has(normalizeHandle(o.id)));
  if (available) return normalizeHandle(available.id);

  if (fallbackNormalized) return fallbackNormalized;
  return normalizeHandle(ordered[0].id);
};

const assignHandle = (node, kind, providedHandle, usedSet, preferredSides) => {
  const normalizedProvided = normalizeHandle(providedHandle);

  if (!node) {
    if (normalizedProvided) {
      usedSet.add(normalizedProvided);
      return normalizedProvided;
    }
    return providedHandle || null;
  }

  if (normalizedProvided && !usedSet.has(normalizedProvided)) {
    usedSet.add(normalizedProvided);
    return normalizedProvided;
  }

  const allocated = allocateHandleId(node, kind, preferredSides, usedSet, normalizedProvided);
  if (allocated) {
    usedSet.add(allocated);
    return allocated;
  }
  return normalizedProvided || providedHandle || null;
};

const ensureEdgesUseDistinctHandles = (nodesList, edgesList) => {
  if (!Array.isArray(edgesList) || edgesList.length === 0) return edgesList;

  const nodeLookup = new Map(Array.isArray(nodesList) ? nodesList.map((n) => [n.id, n]) : []);

  const usage = { source: new Map(), target: new Map() };
  const getUsageSet = (direction, nodeId) => {
    if (!nodeId) return new Set();
    const map = usage[direction];
    if (!map.has(nodeId)) map.set(nodeId, new Set());
    return map.get(nodeId);
  };

  return edgesList.map((edge) => {
    const sourceNode = nodeLookup.get(edge.source);
    const targetNode = nodeLookup.get(edge.target);
    const sourceUsage = getUsageSet("source", edge.source);
    const targetUsage = getUsageSet("target", edge.target);

    const preferredSourceSide = computePreferredSide(sourceNode, targetNode);
    const preferredTargetSide = computePreferredSide(targetNode, sourceNode);
    const direction = typeof edge?.data?.direction === "string" ? edge.data.direction.toLowerCase() : null;
    const directionPreferences = direction ? DIRECTION_HANDLE_PREFERENCES[direction] || {} : {};
    const sourcePreferences = mergePreferredSides(directionPreferences.source, preferredSourceSide);
    const targetPreferences = mergePreferredSides(directionPreferences.target, preferredTargetSide);

    const assignedSource = assignHandle(
      sourceNode,
      "source",
      edge.sourceHandle,
      sourceUsage,
      sourcePreferences
    );
    const assignedTarget = assignHandle(
      targetNode,
      "target",
      edge.targetHandle,
      targetUsage,
      targetPreferences
    );

    const nextEdge = { ...edge };
    if (assignedSource) nextEdge.sourceHandle = assignedSource; else delete nextEdge.sourceHandle;
    if (assignedTarget) nextEdge.targetHandle = assignedTarget; else delete nextEdge.targetHandle;
    return nextEdge;
  });
};

const ChannelDiagram = () => {
  const { id: channelIdParam } = useParams();

  const nodeTypes = useMemo(
    () => ({ custom: CustomNode, router: RouterNode }),
    []
  );

  const edgeTypes = useMemo(
    () => ({ directional: CustomDirectionalEdge, waypoint: CustomWaypointEdge }),
    []
  );

  const { isAuth } = useContext(UserContext);
  const [isSampleDiagram, setIsSampleDiagram] = useState(false);
  const [diagramMetadata, setDiagramMetadata] = useState(null);
  const isReadOnly = !isAuth || isSampleDiagram;

  const [loading, setLoading] = useState(true);
  const [nodes, setNodesState] = useNodesState([]);
  const [edges, setEdgesState, onEdgesChange] = useEdgesState([]);
  const [error, setError] = useState(null);
  const [channelId, setChannelId] = useState(null);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [reactFlowInstance, setReactFlowInstance] = useState(null);
  const [sidebarVisible, setSidebarVisible] = useState(true);

  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  const confirmedNodePositionsRef = useRef(new Map());
  const confirmedNodeLabelPositionsRef = useRef(new Map());
  const confirmedEdgePositionsRef = useRef(new Map());

  const syncConfirmedNodePositions = useCallback((nodesList) => {
    const store = confirmedNodePositionsRef.current;
    store.clear();
    nodesList.forEach((node) => {
      const position = toPositionOrNull(node?.position) || { x: 0, y: 0 };
      store.set(node.id, position);
    });
  }, []);

  const syncConfirmedNodeLabelPositions = useCallback((nodesList) => {
    const store = confirmedNodeLabelPositionsRef.current;
    store.clear();
    nodesList.forEach((node) => {
      const data = node?.data || {};
      const labelPosition = toPositionOrNull(data.labelPosition) || null;
      const multicastPosition = toPositionOrNull(data.multicastPosition) || null;
      store.set(node.id, { labelPosition, multicastPosition });
    });
  }, []);

  const syncConfirmedEdgePositions = useCallback((edgesList) => {
    const store = confirmedEdgePositionsRef.current;
    store.clear();
    edgesList.forEach((edge) => {
      const labelPosition =
        toPositionOrNull(edge?.data?.labelPosition) ||
        toPositionOrNull(edge?.labelPosition);
      const endpointPositions = cloneEndpointPositions(edge?.data?.endpointLabelPositions);
      const multicastPosition = toPositionOrNull(edge?.data?.multicastPosition) || null;
      store.set(edge.id, {
        labelPosition: labelPosition || null,
        endpointLabelPositions: endpointPositions,
        multicastPosition,
      });
    });
  }, []);

  const updateNodes = useCallback(
    (updater) => {
      setNodesState((current) => {
        const next = typeof updater === "function" ? updater(current) : Array.isArray(updater) ? updater : current;
        nodesRef.current = next;
        return next;
      });
    },
    [setNodesState]
  );

  const updateEdges = useCallback(
    (updater) => {
      setEdgesState((current) => {
        const next = typeof updater === "function" ? updater(current) : Array.isArray(updater) ? updater : current;
        edgesRef.current = next;
        return next;
      });
    },
    [setEdgesState]
  );

  const toggleSidebar = useCallback(() => {
    setSidebarVisible((prev) => !prev);
  }, []);

  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedNodeId) || null,
    [nodes, selectedNodeId]
  );

  const computeBounds = useCallback(() => computeBoundsFromNodes(nodesRef.current), []);
  const clampPosition = useCallback((pos) => clampPositionWithinBounds(pos, computeBounds()), [computeBounds]);

  const saveTimer = useRef(null);

  const saveDiagram = useCallback(async () => {
    if (!channelId || !channelIdParam || !isAuth || isSampleDiagram) return;
    const payload = {
      channelId: String(channelId),
      nodes: nodesRef.current.map(toApiNode),
      edges: edgesRef.current.map(toApiEdge),
    };
    try {
      await api.updateChannelFlow(channelId, payload);
    } catch (errorUpdate) {
      console.error("Error al guardar diagrama:", errorUpdate);
    }
  }, [channelId, channelIdParam, isAuth, isSampleDiagram]);

  const requestSave = useCallback(() => {
    if (!isAuth || isSampleDiagram) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(saveDiagram, AUTO_SAVE_DELAY);
  }, [isAuth, isSampleDiagram, saveDiagram]);

  const ensureRouterEdges = useCallback(
    (node, options = {}) => {
      if (!node || !isRouterNode(node)) return { added: 0, removed: 0 };

      let summary = { added: 0, removed: 0 };
      updateEdges((current) => {
        const { toAdd, toRemove } = ensureRouterTemplateEdges(node, current, options);
        if (!toAdd.length && !toRemove.length) return current;

        const toRemoveIds = new Set(toRemove.map((e) => e.id));
        summary = { added: toAdd.length, removed: toRemove.length };
        const next = current.filter((e) => !toRemoveIds.has(e.id));
        const merged = [...next, ...toAdd];
        return ensureEdgesUseDistinctHandles(nodesRef.current, merged);
      });

      if ((summary.added || summary.removed) && isAuth) requestSave();
      return summary;
    },
    [updateEdges, isAuth, requestSave]
  );

  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current); }, []);

  useEffect(() => {
    let cancelled = false;

    const fetchDiagram = async () => {
      try {
        setLoading(true);
        setError(null);

        const requestedId = String(channelIdParam || "").trim();
        if (!requestedId) throw new Error("El identificador del canal es obligatorio.");

        const sampleDiagram = getSampleDiagramById(requestedId);
        if (sampleDiagram) {
          const { nodes: normalizedNodes, edges: normalizedEdges } = prepareDiagramState(sampleDiagram);
          if (cancelled) return;

          setChannelId(String(sampleDiagram._id || requestedId));
          setIsSampleDiagram(true);
          setDiagramMetadata(sampleDiagram.metadata || null);
          updateNodes(() => normalizedNodes);
          const edgesWithHandles = ensureEdgesUseDistinctHandles(normalizedNodes, normalizedEdges);
          updateEdges(() => edgesWithHandles);
          syncConfirmedNodePositions(normalizedNodes);
          syncConfirmedNodeLabelPositions(normalizedNodes);
          syncConfirmedEdgePositions(edgesWithHandles);
          setSelectedNodeId(null);
          return;
        }

        const response = await api.getChannelDiagramById(requestedId);
        const payload = response?.data ?? response;
        const diagram = Array.isArray(payload) ? payload[0] : payload;
        if (!diagram) throw new Error("No existe un diagrama para el canal indicado.");

        const { nodes: normalizedNodes, edges: normalizedEdges } = prepareDiagramState(diagram);
        if (cancelled) return;

        setChannelId(String(diagram._id));
        setIsSampleDiagram(false);
        setDiagramMetadata(diagram?.metadata || null);
        updateNodes(() => normalizedNodes);
        const edgesWithHandles = ensureEdgesUseDistinctHandles(normalizedNodes, normalizedEdges);
        updateEdges(() => edgesWithHandles);
        syncConfirmedNodePositions(normalizedNodes);
        syncConfirmedNodeLabelPositions(normalizedNodes);
        syncConfirmedEdgePositions(edgesWithHandles);
        setSelectedNodeId(null);
      } catch (err) {
        if (!cancelled) {
          setIsSampleDiagram(false);
          setDiagramMetadata(null);
          setError(err?.message || "Error al cargar el diagrama");
          updateNodes(() => []);
          updateEdges(() => []);
          syncConfirmedNodePositions([]);
          syncConfirmedNodeLabelPositions([]);
          syncConfirmedEdgePositions([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchDiagram();
    return () => { cancelled = true; };
  }, [
    channelIdParam,
    updateNodes,
    updateEdges,
    syncConfirmedNodePositions,
    syncConfirmedNodeLabelPositions,
    syncConfirmedEdgePositions,
  ]);

  const nodePatchScheduler = useMemo(() => {
    if (!channelId || !isAuth || isSampleDiagram) return null;
    return createPatchScheduler((nodeKey, payload) => api.patchChannelNode(channelId, nodeKey, payload));
  }, [channelId, isAuth, isSampleDiagram]);

  const edgePatchScheduler = useMemo(() => {
    if (!channelId || !isAuth || isSampleDiagram) return null;
    return createPatchScheduler((edgeKey, payload) => api.patchChannelEdge(channelId, edgeKey, payload));
  }, [channelId, isAuth, isSampleDiagram]);

  useEffect(() => () => { nodePatchScheduler?.cancelAll(); }, [nodePatchScheduler]);
  useEffect(() => () => { edgePatchScheduler?.cancelAll(); }, [edgePatchScheduler]);

  const scheduleNodePatch = useCallback(
    (nodeId, patch, options) => { if (nodePatchScheduler) nodePatchScheduler.schedule(nodeId, patch, options); },
    [nodePatchScheduler]
  );

  const scheduleEdgePatch = useCallback(
    (edgeId, patch, options) => { if (edgePatchScheduler) edgePatchScheduler.schedule(edgeId, patch, options); },
    [edgePatchScheduler]
  );

  const persistLabelPositions = useMemo(() => {
    if (!channelId || !isAuth || isSampleDiagram) return null;
    return createPersistLabelPositions({
      getChannelId: () => channelId,
      getIsAuth: () => isAuth,
      requestSave,
      confirmedNodeLabelPositionsRef,
      confirmedEdgePositionsRef,
    });
  }, [channelId, isAuth, isSampleDiagram, requestSave]);

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
      if (isAuth) scheduleNodePatch(nodeId, { label: sanitized });
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
            ? { ...node, data: { ...(node.data || {}), labelPosition: clamped ?? undefined } }
            : node
        )
      );
    },
    [clampPosition, updateNodes]
  );

  const handleNodeMulticastPositionChange = useCallback(
    (nodeId, position) => {
      const clamped = position ? clampPosition(position) : null;
      updateNodes((current) =>
        current.map((node) =>
          node.id === nodeId
            ? { ...node, data: { ...(node.data || {}), multicastPosition: clamped ?? undefined } }
            : node
        )
      );
    },
    [clampPosition, updateNodes]
  );

  const handleNodeDataPatch = useCallback(
    (nodeId, dataPatch = {}) => {
      if (!nodeId || !dataPatch || typeof dataPatch !== "object") return;

      updateNodes((current) =>
        current.map((node) =>
          node.id === nodeId ? { ...node, data: { ...(node.data || {}), ...dataPatch } } : node
        )
      );

      if (isAuth) scheduleNodePatch(nodeId, { data: dataPatch });
      requestSave();
    },
    [isAuth, scheduleNodePatch, updateNodes, requestSave]
  );

  const handleNodeLockChange = useCallback(
    (nodeId, locked) => {
      const isLocked = Boolean(locked);
      updateNodes((current) =>
        current.map((node) =>
          node.id === nodeId
            ? { ...node, draggable: !isLocked, data: { ...(node.data || {}), locked: isLocked } }
            : node
        )
      );
      if (isAuth) scheduleNodePatch(nodeId, { draggable: !isLocked, data: { locked: isLocked } });
      requestSave();
    },
    [isAuth, scheduleNodePatch, updateNodes, requestSave]
  );

  const focusNodeById = useCallback(
    (nodeId) => {
      if (!nodeId || !reactFlowInstance) return;
      const node = nodesRef.current.find((item) => item.id === nodeId);
      if (!node) return;
      const width = 260;
      const height = 160;
      const x = Number(node.position?.x) - width / 2;
      const y = Number(node.position?.y) - height / 2;
      reactFlowInstance.fitBounds(
        {
          x: Number.isFinite(x) ? x : 0,
          y: Number.isFinite(y) ? y : 0,
          width,
          height,
        },
        { duration: ZOOM_DURATION }
      );
    },
    [reactFlowInstance]
  );

  const handleDuplicateNode = useCallback(
    (nodeId) => {
      if (!nodeId || !isAuth) return null;
      const original = nodesRef.current.find((node) => node.id === nodeId);
      if (!original) return null;

      const baseId = `${original.id}-copy`;
      let newId = baseId;
      let counter = 1;
      const ids = new Set(nodesRef.current.map((node) => node.id));
      while (ids.has(newId)) {
        newId = `${baseId}-${counter}`;
        counter += 1;
      }

      const offsetX = Number(original.position?.x) + 120 || 120;
      const offsetY = Number(original.position?.y) + 80 || 80;
      const duplicated = {
        ...original,
        id: newId,
        position: { x: offsetX, y: offsetY },
        selected: false,
        dragging: false,
        data: { ...(original.data || {}), label: `${original.data?.label || original.id} (copy)` },
      };

      updateNodes((current) => [...current, duplicated]);
      if (isRouterNode(duplicated)) ensureRouterEdges(duplicated);
      requestSave();
      return duplicated;
    },
    [isAuth, updateNodes, requestSave, ensureRouterEdges]
  );

  const handleEdgeLabelChange = useCallback(
    (edgeId, nextLabel) => {
      const sanitized = clampLabelText(nextLabel);
      updateEdges((current) =>
        current.map((edge) =>
          edge.id === edgeId
            ? { ...edge, label: sanitized, data: { ...(edge.data || {}), label: sanitized } }
            : edge
        )
      );
      if (isAuth) scheduleEdgePatch(edgeId, { label: sanitized });
      requestSave();
    },
    [isAuth, scheduleEdgePatch, updateEdges, requestSave]
  );

  const handleEdgeLabelPositionChange = useCallback(
    (edgeId, position) => {
      const clamped = position ? clampPosition(position) : null;
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
    },
    [clampPosition, updateEdges]
  );

  const handleEdgeEndpointLabelChange = useCallback(
    (edgeId, endpoint, nextLabel) => {
      const sanitized = clampLabelText(nextLabel).trim();
      updateEdges((current) =>
        current.map((edge) => {
          if (edge.id !== edgeId) return edge;
          const currentLabels = { ...(edge.data?.endpointLabels || {}) };
          if (!sanitized) delete currentLabels[endpoint];
          else currentLabels[endpoint] = sanitized;
          return { ...edge, data: { ...(edge.data || {}), endpointLabels: currentLabels } };
        })
      );
      if (isAuth) scheduleEdgePatch(edgeId, { endpointLabels: { [endpoint]: sanitized || null } });
      requestSave();
    },
    [isAuth, scheduleEdgePatch, updateEdges, requestSave]
  );

  const handleEdgeEndpointLabelPositionChange = useCallback(
    (edgeId, endpoint, position) => {
      const clamped = position ? clampPosition(position) : null;
      updateEdges((current) =>
        current.map((edge) => {
          if (edge.id !== edgeId) return edge;
          const currentPositions = { ...(edge.data?.endpointLabelPositions || {}) };
          if (!clamped) delete currentPositions[endpoint];
          else currentPositions[endpoint] = clamped;
          return { ...edge, data: { ...(edge.data || {}), endpointLabelPositions: currentPositions } };
        })
      );
    },
    [clampPosition, updateEdges]
  );

  const handleEdgeEndpointLabelPersist = useCallback(
    (edgeId, endpoint, position, meta = {}) => {
      if (!meta?.moved || isReadOnly || !persistLabelPositions) {
        return;
      }
      const clamped = position ? clampPosition(position) : null;
      persistLabelPositions({
        endpointLabelPositions: {
          [edgeId]: {
            [endpoint]: clamped || null,
          },
        },
      }).catch((error) => {
        console.error("Persist edge endpoint label position failed", error);
        if (meta && Object.prototype.hasOwnProperty.call(meta, "initial")) {
          handleEdgeEndpointLabelPositionChange(edgeId, endpoint, meta.initial);
        }
      });
    },
    [
      clampPosition,
      handleEdgeEndpointLabelPositionChange,
      isReadOnly,
      persistLabelPositions,
    ]
  );

  const handleEdgeMulticastPositionChange = useCallback(
    (edgeId, position) => {
      const clamped = position ? clampPosition(position) : null;
      updateEdges((current) =>
        current.map((edge) => {
          if (edge.id !== edgeId) return edge;
          const nextData = { ...(edge.data || {}) };
          if (!clamped) delete nextData.multicastPosition;
          else nextData.multicastPosition = clamped;
          return { ...edge, data: nextData };
        })
      );
    },
    [clampPosition, updateEdges]
  );

  const handleNodeDragStop = useCallback(() => { requestSave(); }, [requestSave]);

  const handleEdgeReconnect = useCallback(
    (oldEdge, newConnection) => {
      if (!isAuth) return;
      updateEdges((current) => {
        const next = current.map((edge) =>
          edge.id === oldEdge.id
            ? {
                ...edge,
                source: newConnection.source,
                target: newConnection.target,
                sourceHandle: newConnection.sourceHandle,
                targetHandle: newConnection.targetHandle,
                reconnectable: true,
              }
            : edge
        );
        return ensureEdgesUseDistinctHandles(nodesRef.current, next);
      });
      requestSave();
    },
    [isAuth, requestSave, updateEdges]
  );

  const handleConnect = useCallback(
    (connection) => {
      if (!isAuth) return;
      const direction = "ida";
      const color = getEdgeColor(undefined, direction);
      updateEdges((current) => {
        const next = addEdge(
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
            reconnectable: true,
          },
          current
        );
        return ensureEdgesUseDistinctHandles(nodesRef.current, next);
      });
      requestSave();
    },
    [isAuth, requestSave, updateEdges]
  );

  const handleNodesChange = useCallback(
    (changes) => {
      const previousNodes = nodesRef.current;
      const previousPositions = new Map();
      previousNodes.forEach((node) => {
        previousPositions.set(node.id, toPositionOrNull(node.position) || { x: 0, y: 0 });
      });

      const routerAdditions = [];
      changes.forEach((change) => {
        if (change.type === "add") {
          const candidate = change.item || previousNodes.find((node) => node.id === change.id);
          if (candidate && isRouterNode(candidate)) routerAdditions.push(candidate.id);
        }
      });

      updateNodes((current) => applyNodeChanges(changes, current));
      const requiresHandleRecalculation = changes.some((change) =>
        change.type === "add" || change.type === "position" || change.type === "remove"
      );

      if (requiresHandleRecalculation) {
        updateEdges((current) => ensureEdgesUseDistinctHandles(nodesRef.current, current));
      }
      const finalPositionChanges = changes.filter((c) => c.type === "position" && c.dragging === false);

      if (finalPositionChanges.length && isAuth) {
        finalPositionChanges.forEach(({ id }) => {
          const nextNode = nodesRef.current.find((n) => n.id === id);
          if (!nextNode) return;
          const nextPosition = toPositionOrNull(nextNode.position) || { x: 0, y: 0 };
          const confirmedPosition =
            confirmedNodePositionsRef.current.get(id) ||
            previousPositions.get(id) ||
            { x: 0, y: 0 };

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
                    node.id === id ? { ...node, position: { ...confirmedPosition } } : node
                  )
                );
              },
            }
          );
        });
      }

      if (finalPositionChanges.length) requestSave();

      routerAdditions.forEach((routerId) => {
        const routerNode = nodesRef.current.find((node) => node.id === routerId);
        if (!routerNode) return;
        const summary = ensureRouterEdges(routerNode);
        if (summary.added) {
          console.info(`Router ${routerNode.id}: se generaron ${summary.added} aristas por defecto.`);
        }
      });
    },
    [isAuth, scheduleNodePatch, updateNodes, requestSave, ensureRouterEdges]
  );

  const handleEdgesChange = useCallback(
    (changes) => {
      if (!Array.isArray(changes) || changes.length === 0) {
        onEdgesChange(changes);
        return;
      }
      updateEdges((current) => {
        const next = applyEdgeChanges(changes, current);
        return ensureEdgesUseDistinctHandles(nodesRef.current, next);
      });
    },
    [onEdgesChange, updateEdges]
  );

  const handleNodeClick = useCallback((_, node) => { setSelectedNodeId(node?.id ?? null); }, []);
  const handlePaneClick = useCallback(() => { setSelectedNodeId(null); }, []);
  const handleSelectionChange = useCallback((selection) => {
    const node = Array.isArray(selection?.nodes) ? selection.nodes[0] : null;
    setSelectedNodeId(node?.id ?? null);
  }, []);

  const fitViewToContent = useCallback(() => {
    if (!reactFlowInstance) return;
    requestAnimationFrame(() => { reactFlowInstance.fitView({ padding: FIT_VIEW_PADDING }); });
  }, [reactFlowInstance]);

  const handleInit = useCallback((instance) => {
    setReactFlowInstance(instance);
    requestAnimationFrame(() => { instance.fitView({ padding: FIT_VIEW_PADDING }); });
  }, []);

  useEffect(() => {
    if (!reactFlowInstance || loading) return;
    fitViewToContent();
  }, [reactFlowInstance, channelId, loading, nodes.length, edges.length, fitViewToContent]);

  useEffect(() => {
    if (!reactFlowInstance) return;
    const handleKey = (event) => {
      if (event.target instanceof HTMLElement) {
        const tagName = event.target.tagName.toLowerCase();
        if (tagName === "input" || tagName === "textarea" || event.target.isContentEditable) return;
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
      onNodeMulticastPositionChange: handleNodeMulticastPositionChange,
      onEdgeLabelChange: handleEdgeLabelChange,
      onEdgeLabelPositionChange: handleEdgeLabelPositionChange,
      onEdgeEndpointLabelChange: handleEdgeEndpointLabelChange,
      onEdgeEndpointLabelPositionChange: handleEdgeEndpointLabelPositionChange,
      onEdgeEndpointLabelPersist: handleEdgeEndpointLabelPersist,
      onEdgeMulticastPositionChange: handleEdgeMulticastPositionChange,
      persistLabelPositions,
      clampPosition,
      ensureRouterEdges,
    }),
    [
      clampPosition,
      ensureRouterEdges,
      handleEdgeEndpointLabelChange,
      handleEdgeEndpointLabelPositionChange,
      handleEdgeEndpointLabelPersist,
      handleEdgeLabelChange,
      handleEdgeLabelPositionChange,
      handleEdgeMulticastPositionChange,
      handleNodeLabelChange,
      handleNodeLabelPositionChange,
      handleNodeMulticastPositionChange,
      persistLabelPositions,
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
      <div style={{ width: "100%", height: "90vh", position: "relative" }}>
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
              <div className="diagram-readonly-banner">
                {isSampleDiagram ? "Diagrama de ejemplo: modo solo lectura." : "Modo solo lectura."}
              </div>
            )}
            <button
              type="button"
              className="channel-diagram__toggle-sidebar"
              onClick={toggleSidebar}
            >
              {sidebarVisible ? "Ocultar inspector" : "Mostrar inspector"}
            </button>
            {diagramMetadata?.description && (
              <div
                className={`diagram-metadata-banner${isSampleDiagram ? " diagram-metadata-banner--demo" : ""}`}
              >
                <strong className="diagram-metadata-banner__title">
                  {diagramMetadata?.title || "Diagrama"}
                </strong>
                <span className="diagram-metadata-banner__description">
                  {diagramMetadata.description}
                </span>
              </div>
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
                edgesReconnectable={!isReadOnly}
                reconnectRadius={20}
                onNodeDragStop={handleNodeDragStop}
                onReconnect={handleEdgeReconnect}
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
                <Controls position="bottom-left" />
              </ReactFlow>
            </DiagramContext.Provider>
          </div>
          {sidebarVisible && (
            <NodeEquipmentSidebar
              node={selectedNode}
              edges={edges}
              readOnly={isReadOnly}
              onLabelChange={handleNodeLabelChange}
              onDataPatch={handleNodeDataPatch}
              onLabelPositionChange={handleNodeLabelPositionChange}
              onMulticastPositionChange={handleNodeMulticastPositionChange}
              onFocusNode={focusNodeById}
              onDuplicateNode={handleDuplicateNode}
              onToggleNodeLock={handleNodeLockChange}
              onEnsureRouterEdges={(node) => ensureRouterEdges(node)}
              onRegenerateRouterEdges={(node) => ensureRouterEdges(node, { force: true })}
              persistLabelPositions={persistLabelPositions}
            />
          )}
        </div>
      </div>
    </ReactFlowProvider>
  );
};

export default ChannelDiagram;