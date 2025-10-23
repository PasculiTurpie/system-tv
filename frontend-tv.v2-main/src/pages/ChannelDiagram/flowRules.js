import normalizeHandle from "../../utils/normalizeHandle.js";
import {
  EMPTY_HANDLE_CONFIG,
  HANDLE_CONFIG_BY_TYPE,
} from "./handleConstants.js";

const EDGE_COLORS = Object.freeze({
  ida: "#ef4444",
  vuelta: "#16a34a",
});

const DEFAULT_MARKER = Object.freeze({ type: "arrowclosed", width: 16, height: 16 });

const HANDLE_PRESETS = Object.freeze({
  ...HANDLE_CONFIG_BY_TYPE,
  custom: EMPTY_HANDLE_CONFIG,
  image: EMPTY_HANDLE_CONFIG,
});

const SIDES = ["top", "right", "bottom", "left"];
const TYPES = ["source", "target"];

const cloneHandles = (handles = {}) => {
  const result = { source: {}, target: {} };
  TYPES.forEach((type) => {
    const entries = handles?.[type];
    SIDES.forEach((side) => {
      const list = Array.isArray(entries?.[side]) ? entries[side] : [];
      const seen = new Set();
      const normalizedList = [];
      list.forEach((value) => {
        if (typeof value !== "string") return;
        const normalized = normalizeHandle(value);
        if (!normalized || seen.has(normalized)) return;
        seen.add(normalized);
        normalizedList.push(normalized);
      });
      result[type][side] = normalizedList;
    });
  });
  return result;
};

const handlesArrayToConfig = (handles = []) => {
  const config = { source: {}, target: {} };
  TYPES.forEach((type) => {
    config[type] = {};
    SIDES.forEach((side) => {
      config[type][side] = [];
    });
  });

  if (!Array.isArray(handles)) {
    return config;
  }

  const seen = new Set();
  handles.forEach((handle) => {
    if (!handle || typeof handle !== "object") return;
    const rawId = typeof handle.id === "string" ? handle.id : handle?.handleId;
    if (!rawId) return;
    const trimmedId = String(rawId).trim();
    if (!trimmedId) return;
    const normalizedId = normalizeHandle(trimmedId);
    const candidateType = typeof handle.type === "string" ? handle.type.toLowerCase() : null;
    const resolvedType = candidateType === "target"
      ? "target"
      : candidateType === "source"
      ? "source"
      : normalizedId.startsWith("in-")
      ? "target"
      : normalizedId.startsWith("out-")
      ? "source"
      : null;
    if (!resolvedType || !config[resolvedType]) return;

    const candidateSide = typeof handle.side === "string" ? handle.side.toLowerCase() : null;
    const resolvedSide = SIDES.includes(candidateSide)
      ? candidateSide
      : inferSideFromHandle(normalizedId);
    if (!resolvedSide || !config[resolvedType][resolvedSide]) return;

    const dedupeKey = `${normalizedId}|${resolvedType}|${resolvedSide}`;
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    config[resolvedType][resolvedSide].push(normalizedId);
  });

  return config;
};

const mergeHandleConfig = (type, nodeHandles) => {
  const preset = HANDLE_PRESETS[type] || HANDLE_PRESETS.default;
  const merged = cloneHandles(preset);
  const custom = cloneHandles(nodeHandles);

  TYPES.forEach((kind) => {
    SIDES.forEach((side) => {
      const presetList = merged[kind][side];
      const customList = custom[kind][side];
      const concatenated = [...presetList, ...customList];
      const seen = new Set();
      merged[kind][side] = concatenated.filter((handleId) => {
        if (typeof handleId !== "string") return false;
        const normalized = normalizeHandle(handleId);
        if (!normalized || seen.has(normalized)) return false;
        seen.add(normalized);
        return true;
      });
    });
  });

  return merged;
};

const getNodeType = (node) => {
  const fromNode = typeof node?.type === "string" ? node.type : null;
  const fromData = typeof node?.data?.type === "string" ? node.data.type : null;
  return (fromNode || fromData || "default").toLowerCase();
};

const getNodeLabel = (node) => {
  if (!node) return "";
  if (typeof node?.data?.label === "string" && node.data.label.trim()) {
    return node.data.label.trim();
  }
  if (typeof node?.label === "string" && node.label.trim()) {
    return node.label.trim();
  }
  return String(node?.id ?? "").trim();
};

const resolveHandles = (node) => {
  const type = getNodeType(node);
  const handles = node?.handles ?? node?.data?.handles;
  const normalized = Array.isArray(handles)
    ? handlesArrayToConfig(handles)
    : handles;
  return mergeHandleConfig(type, normalized);
};

const inferSideFromHandle = (handleId) => {
  if (!handleId) return null;
  const normalized = normalizeHandle(handleId);
  if (normalized.includes("top")) return "top";
  if (normalized.includes("bottom")) return "bottom";
  if (normalized.includes("left")) return "left";
  if (normalized.includes("right")) return "right";
  return null;
};

export const pickHandle = (node, side, type) => {
  if (!node) return null;
  const normalizedType = type === "target" ? "target" : "source";
  const config = resolveHandles(node)[normalizedType];
  if (!config) return null;
  const normalizedSide = side ? side.toLowerCase() : null;

  if (normalizedSide && Array.isArray(config[normalizedSide]) && config[normalizedSide].length) {
    return config[normalizedSide][0];
  }

  for (const candidateSide of SIDES) {
    const list = config[candidateSide];
    if (Array.isArray(list) && list.length) {
      return list[0];
    }
  }

  const allHandles = Object.values(config).flat().filter(Boolean);
  return allHandles.length ? allHandles[0] : null;
};

const markerWithColor = (color) => ({ ...DEFAULT_MARKER, color });

export const getEdgeStyle = (direction) => {
  const normalized = direction === "vuelta" ? "vuelta" : "ida";
  const color = EDGE_COLORS[normalized] || EDGE_COLORS.ida;
  return {
    style: { stroke: color, strokeWidth: 2 },
    markerStart: normalized === "vuelta" ? markerWithColor(color) : undefined,
    markerEnd: normalized === "ida" ? markerWithColor(color) : undefined,
    animated: true,
  };
};

const gatherHandles = (node, type) => {
  const handles = resolveHandles(node)[type];
  if (!handles) return [];
  return SIDES.reduce((acc, side) => {
    const list = handles[side];
    if (Array.isArray(list) && list.length) {
      list.forEach((handleId) => {
        if (typeof handleId === "string") {
          acc.push(handleId);
        }
      });
    }
    return acc;
  }, []);
};

const ensureHandle = (edge, node, key, sideHint, kind) => {
  if (!node) return edge;
  const resolvedSide = sideHint || inferSideFromHandle(edge[key]);
  const handleId = pickHandle(node, resolvedSide, kind);
  if (!handleId) return edge;
  return { ...edge, [key]: handleId };
};

export const normalizeEdgeHandles = (edge, nodes = []) => {
  if (!edge || typeof edge !== "object") return edge;
  const map = new Map();
  nodes.forEach((node) => {
    if (node?.id) {
      map.set(node.id, node);
    }
  });

  let nextEdge = { ...edge };
  const sourceNode = map.get(edge.source);
  const targetNode = map.get(edge.target);
  const sourceHint = inferSideFromHandle(edge.sourceHandle);
  const targetHint = inferSideFromHandle(edge.targetHandle);

  nextEdge = ensureHandle(nextEdge, sourceNode, "sourceHandle", sourceHint, "source");
  nextEdge = ensureHandle(nextEdge, targetNode, "targetHandle", targetHint, "target");
  return nextEdge;
};

export const enforceSateliteToIrd = (edge, nodes = []) => {
  if (!edge || typeof edge !== "object") return edge;
  const nodeMap = new Map();
  nodes.forEach((node) => {
    if (node?.id) nodeMap.set(node.id, node);
  });
  const sourceNode = nodeMap.get(edge.source);
  const targetNode = nodeMap.get(edge.target);
  const sourceType = getNodeType(sourceNode);
  const targetType = getNodeType(targetNode);

  if (sourceType !== "satelite" || targetType !== "ird") {
    return edge;
  }

  const enforcedDirection = edge?.data?.direction || "ida";
  const styleInfo = getEdgeStyle(enforcedDirection);

  const nextEdge = {
    ...edge,
    type: edge.type || "smoothstep",
    data: { ...(edge.data || {}), direction: enforcedDirection },
    style: { ...(edge.style || {}), ...styleInfo.style },
    markerStart: styleInfo.markerStart,
    markerEnd: styleInfo.markerEnd,
    animated: styleInfo.animated,
  };

  const sourceHandle = pickHandle(sourceNode, "right", "source");
  const targetHandle = pickHandle(targetNode, "left", "target");

  if (sourceHandle) nextEdge.sourceHandle = sourceHandle;
  if (targetHandle) nextEdge.targetHandle = targetHandle;

  return nextEdge;
};

const shouldAutoLabel = (data = {}) => {
  if (data.autoLabel === false) return false;
  if (data.autoLabel) return true;
  return !!data.routerTemplate;
};

export const autoLabelEdge = (edge, nodes = []) => {
  if (!edge || typeof edge !== "object") return edge;
  const data = edge.data || {};
  if (!shouldAutoLabel(data)) return edge;

  const direction = data.direction === "vuelta" ? "vuelta" : "ida";
  const neighborId = direction === "vuelta" ? edge.source : edge.target;

  const nodeMap = new Map();
  nodes.forEach((node) => {
    if (node?.id) nodeMap.set(node.id, node);
  });

  const neighbor = nodeMap.get(neighborId);
  const prefix = direction === "vuelta" ? "RETORNO" : "IDA";
  const neighborLabel = getNodeLabel(neighbor);
  const labelText = neighborLabel ? `${prefix} ${neighborLabel}` : prefix;

  const currentLabel = (edge.data?.label || edge.label || "").trim();
  const hasSameLabel = currentLabel === labelText;
  const hadLabelPosition =
    Object.prototype.hasOwnProperty.call(data, "labelPosition") ||
    Object.prototype.hasOwnProperty.call(edge, "labelPosition");

  if (hasSameLabel && !hadLabelPosition && data.autoLabel === true) {
    return edge;
  }

  const nextData = { ...data, label: labelText, autoLabel: true };
  if (Object.prototype.hasOwnProperty.call(nextData, "labelPosition")) {
    delete nextData.labelPosition;
  }

  const nextEdge = { ...edge, label: labelText, data: nextData };
  if (Object.prototype.hasOwnProperty.call(nextEdge, "labelPosition")) {
    delete nextEdge.labelPosition;
  }

  return nextEdge;
};

const asNode = (candidate) => {
  if (!candidate) return null;
  if (typeof candidate === "string") {
    return { id: candidate };
  }
  if (candidate.id) return candidate;
  return null;
};

export const createRouterEdges = (routerNode, neighbors = []) => {
  const router = asNode(routerNode);
  if (!router?.id) return [];
  const neighborNodes = neighbors
    .map(asNode)
    .filter((node) => node && node.id && node.id !== router.id);
  if (!neighborNodes.length) {
    return [];
  }

  const sourceHandles = gatherHandles(router, "source");
  const targetHandles = gatherHandles(router, "target");
  if (!sourceHandles.length || !targetHandles.length) {
    return [];
  }

  const edges = [];

  for (let i = 0; i < 5; i += 1) {
    const handleIndex = i % sourceHandles.length;
    const neighborIndex = i % neighborNodes.length;
    const neighbor = neighborNodes[neighborIndex];
    const { style, markerEnd, markerStart, animated } = getEdgeStyle("ida");
    const targetHandle = pickHandle(neighbor, "left", "target") || pickHandle(neighbor, null, "target");
    const neighborLabel = getNodeLabel(neighbor);
    const labelText = neighborLabel ? `IDA ${neighborLabel}` : "IDA";
    edges.push({
      id: `${router.id}-ida-${i + 1}`,
      type: "smoothstep",
      source: router.id,
      target: neighbor.id,
      sourceHandle: sourceHandles[handleIndex],
      targetHandle,
      style,
      markerEnd,
      markerStart,
      animated,
      data: {
        direction: "ida",
        routerTemplate: router.id,
        autoLabel: true,
        label: labelText,
      },
      label: labelText,
    });
  }

  for (let i = 0; i < 5; i += 1) {
    const handleIndex = i % targetHandles.length;
    const neighborIndex = i % neighborNodes.length;
    const neighbor = neighborNodes[neighborIndex];
    const { style, markerEnd, markerStart, animated } = getEdgeStyle("vuelta");
    const sourceHandle = pickHandle(neighbor, "top", "source") || pickHandle(neighbor, null, "source");
    const neighborLabel = getNodeLabel(neighbor);
    const labelText = neighborLabel ? `RETORNO ${neighborLabel}` : "RETORNO";
    edges.push({
      id: `${router.id}-vuelta-${i + 1}`,
      type: "smoothstep",
      source: neighbor.id,
      target: router.id,
      sourceHandle,
      targetHandle: targetHandles[handleIndex],
      style,
      markerEnd,
      markerStart,
      animated,
      data: {
        direction: "vuelta",
        routerTemplate: router.id,
        autoLabel: true,
        label: labelText,
      },
      label: labelText,
    });
  }

  return edges;
};

export const inferHandleSide = inferSideFromHandle;
