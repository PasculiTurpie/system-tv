import normalizeHandle from "../../utils/normalizeHandle";

const EDGE_COLORS = Object.freeze({
  ida: "#ef4444",
  vuelta: "#16a34a",
});

const DEFAULT_MARKER = Object.freeze({ type: "arrowclosed", width: 16, height: 16 });

const HANDLE_PRESETS = Object.freeze({
  satelite: {
    source: { right: ["out-right"] },
    target: {},
  },
  ird: {
    source: {},
    target: { left: ["in-left"] },
  },
  switch: {
    source: { top: ["src-top"], bottom: ["src-bottom"] },
    target: { top: ["tgt-top"], bottom: ["tgt-bottom"] },
  },
  router: {
    source: {
      right: ["out-right-1", "out-right-2"],
      bottom: ["out-bottom-1", "out-bottom-2", "out-bottom-3"],
      left: [],
      top: [],
    },
    target: {
      left: ["in-left-1", "in-left-2"],
      bottom: ["in-bottom-1", "in-bottom-2", "in-bottom-3"],
      right: [],
      top: [],
    },
  },
  custom: {
    source: { top: [], right: [], bottom: [], left: [] },
    target: { top: [], right: [], bottom: [], left: [] },
  },
  image: {
    source: { top: [], right: [], bottom: [], left: [] },
    target: { top: [], right: [], bottom: [], left: [] },
  },
  default: {
    source: { top: ["top-source"] },
    target: { top: ["top-target"] },
  },
});

const SIDES = ["top", "right", "bottom", "left"];
const TYPES = ["source", "target"];

const cloneHandles = (handles = {}) => {
  const result = { source: {}, target: {} };
  TYPES.forEach((type) => {
    const entries = handles?.[type];
    SIDES.forEach((side) => {
      const list = Array.isArray(entries?.[side]) ? entries[side] : [];
      result[type][side] = list.filter((value, index) => {
        if (typeof value !== "string") return false;
        const normalized = normalizeHandle(value);
        return normalized && list.findIndex((candidate) => normalizeHandle(candidate) === normalized) === index;
      });
    });
  });
  return result;
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

const resolveHandles = (node) => {
  const type = getNodeType(node);
  const handles = node?.handles || node?.data?.handles;
  return mergeHandleConfig(type, handles);
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
        label: neighbor?.data?.label ? `IDA ${neighbor.data.label}` : undefined,
      },
    });
  }

  for (let i = 0; i < 5; i += 1) {
    const handleIndex = i % targetHandles.length;
    const neighborIndex = i % neighborNodes.length;
    const neighbor = neighborNodes[neighborIndex];
    const { style, markerEnd, markerStart, animated } = getEdgeStyle("vuelta");
    const sourceHandle = pickHandle(neighbor, "top", "source") || pickHandle(neighbor, null, "source");
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
        label: neighbor?.data?.label ? `RETORNO ${neighbor.data.label}` : undefined,
      },
    });
  }

  return edges;
};

export const inferHandleSide = inferSideFromHandle;
