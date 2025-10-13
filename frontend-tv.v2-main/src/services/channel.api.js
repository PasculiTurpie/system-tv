import api from "../utils/api";

const sanitizePayload = (payload = {}) => {
  const result = {};
  if (Array.isArray(payload.nodes)) {
    result.nodes = payload.nodes
      .map((node) => {
        if (!node || typeof node !== "object") return null;
        const id = node.id ?? node._id;
        if (id === undefined || id === null) return null;
        const data = node.data && typeof node.data === "object" ? node.data : {};
        const entry = { id: String(id) };
        if (data.labelPosition !== undefined) {
          entry.data = entry.data || {};
          entry.data.labelPosition = data.labelPosition;
        }
        if (data.multicastPosition !== undefined) {
          entry.data = entry.data || {};
          entry.data.multicastPosition = data.multicastPosition;
        }
        return entry.data ? entry : null;
      })
      .filter(Boolean);
  }

  if (Array.isArray(payload.edges)) {
    result.edges = payload.edges
      .map((edge) => {
        if (!edge || typeof edge !== "object") return null;
        const id = edge.id ?? edge._id;
        if (id === undefined || id === null) return null;
        const data = edge.data && typeof edge.data === "object" ? edge.data : {};
        const entry = { id: String(id) };
        if (data.labelPosition !== undefined) {
          entry.data = entry.data || {};
          entry.data.labelPosition = data.labelPosition;
        }
        if (data.multicastPosition !== undefined) {
          entry.data = entry.data || {};
          entry.data.multicastPosition = data.multicastPosition;
        }
        return entry.data ? entry : null;
      })
      .filter(Boolean);
  }

  return result;
};

export function patchLabelPositions(channelId, payload) {
  if (!channelId) {
    return Promise.reject(new Error("channelId is required"));
  }
  const body = sanitizePayload(payload);
  return api.patchChannelLabelPositions(channelId, body);
}

export default {
  patchLabelPositions,
};
