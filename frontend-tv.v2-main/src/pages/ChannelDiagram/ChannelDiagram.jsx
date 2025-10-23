import { useEffect, useMemo, useState, useCallback, useRef, useContext } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  useEdgesState,
  useNodesState,
  applyEdgeChanges,
  applyNodeChanges,
  ReactFlowProvider,
  SmoothStepEdge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useParams } from "react-router-dom";
import api from "../../utils/api";
import CustomNode from "./CustomNode";
import RouterNode from "./RouterNode";
import SateliteNode from "./nodes/SateliteNode";
import IrdNode from "./nodes/IrdNode";
import SwitchNode from "./nodes/SwitchNode";
import DefaultNode from "./nodes/DefaultNode";
import CustomDirectionalEdge from "./CustomDirectionalEdge";
import CustomWaypointEdge from "./CustomWaypointEdge";
import "./ChannelDiagram.css";
import { UserContext } from "../../components/context/UserContext";
import NodeEquipmentSidebar from "./NodeEquipmentSidebar";
import { DiagramContext } from "./DiagramContext";
import {
  toApiNode,
  toApiEdge,
  clampPositionWithinBounds,
  createPatchScheduler,
  MAX_LABEL_LENGTH,
  prepareDiagramState,
  isRouterNode,
  normalizeHandlesArray,
} from "./diagramUtils";
import {
  autoLabelEdge,
  createRouterEdges,
  enforceSateliteToIrd,
  getEdgeStyle,
  normalizeEdgeHandles,
} from "./flowRules";
import { HANDLE_CONFIG_BY_TYPE, ROUTER_HANDLE_OPTIONS } from "./handleConstants.js";
import { createPersistLabelPositions } from "./persistLabelPositions";
import { getSampleDiagramById } from "./samples";
import normalizeHandle from "../../utils/normalizeHandle";
import { clearLocalStorage } from "../../utils/localStorageUtils";

const AUTO_SAVE_DELAY = 320;
const FIT_VIEW_PADDING = 0.2;
const ZOOM_DURATION = 160;
const BOUNDS_MARGIN = 480;
const DEFAULT_BOUNDS = { minX: -4000, maxX: 4000, minY: -4000, maxY: 4000 };

const createUniqueEdgeId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `edge-${crypto.randomUUID()}`;
  }
  return `edge-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

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

const getNodeTypeName = (node) => {
  const explicit = node?.type || node?.data?.type;
  return typeof explicit === "string" ? explicit.toLowerCase() : "custom";
};

const buildFallbackHandles = (sideMap) => {
  if (!sideMap || typeof sideMap !== "object") return [];
  return Object.entries(sideMap).flatMap(([side, handles]) => {
    if (!Array.isArray(handles) || handles.length === 0) return [];
    return handles.map((id) => ({ id, side }));
  });
};

const FALLBACK_NODE_HANDLES = Object.freeze(
  Object.fromEntries(
    Object.entries(HANDLE_CONFIG_BY_TYPE).map(([type, config]) => [
      type,
      Object.freeze({
        source: Object.freeze(buildFallbackHandles(config?.source)),
        target: Object.freeze(buildFallbackHandles(config?.target)),
      }),
    ])
  )
);

const guessHandleSide = (handleId, explicitSide) => {
  if (typeof explicitSide === "string" && explicitSide) {
    return explicitSide.toLowerCase();
  }
  const normalized = normalizeHandle(handleId);
  if (!normalized) return null;
  if (normalized.includes("left")) return "left";
  if (normalized.includes("right")) return "right";
  if (normalized.includes("top")) return "top";
  if (normalized.includes("bottom")) return "bottom";
  return null;
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
  const normalizedHandles = normalizeHandlesArray(node.handles || node.data?.handles);
  const fromHandles = normalizedHandles
    .filter((handle) => handle.type === normalizedKind && handle.id)
    .map((handle) => ({
      id: handle.id,
      kind: normalizedKind,
      side: guessHandleSide(handle.id, handle.side),
    }))
    .filter((handle) => handle.side || handle.id);
  if (fromHandles.length) return fromHandles;

  const nodeType = getNodeTypeName(node);
  const fallback = FALLBACK_NODE_HANDLES[nodeType];
  if (fallback && Array.isArray(fallback[normalizedKind]) && fallback[normalizedKind].length) {
    return fallback[normalizedKind].map((handle) => ({
      id: handle.id,
      kind: normalizedKind,
      side: guessHandleSide(handle.id, handle.side),
    }));
  }

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

const allocateHandleId = (options, preferredSides, usedSet, fallbackNormalized) => {
  if (!Array.isArray(options) || options.length === 0) return null;

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

  const findByNormalized = (candidate) =>
    ordered.find((option) => normalizeHandle(option.id) === candidate) || null;

  if (fallbackNormalized && !usedSet.has(fallbackNormalized)) {
    const preferred = findByNormalized(fallbackNormalized);
    if (preferred) {
      return { id: preferred.id, normalized: fallbackNormalized };
    }
  }

  const available = ordered.find((option) => {
    const normalized = normalizeHandle(option.id);
    return normalized && !usedSet.has(normalized);
  });
  if (available) {
    const normalized = normalizeHandle(available.id);
    return { id: available.id, normalized };
  }

  if (fallbackNormalized) {
    const fallbackOption = findByNormalized(fallbackNormalized);
    if (fallbackOption) {
      return { id: fallbackOption.id, normalized: fallbackNormalized };
    }
    return { id: fallbackNormalized, normalized: fallbackNormalized };
  }

  const firstOption = ordered[0];
  return { id: firstOption.id, normalized: normalizeHandle(firstOption.id) };
};

const assignHandle = (node, kind, providedHandle, usedSet, preferredSides) => {
  const normalizedProvided = normalizeHandle(providedHandle);

  if (!node) {
    if (normalizedProvided) {
      usedSet.add(normalizedProvided);
      return providedHandle || normalizedProvided;
    }
    return providedHandle || null;
  }

  const normalizedKind = kind === "target" ? "target" : "source";
  const options = getNodeHandleOptions(node, normalizedKind);

  if (normalizedProvided) {
    const matching = options.find((option) => normalizeHandle(option.id) === normalizedProvided);
    if (matching && !usedSet.has(normalizedProvided)) {
      usedSet.add(normalizedProvided);
      return matching.id;
    }
  }

  const allocation = allocateHandleId(options, preferredSides, usedSet, normalizedProvided);
  if (allocation?.id) {
    if (allocation.normalized) usedSet.add(allocation.normalized);
    return allocation.id;
  }

  if (normalizedProvided) {
    usedSet.add(normalizedProvided);
    return providedHandle || normalizedProvided;
  }
  return providedHandle || null;
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
    () => ({
      custom: CustomNode,
      router: RouterNode,
      satelite: SateliteNode,
      ird: IrdNode,
      switch: SwitchNode,
      default: DefaultNode,
    }),
    []
  );

  const edgeTypes = useMemo(
    () => ({
      directional: CustomDirectionalEdge,
      waypoint: CustomWaypointEdge,
      smoothstep: SmoothStepEdge,
    }),
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

  const refreshAutoLabelsForNodes = useCallback(
    (nodeIds) => {
      if (!nodeIds || nodeIds.size === 0) return;
      updateEdges((current) => {
        const nodesList = nodesRef.current;
        let changed = false;
        const next = current.map((edge) => {
          if (!edge?.data) return edge;
          if (edge.data.autoLabel === false) return edge;
          if (!nodeIds.has(edge.source) && !nodeIds.has(edge.target)) return edge;
          const relabeled = autoLabelEdge(edge, nodesList);
          if (relabeled !== edge) {
            changed = true;
            return relabeled;
          }
          return edge;
        });
        return changed ? next : current;
      });
    },
    [updateEdges]
  );

  const toggleSidebar = useCallback(() => {
    setSidebarVisible((prev) => !prev);
  }, []);

  const handleClearLocalStorageClick = useCallback(() => {
    const cleaned = clearLocalStorage();
    if (cleaned) {
      console.info("localStorage limpiado desde el visor de topología");
    }
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
    (node) => {
      if (!node || !isRouterNode(node)) return { added: 0, removed: 0 };

      const nodesList = nodesRef.current;
      const neighbors = nodesList.filter((candidate) => candidate.id !== node.id);
      const templateEdges = createRouterEdges(node, neighbors)
        .map((edge) => normalizeEdgeHandles(edge, nodesList))
        .map((edge) => autoLabelEdge(edge, nodesList))
        .map((edge) => ({
          ...enforceSateliteToIrd(edge, nodesList),
          reconnectable: true,
        }));

      let removed = 0;

      updateEdges((current) => {
        const filtered = current.filter((edge) => edge.data?.routerTemplate !== node.id);
        removed = current.length - filtered.length;
        if (!templateEdges.length && !removed) {
          return ensureEdgesUseDistinctHandles(nodesList, filtered);
        }

        const merged = [
          ...filtered,
          ...templateEdges.map((edge) => ({
            ...edge,
            data: { ...(edge.data || {}), routerTemplate: node.id },
          })),
        ];

        return ensureEdgesUseDistinctHandles(nodesList, merged);
      });

      if ((templateEdges.length || removed) && isAuth) requestSave();
      return { added: templateEdges.length, removed };
    },
    [isAuth, requestSave, updateEdges]
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

  const nodeHandlesPatchScheduler = useMemo(() => {
    if (!channelId || !isAuth || isSampleDiagram) return null;
    return createPatchScheduler((nodeKey, payload) =>
      api.patchChannelNodeHandles(channelId, nodeKey, payload)
    );
  }, [channelId, isAuth, isSampleDiagram]);

  const edgePatchScheduler = useMemo(() => {
    if (!channelId || !isAuth || isSampleDiagram) return null;
    return createPatchScheduler((edgeKey, payload) => api.patchChannelEdge(channelId, edgeKey, payload));
  }, [channelId, isAuth, isSampleDiagram]);

  useEffect(() => () => { nodePatchScheduler?.cancelAll(); }, [nodePatchScheduler]);
  useEffect(() => () => { nodeHandlesPatchScheduler?.cancelAll(); }, [nodeHandlesPatchScheduler]);
  useEffect(() => () => { edgePatchScheduler?.cancelAll(); }, [edgePatchScheduler]);

  const scheduleNodePatch = useCallback(
    (nodeId, patch, options) => { if (nodePatchScheduler) nodePatchScheduler.schedule(nodeId, patch, options); },
    [nodePatchScheduler]
  );

  const scheduleNodeHandlesPatch = useCallback(
    (nodeId, patch, options) => {
      if (nodeHandlesPatchScheduler) nodeHandlesPatchScheduler.schedule(nodeId, patch, options);
    },
    [nodeHandlesPatchScheduler]
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
      refreshAutoLabelsForNodes(new Set([nodeId]));
      if (isAuth) scheduleNodePatch(nodeId, { label: sanitized });
      requestSave();
    },
    [isAuth, refreshAutoLabelsForNodes, scheduleNodePatch, updateNodes, requestSave]
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

  const handleNodeHandlesChange = useCallback(
    (nodeId, nextHandles, options = {}) => {
      if (!nodeId) return;
      const sanitized = normalizeHandlesArray(nextHandles).map((handle) => ({ ...handle }));
      const previousNode = nodesRef.current.find((node) => node.id === nodeId);
      const previousHandles = previousNode?.handles
        ? previousNode.handles.map((handle) => ({ ...handle }))
        : [];

      updateNodes((current) =>
        current.map((node) =>
          node.id === nodeId
            ? {
                ...node,
                handles: sanitized,
                data: { ...(node.data || {}), handles: sanitized },
              }
            : node
        )
      );

      if (isAuth) {
        scheduleNodeHandlesPatch(nodeId, { handles: sanitized }, {
          onSuccess: options.onSuccess,
          onError: (error) => {
            updateNodes((current) =>
              current.map((node) =>
                node.id === nodeId
                  ? {
                      ...node,
                      handles: previousHandles,
                      data: { ...(node.data || {}), handles: previousHandles },
                    }
                  : node
              )
            );
            options.onError?.(error);
          },
        });
      } else {
        options.onSuccess?.();
      }

      requestSave();
    },
    [isAuth, scheduleNodeHandlesPatch, updateNodes, requestSave]
  );

  const handleNodeDataPatch = useCallback(
    (nodeId, dataPatch = {}) => {
      if (!nodeId || !dataPatch || typeof dataPatch !== "object") return;
      const affectsLabel = Object.prototype.hasOwnProperty.call(dataPatch, "label");

      updateNodes((current) =>
        current.map((node) =>
          node.id === nodeId ? { ...node, data: { ...(node.data || {}), ...dataPatch } } : node
        )
      );

      if (affectsLabel) {
        refreshAutoLabelsForNodes(new Set([nodeId]));
      }

      if (isAuth) scheduleNodePatch(nodeId, { data: dataPatch });
      requestSave();
    },
    [isAuth, refreshAutoLabelsForNodes, scheduleNodePatch, updateNodes, requestSave]
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
      const existing = edgesRef.current.find((edge) => edge.id === edgeId);
      const hadAutoLabel =
        existing?.data?.autoLabel !== false &&
        (existing?.data?.autoLabel || existing?.data?.routerTemplate);
      updateEdges((current) =>
        current.map((edge) =>
          edge.id === edgeId
            ? {
                ...edge,
                label: sanitized,
                data: {
                  ...(edge.data || {}),
                  label: sanitized,
                  ...(edge.data?.autoLabel ? { autoLabel: false } : {}),
                },
              }
            : edge
        )
      );
      if (isAuth) {
        const patchPayload = hadAutoLabel
          ? { label: sanitized, data: { label: sanitized, autoLabel: false } }
          : { label: sanitized, data: { label: sanitized } };
        scheduleEdgePatch(edgeId, patchPayload);
      }
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
      requestSave();
    },
    [clampPosition, updateEdges, requestSave]
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
          const nextData = { ...(edge.data || {}), endpointLabels: currentLabels };
          if (endpoint === "source") {
            if (sanitized) nextData.labelStart = sanitized;
            else delete nextData.labelStart;
          } else if (endpoint === "target") {
            if (sanitized) nextData.labelEnd = sanitized;
            else delete nextData.labelEnd;
          }
          return { ...edge, data: nextData };
        })
      );
      if (isAuth) {
        const payload = {
          endpointLabels: { [endpoint]: sanitized || null },
          data:
            endpoint === "source"
              ? { labelStart: sanitized || null }
              : { labelEnd: sanitized || null },
        };
        scheduleEdgePatch(edgeId, payload);
      }
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
      requestSave();
    },
    [clampPosition, updateEdges, requestSave]
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
      requestSave();
    },
    [clampPosition, updateEdges, requestSave]
  );

  const handleNodeDragStop = useCallback(() => { requestSave(); }, [requestSave]);

  const handleEdgeReconnect = useCallback(
    (oldEdge, newConnection) => {
      if (!isAuth) return;
      let updatedEdgeSnapshot = null;
      let labelPositionCleared = false;
      const clearedEndpoints = new Set();

      updateEdges((current) => {
        const nodesList = nodesRef.current;
        const next = current.map((edge) => {
          if (edge.id !== oldEdge.id) return edge;
          const connectionChanged =
            edge.source !== newConnection.source ||
            edge.target !== newConnection.target ||
            edge.sourceHandle !== newConnection.sourceHandle ||
            edge.targetHandle !== newConnection.targetHandle;
          const updated = {
            ...edge,
            source: newConnection.source,
            target: newConnection.target,
            sourceHandle: newConnection.sourceHandle,
            targetHandle: newConnection.targetHandle,
            reconnectable: true,
          };
          const withHandles = normalizeEdgeHandles(updated, nodesList);
          const enforced = enforceSateliteToIrd(withHandles, nodesList);
          let relabeled = autoLabelEdge(enforced, nodesList);

          if (connectionChanged) {
            const previousPositions = edge?.data?.endpointLabelPositions || {};
            const hadSource = Boolean(previousPositions.source);
            const hadTarget = Boolean(previousPositions.target);
            if (hadSource || hadTarget) {
              const nextData = { ...(relabeled.data || {}) };
              if (Object.prototype.hasOwnProperty.call(nextData, "endpointLabelPositions")) {
                delete nextData.endpointLabelPositions;
              }
              relabeled = { ...relabeled, data: nextData };
              if (hadSource) clearedEndpoints.add("source");
              if (hadTarget) clearedEndpoints.add("target");
            }
          }
          labelPositionCleared =
            (edge?.data?.labelPosition || edge?.labelPosition) &&
            !(relabeled?.data?.labelPosition || relabeled?.labelPosition);
          updatedEdgeSnapshot = relabeled;
          return relabeled;
        });
        return ensureEdgesUseDistinctHandles(nodesList, next);
      });

      if (!updatedEdgeSnapshot) {
        requestSave();
        return;
      }

      if (labelPositionCleared) {
        const store = confirmedEdgePositionsRef.current;
        const existingEntry = store.get(updatedEdgeSnapshot.id) || {};
        store.set(updatedEdgeSnapshot.id, {
          labelPosition: null,
          endpointLabelPositions: existingEntry.endpointLabelPositions || {},
          multicastPosition: existingEntry.multicastPosition || null,
        });
        if (persistLabelPositions && !isReadOnly) {
          persistLabelPositions({
            edges: { [updatedEdgeSnapshot.id]: { labelPosition: null } },
          }).catch((error) => {
            console.error("Persist auto-label reset failed", error);
          });
        }
      }

      if (clearedEndpoints.size) {
        const store = confirmedEdgePositionsRef.current;
        const existingEntry = store.get(updatedEdgeSnapshot.id) || {};
        const nextEntry = {
          labelPosition: existingEntry.labelPosition || null,
          endpointLabelPositions: { ...(existingEntry.endpointLabelPositions || {}) },
          multicastPosition: existingEntry.multicastPosition || null,
        };
        clearedEndpoints.forEach((endpoint) => {
          delete nextEntry.endpointLabelPositions[endpoint];
        });
        store.set(updatedEdgeSnapshot.id, nextEntry);
        if (persistLabelPositions && !isReadOnly) {
          const endpointPayload = {};
          clearedEndpoints.forEach((endpoint) => {
            endpointPayload[endpoint] = null;
          });
          persistLabelPositions({
            endpointLabelPositions: {
              [updatedEdgeSnapshot.id]: endpointPayload,
            },
          }).catch((error) => {
            console.error("Persist endpoint label reset failed", error);
          });
        }
      }

      if (isAuth) {
        const payload = {
          source: updatedEdgeSnapshot.source,
          target: updatedEdgeSnapshot.target,
          sourceHandle: updatedEdgeSnapshot.sourceHandle || null,
          targetHandle: updatedEdgeSnapshot.targetHandle || null,
          label: updatedEdgeSnapshot.data?.label || updatedEdgeSnapshot.label || "",
          data: {
            ...(updatedEdgeSnapshot.data || {}),
            label: updatedEdgeSnapshot.data?.label || updatedEdgeSnapshot.label || "",
            ...(labelPositionCleared ? { labelPosition: null } : {}),
          },
          style: updatedEdgeSnapshot.style,
          markerStart: updatedEdgeSnapshot.markerStart,
          markerEnd: updatedEdgeSnapshot.markerEnd,
          animated: updatedEdgeSnapshot.animated,
        };
        scheduleEdgePatch(updatedEdgeSnapshot.id, payload);
      }

      requestSave();
    },
    [
      isAuth,
      isReadOnly,
      persistLabelPositions,
      requestSave,
      scheduleEdgePatch,
      updateEdges,
    ]
  );

  const handleConnect = useCallback(
    (connection) => {
      if (!isAuth) return;
      if (!connection?.source || !connection?.target) return;
      const direction = connection?.data?.direction || "ida";
      const nodesList = nodesRef.current;
      const styleInfo = getEdgeStyle(direction);

      const baseEdge = {
        id: createUniqueEdgeId(),
        source: connection.source,
        target: connection.target,
        sourceHandle: connection.sourceHandle,
        targetHandle: connection.targetHandle,
        type: "smoothstep",
        data: {
          label: "",
          direction,
          labelPosition: null,
          endpointLabels: {},
          endpointLabelPositions: {},
        },
        label: "",
        style: styleInfo.style,
        markerStart: styleInfo.markerStart,
        markerEnd: styleInfo.markerEnd,
        animated: styleInfo.animated,
        reconnectable: true,
      };

      const normalizedEdge = autoLabelEdge(
        enforceSateliteToIrd(normalizeEdgeHandles(baseEdge, nodesList), nodesList),
        nodesList
      );

      updateEdges((current) => {
        const next = [...current, normalizedEdge];
        return ensureEdgesUseDistinctHandles(nodesList, next);
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
        updateEdges((current) => {
          const nodesList = nodesRef.current;
          const adjusted = current.map((edge) =>
            enforceSateliteToIrd(normalizeEdgeHandles(edge, nodesList), nodesList)
          );
          return ensureEdgesUseDistinctHandles(nodesList, adjusted);
        });
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
      onNodeHandlesChange: handleNodeHandlesChange,
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
      handleNodeHandlesChange,
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
            <div className="channel-diagram__action-bar">
              <button
                type="button"
                className="channel-diagram__toggle-sidebar"
                onClick={toggleSidebar}
              >
                {sidebarVisible ? "Ocultar inspector" : "Mostrar inspector"}
              </button>
            </div>
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