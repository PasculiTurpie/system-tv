const mongoose = require("mongoose");
const Channel = require("../models/channel.model");
const DiagramAudit = require("../models/diagramAudit.model");

const isValidObjectId = (value) => {
  if (!value) return false;
  try {
    return mongoose.Types.ObjectId.isValid(String(value));
  } catch (error) {
    return false;
  }
};

const normalizeId = (value) => {
  if (value === undefined || value === null) return null;
  const str = String(value).trim();
  return str.length ? str : null;
};

const sanitizePosition = (position) => {
  if (!position || typeof position !== "object") return null;
  const { x, y } = position;
  const parsedX = Number(x);
  const parsedY = Number(y);
  if (!Number.isFinite(parsedX) || !Number.isFinite(parsedY)) return null;
  return { x: parsedX, y: parsedY };
};

const HANDLE_ID_REGEX = /^(in|out)-(left|right|top|bottom)-([1-9]\d*)$/;
const HANDLE_KIND_TO_TYPE = { in: "target", out: "source" };
const FALLBACK_MAX_HANDLE_INDEX = 4;

const collectHandles = (node) => {
  if (!node) return [];
  const handles = [];
  if (Array.isArray(node.handles)) handles.push(...node.handles);
  if (Array.isArray(node.data?.handles)) handles.push(...node.data.handles);
  const byId = new Map();
  handles
    .filter((h) => h && typeof h === "object")
    .forEach((handle) => {
      const id = String(handle.id || "").trim();
      if (!id || byId.has(id)) return;
      byId.set(id, {
        id,
        type: String(handle.type || "").trim().toLowerCase(),
        side: handle.side,
      });
    });
  return Array.from(byId.values());
};

const ensureHandle = (node, handleId, expectedType) => {
  if (!handleId) {
    return {
      ok: true,
      handleId: handleId === null ? null : undefined,
    };
  }
  const normalized = String(handleId).trim();
  if (!normalized) {
    return { ok: true, handleId: null };
  }
  const available = collectHandles(node);
  const validateFallback = () => {
    const match = normalized.match(HANDLE_ID_REGEX);
    if (!match) {
      return {
        ok: false,
        error: `Handle ${normalized} no está definido en el nodo ${node?.id || ""}`,
        code: "handle_missing",
      };
    }
    const [, kind, , indexRaw] = match;
    const inferredType = HANDLE_KIND_TO_TYPE[kind] || null;
    const targetType = expectedType ? String(expectedType).trim().toLowerCase() : null;
    if (targetType && inferredType && inferredType !== targetType) {
      return {
        ok: false,
        error: `Handle ${normalized} en nodo ${node?.id || ""} es tipo ${inferredType} y se esperaba ${targetType}`,
        code: "handle_type_mismatch",
      };
    }
    const index = Number(indexRaw);
    if (!Number.isFinite(index) || index < 1 || index > FALLBACK_MAX_HANDLE_INDEX) {
      return {
        ok: false,
        error: `Handle ${normalized} no existe en el nodo ${node?.id || ""}`,
        code: "handle_invalid",
      };
    }
    return { ok: true, handleId: normalized };
  };

  if (available.length === 0) {
    return validateFallback();
  }
  const found = available.find((h) => h.id === normalized);
  if (!found) {
    return validateFallback();
  }
  const foundType = found.type ? String(found.type).trim().toLowerCase() : null;
  const targetType = expectedType ? String(expectedType).trim().toLowerCase() : null;
  if (targetType && foundType && foundType !== targetType) {
    return {
      ok: false,
      error: `Handle ${normalized} en nodo ${node?.id || ""} es tipo ${foundType} y se esperaba ${targetType}`,
      code: "handle_type_mismatch",
    };
  }
  return { ok: true, handleId: normalized };
};

const createAudit = async ({ session, entityType, entityId, channelId, action, before, after, userId }) => {
  const payload = {
    entityType,
    entityId,
    channelId,
    action,
    before: before ? JSON.parse(JSON.stringify(before)) : null,
    after: after ? JSON.parse(JSON.stringify(after)) : null,
    userId: userId && isValidObjectId(userId) ? userId : undefined,
  };
  const audit = await DiagramAudit.create([payload], { session });
  return audit[0];
};

async function updateNodePosition({ channelId, nodeId, position, userId }) {
  if (!isValidObjectId(channelId)) {
    return { ok: false, status: 400, message: "Canal inválido" };
  }
  const normalizedNodeId = normalizeId(nodeId);
  if (!normalizedNodeId) {
    return { ok: false, status: 400, message: "Nodo inválido" };
  }
  const sanitizedPosition = sanitizePosition(position);
  if (!sanitizedPosition) {
    return { ok: false, status: 400, message: "Posición inválida" };
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const channel = await Channel.findById(channelId)
      .session(session)
      .select({ nodes: 1 })
      .lean({ getters: true, virtuals: true });

    if (!channel) {
      await session.abortTransaction();
      session.endSession();
      return { ok: false, status: 404, message: "Channel no encontrado" };
    }

    const node = (channel.nodes || []).find(
      (n) => normalizeId(n?.id) === normalizedNodeId
    );
    if (!node) {
      await session.abortTransaction();
      session.endSession();
      return { ok: false, status: 404, message: "Nodo no encontrado" };
    }

    const before = { position: { x: node.position?.x ?? 0, y: node.position?.y ?? 0 } };

    await Channel.updateOne(
      { _id: channelId, "nodes.id": normalizedNodeId },
      {
        $set: {
          "nodes.$.position.x": sanitizedPosition.x,
          "nodes.$.position.y": sanitizedPosition.y,
        },
      },
      { session, runValidators: true }
    );

    const after = { position: sanitizedPosition };

    const audit = await createAudit({
      session,
      entityType: "node",
      entityId: normalizedNodeId,
      channelId,
      action: "move",
      before,
      after,
      userId,
    });

    await session.commitTransaction();
    session.endSession();

    return {
      ok: true,
      node: { id: normalizedNodeId, position: sanitizedPosition },
      auditId: audit?._id?.toString() || null,
    };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    return { ok: false, status: 500, message: error.message };
  }
}

async function reconnectEdge({ channelId, edgeId, patch = {}, userId }) {
  if (!isValidObjectId(channelId)) {
    return { ok: false, status: 400, message: "Canal inválido" };
  }
  const normalizedEdgeId = normalizeId(edgeId);
  if (!normalizedEdgeId) {
    return { ok: false, status: 400, message: "Edge inválido" };
  }
  const allowedKeys = ["source", "sourceHandle", "target", "targetHandle"];
  const hasAny = allowedKeys.some((key) => patch[key] !== undefined);
  if (!hasAny) {
    return { ok: false, status: 400, message: "Sin cambios para aplicar" };
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const channel = await Channel.findById(channelId)
      .session(session)
      .select({ nodes: 1, edges: 1 })
      .lean({ getters: true, virtuals: true });

    if (!channel) {
      await session.abortTransaction();
      session.endSession();
      return { ok: false, status: 404, message: "Channel no encontrado" };
    }

    const edge = (channel.edges || []).find(
      (e) => normalizeId(e?.id) === normalizedEdgeId
    );
    if (!edge) {
      await session.abortTransaction();
      session.endSession();
      return { ok: false, status: 404, message: "Edge no encontrado" };
    }

    const nodes = new Map(
      (channel.nodes || [])
        .map((n) => [normalizeId(n?.id), n])
        .filter(([key]) => Boolean(key))
    );
    const before = {
      source: normalizeId(edge.source) ?? edge.source,
      target: normalizeId(edge.target) ?? edge.target,
      sourceHandle: edge.sourceHandle || null,
      targetHandle: edge.targetHandle || null,
    };

    const next = {
      ...before,
      source: normalizeId(before.source) ?? before.source,
      target: normalizeId(before.target) ?? before.target,
    };

    if (patch.source !== undefined) {
      const newSource = normalizeId(patch.source);
      if (!newSource) {
        await session.abortTransaction();
        session.endSession();
        return { ok: false, status: 400, message: "Source inválido" };
      }
      if (!nodes.has(newSource)) {
        await session.abortTransaction();
        session.endSession();
        return { ok: false, status: 404, message: `Nodo source ${newSource} inexistente` };
      }
      next.source = newSource;
    }

    if (patch.target !== undefined) {
      const newTarget = normalizeId(patch.target);
      if (!newTarget) {
        await session.abortTransaction();
        session.endSession();
        return { ok: false, status: 400, message: "Target inválido" };
      }
      if (!nodes.has(newTarget)) {
        await session.abortTransaction();
        session.endSession();
        return { ok: false, status: 404, message: `Nodo target ${newTarget} inexistente` };
      }
      next.target = newTarget;
    }

    const sourceNode = nodes.get(normalizeId(next.source));
    const targetNode = nodes.get(normalizeId(next.target));

    if (patch.sourceHandle !== undefined) {
      const check = ensureHandle(sourceNode, patch.sourceHandle, "source");
      if (!check.ok) {
        await session.abortTransaction();
        session.endSession();
        return { ok: false, status: 409, message: check.error };
      }
      next.sourceHandle = check.handleId ?? null;
    } else if (next.source !== before.source) {
      const check = ensureHandle(sourceNode, before.sourceHandle, "source");
      if (!check.ok) {
        await session.abortTransaction();
        session.endSession();
        return { ok: false, status: 409, message: check.error };
      }
      next.sourceHandle = check.handleId ?? null;
    }

    if (patch.targetHandle !== undefined) {
      const check = ensureHandle(targetNode, patch.targetHandle, "target");
      if (!check.ok) {
        await session.abortTransaction();
        session.endSession();
        return { ok: false, status: 409, message: check.error };
      }
      next.targetHandle = check.handleId ?? null;
    } else if (next.target !== before.target) {
      const check = ensureHandle(targetNode, before.targetHandle, "target");
      if (!check.ok) {
        await session.abortTransaction();
        session.endSession();
        return { ok: false, status: 409, message: check.error };
      }
      next.targetHandle = check.handleId ?? null;
    }

    await Channel.updateOne(
      { _id: channelId, "edges.id": normalizedEdgeId },
      {
        $set: {
          "edges.$.source": next.source,
          "edges.$.target": next.target,
          "edges.$.sourceHandle": next.sourceHandle ?? null,
          "edges.$.targetHandle": next.targetHandle ?? null,
        },
      },
      { session, runValidators: true }
    );

    const audit = await createAudit({
      session,
      entityType: "edge",
      entityId: normalizedEdgeId,
      channelId,
      action: "reconnect",
      before,
      after: next,
      userId,
    });

    await session.commitTransaction();
    session.endSession();

    return {
      ok: true,
      edge: {
        id: normalizedEdgeId,
        source: next.source,
        target: next.target,
        sourceHandle: next.sourceHandle ?? null,
        targetHandle: next.targetHandle ?? null,
      },
      auditId: audit?._id?.toString() || null,
    };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    return { ok: false, status: 500, message: error.message };
  }
}

async function updateEdgeTooltip({ channelId, edgeId, tooltipTitle, tooltip, userId }) {
  if (!isValidObjectId(channelId)) {
    return { ok: false, status: 400, message: "Canal inválido" };
  }
  const normalizedEdgeId = normalizeId(edgeId);
  if (!normalizedEdgeId) {
    return { ok: false, status: 400, message: "Edge inválido" };
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const channel = await Channel.findById(channelId)
      .session(session)
      .select({ edges: 1 })
      .lean({ getters: true, virtuals: true });

    if (!channel) {
      await session.abortTransaction();
      session.endSession();
      return { ok: false, status: 404, message: "Channel no encontrado" };
    }

    const edge = (channel.edges || []).find(
      (e) => normalizeId(e?.id) === normalizedEdgeId
    );
    if (!edge) {
      await session.abortTransaction();
      session.endSession();
      return { ok: false, status: 404, message: "Edge no encontrado" };
    }

    const before = {
      tooltipTitle: edge?.data?.tooltipTitle || null,
      tooltip: edge?.data?.tooltip || null,
    };

    const sanitized = {};
    if (tooltipTitle !== undefined) {
      const title = String(tooltipTitle ?? "").trim();
      sanitized.tooltipTitle = title || null;
    }
    if (tooltip !== undefined) {
      const body = String(tooltip ?? "").trim();
      sanitized.tooltip = body || null;
    }

    await Channel.updateOne(
      { _id: channelId, "edges.id": normalizedEdgeId },
      {
        $set: {
          ...(tooltipTitle !== undefined
            ? { "edges.$.data.tooltipTitle": sanitized.tooltipTitle }
            : {}),
          ...(tooltip !== undefined
            ? { "edges.$.data.tooltip": sanitized.tooltip }
            : {}),
        },
      },
      { session, runValidators: true }
    );

    const after = {
      tooltipTitle:
        tooltipTitle !== undefined ? sanitized.tooltipTitle : before.tooltipTitle,
      tooltip: tooltip !== undefined ? sanitized.tooltip : before.tooltip,
    };

    const audit = await createAudit({
      session,
      entityType: "edge",
      entityId: normalizedEdgeId,
      channelId,
      action: "edit",
      before,
      after,
      userId,
    });

    await session.commitTransaction();
    session.endSession();

    return {
      ok: true,
      edge: { id: normalizedEdgeId, data: after },
      auditId: audit?._id?.toString() || null,
    };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    return { ok: false, status: 500, message: error.message };
  }
}

module.exports = {
  updateNodePosition,
  reconnectEdge,
  updateEdgeTooltip,
};
