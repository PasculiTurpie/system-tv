// server/models/channel.model.js
const mongoose = require("mongoose");

const positionDefinition = {
  x: { type: Number },
  y: { type: Number },
};

const HANDLE_SIDES = ["top", "right", "bottom", "left"];
const HANDLE_TYPES = ["source", "target"];

const HandleSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, trim: true },
    type: { type: String, enum: HANDLE_TYPES, required: true },
    side: { type: String, enum: HANDLE_SIDES, required: true },
    topPct: { type: Number, min: 0, max: 100, default: 50 },
    leftPct: { type: Number, min: 0, max: 100, default: 50 },
  },
  { _id: false }
);

const HANDLE_ID_REGEX = /^(in|out)-(left|right|top|bottom)-([1-9][0-9]*)$/;

const NodeDataSchema = new mongoose.Schema(
  {
    label: { type: String, required: true },
    image: String,
    labelPosition: { ...positionDefinition },
    multicast: { type: String },
    multicastPosition: { ...positionDefinition },
    handles: { type: [HandleSchema], default: undefined },
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
  handles: { type: [HandleSchema], default: [] },
});

const EdgeDataSchema = new mongoose.Schema(
  {
    label: { type: String },
    labelStart: { type: String },
    labelEnd: { type: String },
    direction: {
      type: String,
      enum: ["ida", "vuelta"],
      default: "ida",
    },
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
  style: { type: mongoose.Schema.Types.Mixed, default: {} },
  sourceHandle: String,
  targetHandle: String,
  label: String,
  labelPosition: {
    x: { type: Number },
    y: { type: Number },
  },
  markerStart: { type: mongoose.Schema.Types.Mixed, default: undefined },
  markerEnd: { type: mongoose.Schema.Types.Mixed, default: undefined },

  // 👇 necesario para guardar multicast y otros campos del front
  data: { type: EdgeDataSchema, default: {} },
});

const DiagramNodeSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, trim: true },
    type: { type: String, default: "default" },
    position: {
      x: { type: Number, default: 0 },
      y: { type: Number, default: 0 },
    },
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { _id: false, minimize: false }
);

const DiagramEdgeSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, trim: true },
    source: { type: String, required: true, trim: true },
    target: { type: String, required: true, trim: true },
    sourceHandle: {
      type: String,
      required: true,
      trim: true,
      validate: {
        validator: (value) => HANDLE_ID_REGEX.test(value),
        message: "sourceHandle must match the handle format",
      },
    },
    targetHandle: {
      type: String,
      required: true,
      trim: true,
      validate: {
        validator: (value) => HANDLE_ID_REGEX.test(value),
        message: "targetHandle must match the handle format",
      },
    },
    type: { type: String, default: "customDirectional" },
    label: { type: String, default: "" },
    data: {
      labelStart: { type: String, default: "" },
      labelEnd: { type: String, default: "" },
      direction: {
        type: String,
        enum: ["ida", "vuelta", "bi"],
        default: "ida",
      },
    },
    style: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { _id: false, minimize: false }
);

const DiagramSchema = new mongoose.Schema(
  {
    nodes: { type: [DiagramNodeSchema], default: [] },
    edges: { type: [DiagramEdgeSchema], default: [] },
    viewport: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { _id: false, minimize: false }
);

const ChannelSchema = new mongoose.Schema(
  {
    signal: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Signal",
      required: true,
    },
    nodes: [NodeSchema],
    edges: [EdgeSchema],
    diagram: { type: DiagramSchema, default: undefined },
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
