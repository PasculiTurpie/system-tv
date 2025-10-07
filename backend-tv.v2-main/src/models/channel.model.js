// server/models/channel.model.js
const mongoose = require("mongoose");

const NodeDataSchema = new mongoose.Schema(
  {
    label: { type: String, required: true },
    image: String,
    labelPosition: {
      x: { type: Number },
      y: { type: Number },
    },
  },
  { _id: false, strict: false, minimize: false }
);

const NodeSchema = new mongoose.Schema({
  id: { type: String, required: true },
  type: { type: String, default: "image" },
  equipo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Equipo",
    required: true,
  },
  position: {
    x: { type: Number, required: true },
    y: { type: Number, required: true },
  },
  data: { type: NodeDataSchema, required: true },
});

const EdgeSchema = new mongoose.Schema({
  id: { type: String, required: true },
  source: { type: String, required: true },
  target: { type: String, required: true },
  type: { type: String, default: "smoothstep" },
  animated: { type: Boolean, default: true },
  style: {
    stroke: { type: String, default: "red" },
  },
  sourceHandle: String,
  targetHandle: String,
  label: String,
  labelPosition: {
    x: { type: Number },
    y: { type: Number },
  },

  // 👇 necesario para guardar multicast y otros campos del front
  data: { type: mongoose.Schema.Types.Mixed, default: {} },
});

const ChannelSchema = new mongoose.Schema(
  {
    signal: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Signal",
      required: true,
    },
    nodes: [NodeSchema],
    edges: [EdgeSchema],
  },
  { timestamps: true, versionKey: false }
);

// Validación: edges deben referenciar nodes existentes
ChannelSchema.pre("validate", function (next) {
  const nodeIds = this.nodes.map((node) => node.id);
  for (const edge of this.edges) {
    if (!nodeIds.includes(edge.source)) {
      return next(
        new Error(`Edge source "${edge.source}" does not exist in nodes`)
      );
    }
    if (!nodeIds.includes(edge.target)) {
      return next(
        new Error(`Edge target "${edge.target}" does not exist in nodes`)
      );
    }
  }
  next();
});

const Channel = mongoose.model("Channel", ChannelSchema);
module.exports = Channel;
