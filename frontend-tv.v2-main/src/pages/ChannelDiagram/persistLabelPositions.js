import { patchLabelPositions as patchLabelPositionsApi } from "../../services/channel.api.js";

const normalizeId = (value) => {
  if (value === undefined || value === null) return "";
  const str = String(value).trim();
  return str.length ? str : "";
};

const normalizePosition = (value) => {
  if (value === null) return null;
  if (!value || typeof value !== "object") return undefined;
  const x = Number(value.x);
  const y = Number(value.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return undefined;
  return { x, y };
};

export function createPersistLabelPositions({
  getChannelId,
  getIsAuth,
  requestSave,
  confirmedNodeLabelPositionsRef,
  confirmedEdgePositionsRef,
  patchLabelPositionsFn = patchLabelPositionsApi,
}) {
  return async function persistLabelPositions(payload = {}) {
    const channelId = getChannelId();
    if (!channelId || !getIsAuth()) {
      return { ok: false, updated: { nodes: 0, edges: 0 } };
    }

    const nodesInput =
      payload && typeof payload === "object" && payload.nodes && typeof payload.nodes === "object"
        ? payload.nodes
        : {};
    const edgesInput =
      payload && typeof payload === "object" && payload.edges && typeof payload.edges === "object"
        ? payload.edges
        : {};
    const endpointInput =
      payload &&
      typeof payload === "object" &&
      payload.endpointLabelPositions &&
      typeof payload.endpointLabelPositions === "object"
        ? payload.endpointLabelPositions
        : {};

    const nodesPayload = {};
    const edgesPayload = {};
    const endpointPayload = {};

    Object.entries(nodesInput).forEach(([nodeId, data]) => {
      const id = normalizeId(nodeId);
      if (!id) return;
      const entry = {};
      if (Object.prototype.hasOwnProperty.call(data || {}, "labelPosition")) {
        const normalized = normalizePosition(data.labelPosition);
        entry.labelPosition = normalized ?? null;
      }
      if (Object.prototype.hasOwnProperty.call(data || {}, "multicastPosition")) {
        const normalized = normalizePosition(data.multicastPosition);
        entry.multicastPosition = normalized ?? null;
      }
      if (Object.keys(entry).length) {
        nodesPayload[id] = entry;
      }
    });

    Object.entries(edgesInput).forEach(([edgeId, data]) => {
      const id = normalizeId(edgeId);
      if (!id) return;
      const entry = {};
      if (Object.prototype.hasOwnProperty.call(data || {}, "labelPosition")) {
        const normalized = normalizePosition(data.labelPosition);
        entry.labelPosition = normalized ?? null;
      }
      if (Object.prototype.hasOwnProperty.call(data || {}, "multicastPosition")) {
        const normalized = normalizePosition(data.multicastPosition);
        entry.multicastPosition = normalized ?? null;
      }
      if (Object.keys(entry).length) {
        edgesPayload[id] = entry;
      }
    });

    Object.entries(endpointInput).forEach(([edgeId, data]) => {
      const id = normalizeId(edgeId);
      if (!id) return;
      if (!data || typeof data !== "object") return;
      const entry = {};
      ["source", "target"].forEach((endpoint) => {
        if (Object.prototype.hasOwnProperty.call(data, endpoint)) {
          const normalized = normalizePosition(data[endpoint]);
          entry[endpoint] = normalized ?? null;
        }
      });
      if (Object.keys(entry).length) {
        endpointPayload[id] = entry;
      }
    });

    if (
      !Object.keys(nodesPayload).length &&
      !Object.keys(edgesPayload).length &&
      !Object.keys(endpointPayload).length
    ) {
      return { ok: false, updated: { nodes: 0, edges: 0 } };
    }

    const body = {};
    if (Object.keys(nodesPayload).length || Object.keys(edgesPayload).length) {
      body.labelPositions = {};
      if (Object.keys(nodesPayload).length) {
        body.labelPositions.nodes = nodesPayload;
      }
      if (Object.keys(edgesPayload).length) {
        body.labelPositions.edges = edgesPayload;
      }
    }
    if (Object.keys(endpointPayload).length) {
      body.endpointLabelPositions = endpointPayload;
    }

    try {
      const result = await patchLabelPositionsFn(channelId, body, {
        origin: "ChannelDiagram",
      });

      const nodeStore = confirmedNodeLabelPositionsRef.current;
      Object.entries(nodesPayload).forEach(([nodeId, entry]) => {
        const existing = nodeStore.get(nodeId) || {
          labelPosition: null,
          multicastPosition: null,
        };
        const nextEntry = { ...existing };
        if (Object.prototype.hasOwnProperty.call(entry, "labelPosition")) {
          const value = entry.labelPosition;
          nextEntry.labelPosition = value ? { ...value } : null;
        }
        if (Object.prototype.hasOwnProperty.call(entry, "multicastPosition")) {
          const value = entry.multicastPosition;
          nextEntry.multicastPosition = value ? { ...value } : null;
        }
        nodeStore.set(nodeId, nextEntry);
      });

      const edgeStore = confirmedEdgePositionsRef.current;
      Object.entries(edgesPayload).forEach(([edgeId, entry]) => {
        const existing = edgeStore.get(edgeId) || {
          labelPosition: null,
          endpointLabelPositions: {},
          multicastPosition: null,
        };
        const nextEntry = {
          labelPosition: existing.labelPosition,
          endpointLabelPositions: {
            ...(existing.endpointLabelPositions || {}),
          },
          multicastPosition: existing.multicastPosition,
        };
        if (Object.prototype.hasOwnProperty.call(entry, "labelPosition")) {
          const value = entry.labelPosition;
          nextEntry.labelPosition = value ? { ...value } : null;
        }
        if (Object.prototype.hasOwnProperty.call(entry, "multicastPosition")) {
          const value = entry.multicastPosition;
          nextEntry.multicastPosition = value ? { ...value } : null;
        }
        edgeStore.set(edgeId, nextEntry);
      });

      Object.entries(endpointPayload).forEach(([edgeId, entry]) => {
        const existing = edgeStore.get(edgeId) || {
          labelPosition: null,
          endpointLabelPositions: {},
          multicastPosition: null,
        };
        const nextEntry = {
          labelPosition: existing.labelPosition,
          endpointLabelPositions: {
            ...(existing.endpointLabelPositions || {}),
          },
          multicastPosition: existing.multicastPosition,
        };
        ["source", "target"].forEach((endpoint) => {
          if (Object.prototype.hasOwnProperty.call(entry, endpoint)) {
            const value = entry[endpoint];
            if (value) {
              nextEntry.endpointLabelPositions[endpoint] = { ...value };
            } else {
              delete nextEntry.endpointLabelPositions[endpoint];
            }
          }
        });
        edgeStore.set(edgeId, nextEntry);
      });

      requestSave?.();
      return result;
    } catch (error) {
      console.error("patchLabelPositions error", error);
      throw error;
    }
  };
}

export default createPersistLabelPositions;
