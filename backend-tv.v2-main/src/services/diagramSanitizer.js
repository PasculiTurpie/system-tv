const MAX_LABEL_LENGTH = 200;

const clampLabel = (value) => {
  if (value === undefined || value === null) return "";
  const str = String(value);
  const trimmed = str.trim();
  return trimmed.length > MAX_LABEL_LENGTH ? trimmed.slice(0, MAX_LABEL_LENGTH) : trimmed;
};

const clampCoordinate = (val) => {
  if (val === undefined || val === null) return null;
  if (typeof val === "string" && val.trim() === "") return null;
  const num = Number(val);
  if (!Number.isFinite(num)) return null;
  const bounded = Math.max(-1_000_000, Math.min(1_000_000, num));
  return Number.isFinite(bounded) ? bounded : 0;
};

const sanitizePosition = (point) => {
  if (!point || typeof point !== "object") return null;
  const x = clampCoordinate(point.x);
  const y = clampCoordinate(point.y);
  if (x === null || y === null) return null;
  return { x, y };
};

const sanitizeEndpointLabels = (payload = {}) => {
  const result = {};
  if (Object.prototype.hasOwnProperty.call(payload, "source")) {
    const value = payload.source;
    if (value === null) {
      result.source = null;
    } else if (value !== undefined) {
      const sanitized = clampLabel(value);
      result.source = sanitized || null;
    }
  }
  if (Object.prototype.hasOwnProperty.call(payload, "target")) {
    const value = payload.target;
    if (value === null) {
      result.target = null;
    } else if (value !== undefined) {
      const sanitized = clampLabel(value);
      result.target = sanitized || null;
    }
  }
  return result;
};

const sanitizeEndpointPositions = (payload = {}) => {
  const result = {};
  if (Object.prototype.hasOwnProperty.call(payload, "source")) {
    const sanitized = sanitizePosition(payload.source);
    result.source = sanitized;
  }
  if (Object.prototype.hasOwnProperty.call(payload, "target")) {
    const sanitized = sanitizePosition(payload.target);
    result.target = sanitized;
  }
  return result;
};

const ensureObject = (value) =>
  value && typeof value === "object" && !Array.isArray(value) ? value : {};

const sanitizeNodePayload = (node) => {
  if (!node || typeof node !== "object") return null;
  const id = String(node.id ?? node._id ?? "").trim();
  if (!id) return null;

  const position = sanitizePosition(node.position) || { x: 0, y: 0 };
  const data = { ...ensureObject(node.data) };
  const label = clampLabel(data.label ?? node.label ?? id);
  data.label = label;

  const labelPositionInput =
    data.labelPosition !== undefined
      ? data.labelPosition
      : node.labelPosition !== undefined
      ? node.labelPosition
      : undefined;

  if (labelPositionInput !== undefined) {
    const sanitized = sanitizePosition(labelPositionInput);
    if (sanitized) {
      data.labelPosition = sanitized;
    } else {
      delete data.labelPosition;
    }
  }

  const multicastPositionInput =
    data.multicastPosition !== undefined ? data.multicastPosition : undefined;

  if (multicastPositionInput !== undefined) {
    const sanitized = sanitizePosition(multicastPositionInput);
    if (sanitized) {
      data.multicastPosition = sanitized;
    } else {
      delete data.multicastPosition;
    }
  }

  const payload = {
    ...node,
    id,
    type: node.type || "custom",
    position,
    data,
    label,
  };

  if (Object.prototype.hasOwnProperty.call(payload, "labelPosition")) {
    delete payload.labelPosition;
  }

  return payload;
};

const mergeEndpointPayload = (edge) => ({
  ...(ensureObject(edge.endpointLabels)),
  ...(ensureObject(edge.data?.endpointLabels)),
});

const mergeEndpointPositionsPayload = (edge) => ({
  ...(ensureObject(edge.endpointLabelPositions)),
  ...(ensureObject(edge.data?.endpointLabelPositions)),
});

const sanitizeEdgePayload = (edge) => {
  if (!edge || typeof edge !== "object") return null;
  const id = String(edge.id ?? edge._id ?? "").trim();
  const source = String(edge.source ?? "").trim();
  const target = String(edge.target ?? "").trim();
  if (!id || !source || !target) return null;

  const data = { ...ensureObject(edge.data) };
  const style = edge.style && typeof edge.style === "object" ? { ...edge.style } : undefined;
  const payload = {
    ...edge,
    id,
    source,
    target,
    data,
  };
  if (style) payload.style = style;

  const label = clampLabel(data.label ?? edge.label ?? id);
  data.label = label;
  payload.label = label;

  const labelPositionInput =
    data.labelPosition !== undefined
      ? data.labelPosition
      : edge.labelPosition !== undefined
      ? edge.labelPosition
      : undefined;
  if (labelPositionInput !== undefined) {
    const sanitized = sanitizePosition(labelPositionInput);
    if (sanitized) {
      data.labelPosition = sanitized;
      payload.labelPosition = sanitized;
    } else {
      delete data.labelPosition;
      if (payload.labelPosition !== undefined) delete payload.labelPosition;
    }
  } else if (payload.labelPosition !== undefined) {
    const sanitized = sanitizePosition(payload.labelPosition);
    if (sanitized) {
      data.labelPosition = sanitized;
      payload.labelPosition = sanitized;
    } else {
      delete payload.labelPosition;
    }
  }

  const mergedLabels = mergeEndpointPayload(edge);
  const sanitizedLabels = sanitizeEndpointLabels(mergedLabels);
  const nextLabels = {};
  if (sanitizedLabels.source) nextLabels.source = sanitizedLabels.source;
  if (sanitizedLabels.target) nextLabels.target = sanitizedLabels.target;
  if (Object.keys(nextLabels).length) {
    data.endpointLabels = nextLabels;
  } else if (data.endpointLabels !== undefined) {
    delete data.endpointLabels;
  }

  const mergedPositions = mergeEndpointPositionsPayload(edge);
  const sanitizedPositions = sanitizeEndpointPositions(mergedPositions);
  const nextPositions = {};
  if (sanitizedPositions.source) nextPositions.source = sanitizedPositions.source;
  if (sanitizedPositions.target) nextPositions.target = sanitizedPositions.target;
  if (Object.keys(nextPositions).length) {
    data.endpointLabelPositions = nextPositions;
  } else if (data.endpointLabelPositions !== undefined) {
    delete data.endpointLabelPositions;
  }

  if (data.multicast !== undefined) {
    const sanitizedMulticast = clampLabel(data.multicast);
    if (sanitizedMulticast) {
      data.multicast = sanitizedMulticast;
    } else {
      delete data.multicast;
    }
  }

  const multicastPositionInput =
    data.multicastPosition !== undefined
      ? data.multicastPosition
      : edge.multicastPosition !== undefined
      ? edge.multicastPosition
      : undefined;
  if (multicastPositionInput !== undefined) {
    const sanitized = sanitizePosition(multicastPositionInput);
    if (sanitized) {
      data.multicastPosition = sanitized;
    } else {
      delete data.multicastPosition;
    }
  }

  [
    "endpointLabels",
    "endpointLabelPositions",
    "multicast",
    "multicastPosition",
  ].forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(payload, key)) {
      delete payload[key];
    }
  });

  return payload;
};

const sanitizeDiagramPayload = ({ nodes, edges } = {}) => {
  const sanitizedNodes = Array.isArray(nodes)
    ? nodes.map((node) => sanitizeNodePayload(node)).filter(Boolean)
    : [];
  const sanitizedEdges = Array.isArray(edges)
    ? edges.map((edge) => sanitizeEdgePayload(edge)).filter(Boolean)
    : [];
  return { nodes: sanitizedNodes, edges: sanitizedEdges };
};

module.exports = {
  clampLabel,
  sanitizePosition,
  sanitizeEndpointLabels,
  sanitizeEndpointPositions,
  sanitizeNodePayload,
  sanitizeEdgePayload,
  sanitizeDiagramPayload,
};
