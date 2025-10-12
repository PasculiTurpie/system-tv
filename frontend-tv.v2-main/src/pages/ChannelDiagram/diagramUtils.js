import { getSmoothStepPath } from "@xyflow/react";

export const ARROW_CLOSED = { type: "arrowclosed" };

export const MAX_LABEL_LENGTH = 200;

export const toNumberOr = (val, def = 0) => {
  const n = Number(val);
  return Number.isFinite(n) ? n : def;
};

export const normalizeMarker = (marker) => {
  if (!marker || typeof marker !== "object") return { ...ARROW_CLOSED };
  const { type, ...rest } = marker;
  if (type === "arrowclosed" || type === "arrow") {
    return { type, ...rest };
  }
  if (type === 1 || type === "1") {
    return { type: "arrowclosed", ...rest };
  }
  if (type === 0 || type === "0") {
    return { type: "arrow", ...rest };
  }
  return { type: "arrowclosed", ...rest };
};

export const getEdgeColor = (style, direction) =>
  style?.stroke || (direction === "vuelta" ? "green" : "red");

export const withMarkerColor = (marker, color) => ({
  ...normalizeMarker(marker || ARROW_CLOSED),
  color,
});

export const safeArray = (val) => (Array.isArray(val) ? val : []);

const compareById = (a, b) => {
  const idA = String(a?.id ?? "").trim();
  const idB = String(b?.id ?? "").trim();
  if (!idA && !idB) return 0;
  if (!idA) return -1;
  if (!idB) return 1;
  return idA.localeCompare(idB, undefined, { numeric: true, sensitivity: "base" });
};

export const sortNodesById = (nodes) =>
  safeArray(nodes)
    .map((node) => ({ ...node }))
    .sort(compareById);

export const sortEdgesById = (edges) =>
  safeArray(edges)
    .map((edge) => ({ ...edge }))
    .sort(compareById);

const clampLabel = (value) => {
  if (value === undefined || value === null) return "";
  const str = String(value);
  const trimmed = str.trim();
  return trimmed.length > MAX_LABEL_LENGTH
    ? trimmed.slice(0, MAX_LABEL_LENGTH)
    : trimmed;
};

export const mapNodeFromApi = (node) => {
  if (!node) return null;
  const id = String(node.id ?? node._id ?? node.key ?? "");
  if (!id) return null;

  const rawData = node.data || {};
  const getPos = (val, index) => {
    if (val !== undefined && val !== null) return val;
    if (Array.isArray(node.position)) return node.position[index];
    return undefined;
  };

  const label = clampLabel(rawData.label ?? node.label ?? id);

  return {
    id,
    type: node.type || "custom",
    data: {
      ...rawData,
      label,
      labelPosition: rawData.labelPosition || null,
    },
    position: {
      x: toNumberOr(getPos(node.position?.x, 0), 0),
      y: toNumberOr(getPos(node.position?.y, 1), 0),
    },
  };
};

const normalizeLabelPosition = (edge) => {
  const dataPosition = edge?.data?.labelPosition || edge?.data?.labelPos || null;
  if (dataPosition && typeof dataPosition === "object") {
    const { x, y } = dataPosition;
    if (Number.isFinite(x) && Number.isFinite(y)) {
      return { x, y };
    }
  }

  const legacy = edge?.labelPosition;
  if (legacy && typeof legacy === "object") {
    const { x, y } = legacy;
    if (Number.isFinite(x) && Number.isFinite(y)) {
      return { x, y };
    }
  }
  return null;
};

const normalizeEndpointLabelPositions = (rawPositions) => {
  if (!rawPositions || typeof rawPositions !== "object") return {};
  const normalizePoint = (point) => {
    if (!point || typeof point !== "object") return undefined;
    const x = Number(point.x);
    const y = Number(point.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return undefined;
    return { x, y };
  };

  const result = {};
  const source = normalizePoint(rawPositions.source);
  const target = normalizePoint(rawPositions.target);
  if (source) result.source = source;
  if (target) result.target = target;
  return result;
};

const normalizeEndpointLabels = (rawLabels) => {
  if (!rawLabels || typeof rawLabels !== "object") return {};
  const result = {};
  if (rawLabels.source !== undefined && rawLabels.source !== null) {
    result.source = clampLabel(rawLabels.source);
  }
  if (rawLabels.target !== undefined && rawLabels.target !== null) {
    result.target = clampLabel(rawLabels.target);
  }
  return result;
};

export const mapEdgeFromApi = (edge) => {
  if (!edge) return null;
  const id = String(edge.id ?? edge._id ?? "");
  if (!id || !edge.source || !edge.target) return null;

  const rawData = edge.data || {};
  const direction = rawData.direction || (edge.style?.stroke === "green" ? "vuelta" : "ida");
  const label = clampLabel(edge.label || rawData.label || id);
  const color = getEdgeColor(edge.style, direction);
  const style = edge.style
    ? { ...edge.style, stroke: edge.style.stroke || color }
    : { stroke: color, strokeWidth: 2 };

  const labelPosition = normalizeLabelPosition(edge);
  const endpointLabels = normalizeEndpointLabels(rawData.endpointLabels);
  const endpointLabelPositions = normalizeEndpointLabelPositions(
    rawData.endpointLabelPositions
  );

  return {
    id,
    source: String(edge.source),
    target: String(edge.target),
    sourceHandle: edge.sourceHandle,
    targetHandle: edge.targetHandle,
    type: edge.type || "directional",
    label,
    data: {
      ...rawData,
      label,
      direction,
      labelPosition,
      endpointLabels,
      endpointLabelPositions,
    },
    style,
    markerEnd: withMarkerColor(edge.markerEnd, color),
    markerStart: edge.markerStart ? withMarkerColor(edge.markerStart, color) : undefined,
    animated: edge.animated ?? true,
    updatable: true,
  };
};

export const toApiNode = (node) => {
  const label = clampLabel(node.data?.label ?? node.label ?? node.id);
  const data = {
    ...(node.data || {}),
    label,
  };
  if (node.data?.labelPosition) {
    data.labelPosition = node.data.labelPosition;
  }

  return {
    id: node.id,
    type: node.type || "custom",
    label,
    data,
    position: {
      x: Number.isFinite(+node.position?.x) ? +node.position.x : 0,
      y: Number.isFinite(+node.position?.y) ? +node.position.y : 0,
    },
  };
};

export const toApiEdge = (edge) => {
  const label = clampLabel(edge.data?.label || edge.label || edge.id);
  const direction = edge.data?.direction || "ida";
  const color = getEdgeColor(edge.style, direction);
  const labelPosition = edge.data?.labelPosition || null;
  const endpointLabels = edge.data?.endpointLabels || {};
  const endpointLabelPositions = edge.data?.endpointLabelPositions || {};

  const data = {
    ...(edge.data || {}),
    label,
    direction,
    labelPosition,
    endpointLabels,
    endpointLabelPositions,
  };

  const payload = {
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
    data,
    animated: edge.animated ?? true,
    updatable: true,
  };

  if (labelPosition) {
    payload.labelPosition = labelPosition;
  }

  return payload;
};

export const prepareDiagramState = (diagram) => {
  if (!diagram) {
    return { nodes: [], edges: [] };
  }

  const mappedNodes = safeArray(diagram.nodes)
    .map(mapNodeFromApi)
    .filter(Boolean);
  const mappedEdges = safeArray(diagram.edges)
    .map(mapEdgeFromApi)
    .filter(Boolean);

  const sortedNodes = sortNodesById(mappedNodes);
  const validNodeIds = new Set(sortedNodes.map((node) => node.id));

  const sortedEdges = sortEdgesById(mappedEdges).filter(
    (edge) => validNodeIds.has(edge.source) && validNodeIds.has(edge.target)
  );

  return { nodes: sortedNodes, edges: sortedEdges };
};

export const clampPositionWithinBounds = (pos, bounds) => {
  if (!pos || typeof pos !== "object") return pos;
  const next = { x: Number(pos.x), y: Number(pos.y) };
  if (!Number.isFinite(next.x) || !Number.isFinite(next.y)) {
    return { x: 0, y: 0 };
  }
  if (!bounds) return next;
  const { minX, maxX, minY, maxY } = bounds;
  const clamp = (value, min, max) => {
    if (!Number.isFinite(value)) return value;
    let clamped = value;
    if (Number.isFinite(min)) clamped = Math.max(clamped, min);
    if (Number.isFinite(max)) clamped = Math.min(clamped, max);
    return clamped;
  };
  return {
    x: clamp(next.x, minX, maxX),
    y: clamp(next.y, minY, maxY),
  };
};

const mergePatch = (target, source) => {
  const result = { ...target };
  Object.keys(source || {}).forEach((key) => {
    const value = source[key];
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      !(value instanceof Date)
    ) {
      result[key] = mergePatch(result[key] || {}, value);
    } else {
      result[key] = value;
    }
  });
  return result;
};

export const createPatchScheduler = (executor, { delay = 320 } = {}) => {
  const timeouts = new Map();
  const payloads = new Map();

  const flush = async (key) => {
    const payload = payloads.get(key);
    timeouts.delete(key);
    payloads.delete(key);
    if (!payload) return;
    try {
      await executor(key, payload);
    } catch (error) {
      console.error("Patch scheduler error:", error);
    }
  };

  const schedule = (key, patch) => {
    if (!key) return;
    const current = payloads.get(key) || {};
    payloads.set(key, mergePatch(current, patch));

    if (timeouts.has(key)) {
      clearTimeout(timeouts.get(key));
    }

    timeouts.set(
      key,
      setTimeout(() => {
        flush(key);
      }, delay)
    );
  };

  const cancelAll = () => {
    for (const timeout of timeouts.values()) {
      clearTimeout(timeout);
    }
    timeouts.clear();
    payloads.clear();
  };

  return { schedule, cancelAll, flush };
};

export const computeParallelPath = ({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  isReverse,
  offset = 10,
}) => {
  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const vertical = Math.abs(dy) >= Math.abs(dx);

  const sign = isReverse ? 1 : -1;
  const ox = vertical ? sign * offset : 0;
  const oy = vertical ? 0 : sign * offset;

  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX: sourceX + ox,
    sourceY: sourceY + oy,
    targetX: targetX + ox,
    targetY: targetY + oy,
    sourcePosition,
    targetPosition,
    borderRadius: 0,
  });

  return [path, labelX + ox, labelY + oy, { ox, oy }];
};

export const resolveLabelPosition = (position, defaultPosition, clampPositionFn) => {
  const basePosition =
    position &&
    typeof position === "object" &&
    Number.isFinite(position.x) &&
    Number.isFinite(position.y)
      ? position
      : defaultPosition;
  if (!basePosition) {
    return { x: 0, y: 0 };
  }
  return clampPositionFn ? clampPositionFn(basePosition) : basePosition;
};

