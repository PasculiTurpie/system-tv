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

const sanitizePosition = (position) => {
  if (!position || typeof position !== "object") return null;
  const { x, y } = position;
  const parsedX = Number(x);
  const parsedY = Number(y);
  if (!Number.isFinite(parsedX) || !Number.isFinite(parsedY)) return null;
  return { x: parsedX, y: parsedY };
};

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
  if (available.length === 0) {
    return {
      ok: false,
      error: `Handle ${normalized} no está definido en el nodo ${node?.id || ""}`,
      code: "handle_missing",
    };
  }
  const found = available.find((h) => h.id === normalized);
  if (!found) {
    return {
      ok: false,
      error: `Handle ${normalized} no existe en el nodo ${node?.id || ""}`,
      code: "handle_invalid",
    };
  }
  if (expectedType && found.type !== expectedType) {
    return {
      ok: false,
      error: `Handle ${normalized} en nodo ${node?.id || ""} es tipo ${found.type} y se esperaba ${expectedType}`,
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

    const node = (channel.nodes || []).find((n) => n?.id === nodeId);
    if (!node) {
      await session.abortTransaction();
      session.endSession();
      return { ok: false, status: 404, message: "Nodo no encontrado" };
    }

    const before = { position: { x: node.position?.x ?? 0, y: node.position?.y ?? 0 } };

    await Channel.updateOne(
      { _id: channelId, "nodes.id": nodeId },
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
      entityId: nodeId,
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
      node: { id: nodeId, position: sanitizedPosition },
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
  if (!edgeId) {
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

    const edge = (channel.edges || []).find((e) => e?.id === edgeId);
    if (!edge) {
      await session.abortTransaction();
      session.endSession();
      return { ok: false, status: 404, message: "Edge no encontrado" };
    }

    const nodes = new Map((channel.nodes || []).map((n) => [n.id, n]));
    const before = {
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle || null,
      targetHandle: edge.targetHandle || null,
    };

    const next = { ...before };

    if (patch.source !== undefined) {
      const newSource = String(patch.source ?? "").trim();
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
      const newTarget = String(patch.target ?? "").trim();
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

    const sourceNode = nodes.get(next.source);
    const targetNode = nodes.get(next.target);

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
      { _id: channelId, "edges.id": edgeId },
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
      entityId: edgeId,
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
        id: edgeId,
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
  if (!edgeId) {
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

    const edge = (channel.edges || []).find((e) => e?.id === edgeId);
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
      { _id: channelId, "edges.id": edgeId },
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
      entityId: edgeId,
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
      edge: { id: edgeId, data: after },
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
