// server/models/channel.model.js
const mongoose = require("mongoose");

const positionDefinition = {
  x: { type: Number },
  y: { type: Number },
};

const NodeDataSchema = new mongoose.Schema(
  {
    label: { type: String, required: true },
    image: String,
    labelPosition: { ...positionDefinition },
    multicast: { type: String },
    multicastPosition: { ...positionDefinition },
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

const EdgeDataSchema = new mongoose.Schema(
  {
    label: { type: String },
    labelPosition: { ...positionDefinition },
    endpointLabels: { type: mongoose.Schema.Types.Mixed, default: {} },
    endpointLabelPositions: { type: mongoose.Schema.Types.Mixed, default: {} },
    multicast: { type: String },
    multicastPosition: { ...positionDefinition },
  },
  { _id: false, strict: false, minimize: false }
);

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
  data: { type: EdgeDataSchema, default: {} },
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

ChannelSchema.index({ "nodes.id": 1 }, { background: true });
ChannelSchema.index({ "edges.id": 1 }, { background: true });
ChannelSchema.index(
  { "nodes.data.label": 1 },
  { background: true, sparse: true }
);

// Validación: edges deben referenciar nodes existentes
ChannelSchema.pre("validate", function (next) {
  const nodesList = Array.isArray(this.nodes) ? this.nodes : [];
  const edgesList = Array.isArray(this.edges) ? this.edges : [];

  const nodeIds = nodesList.map((node) => node.id);
  const uniqueNodeIds = new Set(nodeIds);
  if (uniqueNodeIds.size !== nodeIds.length) {
    return next(new Error("Duplicate node ids are not allowed within a channel"));
  }

  const edgeIds = edgesList.map((edge) => edge.id);
  const uniqueEdgeIds = new Set(edgeIds);
  if (uniqueEdgeIds.size !== edgeIds.length) {
    return next(new Error("Duplicate edge ids are not allowed within a channel"));
  }

  for (const edge of edgesList) {
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
