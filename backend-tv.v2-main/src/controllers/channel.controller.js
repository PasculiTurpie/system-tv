const Channel = require("../models/channel.model");
const {
  normalizeChannel,
  normalizeChannels,
  normalizeNode,
  normalizeEdge,
} = require("../services/channelNormalizer");

const MAX_LABEL_LENGTH = 200;

const clampLabel = (value) => {
  if (value === undefined || value === null) return "";
  const str = String(value);
  return str.length > MAX_LABEL_LENGTH ? str.slice(0, MAX_LABEL_LENGTH) : str;
};

const sanitizePosition = (point) => {
  if (!point || typeof point !== "object") return null;
  const x = Number(point.x);
  const y = Number(point.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  const clamp = (val) => {
    const bounded = Math.max(-1_000_000, Math.min(1_000_000, val));
    return Number.isFinite(bounded) ? bounded : 0;
  };
  return { x: clamp(x), y: clamp(y) };
};

const sanitizeEndpointLabels = (payload = {}) => {
  const result = {};
  if (Object.prototype.hasOwnProperty.call(payload, "source")) {
    const value = payload.source;
    if (value === null) {
      result.source = null;
    } else if (value !== undefined) {
      const sanitized = clampLabel(value).trim();
      result.source = sanitized || null;
    }
  }
  if (Object.prototype.hasOwnProperty.call(payload, "target")) {
    const value = payload.target;
    if (value === null) {
      result.target = null;
    } else if (value !== undefined) {
      const sanitized = clampLabel(value).trim();
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

const buildChannelFilter = (query = {}) => {
  const filter = {};
  const signal = query.signal || query.signalId;
  if (signal) {
    filter.signal = String(signal).trim();
  }
  return filter;
};

// Crear canal
module.exports.createChannel = async (req, res) => {
  try {
    const channel = new Channel(req.body);
    const saved = await channel.save();
    const payload = normalizeChannel(
      saved.toObject({ getters: true, virtuals: true })
    );
    res.status(201).json(payload);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Obtener todos los canales
module.exports.getChannel =  async (req, res) => {
  try {
    const filter = buildChannelFilter(req.query);
    const channels = await Channel.find(filter)
      .populate({
        path: "signal",
        populate: [{ path: "contact" }],
      })
      .populate({
        path: "nodes.equipo",
        populate: [
          { path: "tipoNombre", select: "tipoNombre" },
          { path: "irdRef" }, // si quieres limitar campos, agrega .select
          {
            path: "satelliteRef",
            populate: [{ path: "satelliteType", select: "typePolarization" }],
          },
        ],
      })
      .populate({
        path: "nodes",
        populate: [{ path: "equipo" }],
      })
      .sort({ updatedAt: -1, _id: 1 })
      .lean({ getters: true, virtuals: true });
    res.json(normalizeChannels(channels));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

exports.updateChannel = async (req, res) => {
  try {
    const { id } = req.params;
    const { signal, nodes, edges } = req.body;

    const updated = await Channel.findByIdAndUpdate(
      id,
      { signal, nodes, edges },
      { new: true, runValidators: true }
    ).lean({ getters: true, virtuals: true });

    if (!updated) {
      return res.status(404).json({ error: "Channel no encontrado" });
    }

    res.json(normalizeChannel(updated));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// controllers/channel.controller.js
module.exports.getChannelId = async (req, res) => {
  try {
    const channel = await Channel.findById(req.params.id)
      // Signal + contactos
      .populate({
        path: "signal",
        populate: [{ path: "contact" }],
      })
      // Equipo dentro de cada nodo + sus refs
      // Nota: si nodes es un array embebido con campo 'equipo' (ObjectId),
      // usa el path con punto.
      .populate({
        path: "nodes.equipo",
        populate: [
          { path: "tipoNombre", select: "tipoNombre" },
          { path: "irdRef" }, // si quieres limitar campos, agrega .select
          {
            path: "satelliteRef",
            populate: [{ path: "satelliteType", select: "typePolarization" }],
          },
        ],
      })
      .lean({ getters: true, virtuals: true })
      .exec();

    if (!channel) {
      return res.status(404).json({ error: "Channel not found" });
    }

    res.json(normalizeChannel(channel));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};




/* +++++++++++++++++++++++++++++++ */

// Obtener canal por ID

// Actualizar canal


// Eliminar canal
module.exports.deleteChannel = async (req, res) => {
  const { id } = req.params;
  try {
    const deletedChannel = await Channel.findByIdAndDelete(id);
    if (!deletedChannel) {
      return res.status(404).json({ message: "Canal no encontrado para eliminar" });
    }
    res.status(200).json({ message: "Canal eliminado correctamente" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al eliminar el canal", error: error.message });
  }
};

/* UPDATE CHANNEL */

exports.updateChannelFlow = async (req, res) => {
  try {
    const { nodes, edges } = req.body;
    const updatedChannel = await Channel.findByIdAndUpdate(
      req.params.id,
      { nodes, edges },
      { new: true, runValidators: true }
    )
      .lean({ getters: true, virtuals: true })
      .exec();

    if (!updatedChannel) {
      return res.status(404).json({ error: "Channel no encontrado" });
    }

    res.json(normalizeChannel(updatedChannel));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.patchNode = async (req, res) => {
  const { id, nodeId } = req.params;
  const { label, labelPosition, position } = req.body || {};

  const setUpdate = {};
  const unsetUpdate = {};

  if (label !== undefined) {
    const sanitizedLabel = clampLabel(label);
    setUpdate["nodes.$.data.label"] = sanitizedLabel;
    setUpdate["nodes.$.label"] = sanitizedLabel;
  }

  if (labelPosition !== undefined) {
    if (labelPosition === null) {
      unsetUpdate["nodes.$.data.labelPosition"] = "";
    } else {
      const sanitizedPosition = sanitizePosition(labelPosition);
      if (sanitizedPosition) {
        setUpdate["nodes.$.data.labelPosition"] = sanitizedPosition;
      } else {
        unsetUpdate["nodes.$.data.labelPosition"] = "";
      }
    }
  }

  if (position !== undefined) {
    const sanitizedPosition = sanitizePosition(position);
    if (!sanitizedPosition) {
      return res.status(400).json({ error: "Posición de nodo inválida" });
    }
    setUpdate["nodes.$.position.x"] = sanitizedPosition.x;
    setUpdate["nodes.$.position.y"] = sanitizedPosition.y;
  }

  const update = {};
  if (Object.keys(setUpdate).length > 0) update.$set = setUpdate;
  if (Object.keys(unsetUpdate).length > 0) update.$unset = unsetUpdate;

  if (!update.$set && !update.$unset) {
    return res.status(400).json({ error: "No hay cambios para aplicar" });
  }

  try {
    const updated = await Channel.findOneAndUpdate(
      { _id: id, "nodes.id": nodeId },
      update,
      {
        new: true,
        select: { "nodes.$": 1, _id: 1 },
        runValidators: true,
      }
    )
      .lean({ getters: true, virtuals: true })
      .exec();

    if (!updated || !Array.isArray(updated.nodes) || updated.nodes.length === 0) {
      return res.status(404).json({ error: "Nodo no encontrado" });
    }

    return res.json({ node: normalizeNode(updated.nodes[0]) });
  } catch (error) {
    console.error("patchNode error", error);
    return res.status(500).json({ error: error.message });
  }
};

exports.patchEdge = async (req, res) => {
  const { id, edgeId } = req.params;
  const { label, labelPosition, endpointLabels, endpointLabelPositions } = req.body || {};

  const setUpdate = {};
  const unsetUpdate = {};

  if (label !== undefined) {
    const sanitizedLabel = clampLabel(label);
    setUpdate["edges.$.label"] = sanitizedLabel;
    setUpdate["edges.$.data.label"] = sanitizedLabel;
  }

  if (labelPosition !== undefined) {
    if (labelPosition === null) {
      unsetUpdate["edges.$.labelPosition"] = "";
      unsetUpdate["edges.$.data.labelPosition"] = "";
    } else {
      const sanitizedPosition = sanitizePosition(labelPosition);
      if (sanitizedPosition) {
        setUpdate["edges.$.labelPosition"] = sanitizedPosition;
        setUpdate["edges.$.data.labelPosition"] = sanitizedPosition;
      } else {
        unsetUpdate["edges.$.labelPosition"] = "";
        unsetUpdate["edges.$.data.labelPosition"] = "";
      }
    }
  }

  if (endpointLabels !== undefined) {
    const sanitized = sanitizeEndpointLabels(endpointLabels);
    if (Object.prototype.hasOwnProperty.call(sanitized, "source")) {
      if (sanitized.source === null) {
        unsetUpdate["edges.$.data.endpointLabels.source"] = "";
      } else {
        setUpdate["edges.$.data.endpointLabels.source"] = sanitized.source;
      }
    }
    if (Object.prototype.hasOwnProperty.call(sanitized, "target")) {
      if (sanitized.target === null) {
        unsetUpdate["edges.$.data.endpointLabels.target"] = "";
      } else {
        setUpdate["edges.$.data.endpointLabels.target"] = sanitized.target;
      }
    }
  }

  if (endpointLabelPositions !== undefined) {
    const sanitized = sanitizeEndpointPositions(endpointLabelPositions);
    if (Object.prototype.hasOwnProperty.call(sanitized, "source")) {
      if (!sanitized.source) {
        unsetUpdate["edges.$.data.endpointLabelPositions.source"] = "";
      } else {
        setUpdate["edges.$.data.endpointLabelPositions.source"] = sanitized.source;
      }
    }
    if (Object.prototype.hasOwnProperty.call(sanitized, "target")) {
      if (!sanitized.target) {
        unsetUpdate["edges.$.data.endpointLabelPositions.target"] = "";
      } else {
        setUpdate["edges.$.data.endpointLabelPositions.target"] = sanitized.target;
      }
    }
  }

  const update = {};
  if (Object.keys(setUpdate).length > 0) update.$set = setUpdate;
  if (Object.keys(unsetUpdate).length > 0) update.$unset = unsetUpdate;

  if (!update.$set && !update.$unset) {
    return res.status(400).json({ error: "No hay cambios para aplicar" });
  }

  try {
    const updated = await Channel.findOneAndUpdate(
      { _id: id, "edges.id": edgeId },
      update,
      {
        new: true,
        select: { "edges.$": 1, _id: 1 },
        runValidators: true,
      }
    )
      .lean({ getters: true, virtuals: true })
      .exec();

    if (!updated || !Array.isArray(updated.edges) || updated.edges.length === 0) {
      return res.status(404).json({ error: "Enlace no encontrado" });
    }

    return res.json({ edge: normalizeEdge(updated.edges[0]) });
  } catch (error) {
    console.error("patchEdge error", error);
    return res.status(500).json({ error: error.message });
  }
};