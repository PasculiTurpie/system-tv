import { createRouterEdges, getEdgeStyle } from "../flowRules";

const createHandles = (handles) => handles;

const baseNode = (id, type, x, y, label, extra = {}) => ({
  id,
  type,
  position: { x, y },
  data: {
    label,
    handles: createHandles(extra.handles || {}),
    ...(extra.data || {}),
  },
  handles: createHandles(extra.handles || {}),
});

const createSatelite = () =>
  baseNode(
    "sat-1",
    "satelite",
    -320,
    -120,
    "Satélite GEO",
    {
      handles: {
        source: { right: ["out-right"] },
        target: {},
      },
    }
  );

const createIrd = () =>
  baseNode(
    "ird-1",
    "ird",
    320,
    -120,
    "IRD Principal",
    {
      handles: {
        source: {},
        target: { left: ["in-left"] },
      },
    }
  );

const createSwitch = () =>
  baseNode(
    "switch-1",
    "switch",
    0,
    220,
    "Switch Core",
    {
      handles: {
        source: { top: ["src-top"], bottom: ["src-bottom"] },
        target: { top: ["tgt-top"], bottom: ["tgt-bottom"] },
      },
    }
  );

const createDefaultNode = (id, x, y, label) =>
  baseNode(
    id,
    "default",
    x,
    y,
    label,
    {
      handles: {
        source: { top: ["top-source"] },
        target: { top: ["top-target"] },
      },
    }
  );

const createRouter = () =>
  baseNode(
    "router-1",
    "router",
    0,
    0,
    "Router Core",
    {
      data: {
        description: "Router central con reglas automáticas",
      },
      handles: {
        source: {
          right: ["out-right-1", "out-right-2"],
          bottom: ["out-bottom-1", "out-bottom-2", "out-bottom-3"],
        },
        target: {
          left: ["in-left-1", "in-left-2"],
          bottom: ["in-bottom-1", "in-bottom-2", "in-bottom-3"],
        },
      },
    }
  );

const sateliteNode = createSatelite();
const irdNode = createIrd();
const routerNode = createRouter();
const switchNode = createSwitch();

const neighborNodes = [
  createDefaultNode("uplink-hub", -240, 200, "Uplink Hub"),
  createDefaultNode("encoder-a", -120, 360, "Encoder A"),
  createDefaultNode("monitoring", 120, 360, "Monitoring"),
  createDefaultNode("qa-lab", 240, 200, "QA Lab"),
  switchNode,
];

const nodes = [routerNode, sateliteNode, irdNode, ...neighborNodes];

const satToIrdStyle = getEdgeStyle("ida");

const satToIrdEdge = {
  id: "edge-sat-to-ird",
  source: sateliteNode.id,
  target: irdNode.id,
  type: "smoothstep",
  sourceHandle: "out-right",
  targetHandle: "in-left",
  animated: satToIrdStyle.animated,
  style: satToIrdStyle.style,
  markerStart: satToIrdStyle.markerStart,
  markerEnd: satToIrdStyle.markerEnd,
  data: {
    direction: "ida",
    label: "Portadora",
  },
};

const routerEdges = createRouterEdges(routerNode, neighborNodes);

const flowRulesDiagram = {
  _id: "flow-rules-sample",
  signal: {
    _id: "flow-rules-sample-signal",
    nameChannel: "Demo Flow Rules",
    tipoTecnologia: "IP Broadcast",
  },
  metadata: {
    title: "Demo de reglas de flujo",
    aliases: ["flow-rules", "demo-flow", "flow-rules-sample"],
    description:
      "Topología de ejemplo que aplica reglas de satélite → IRD, router y nodos por defecto.",
  },
  nodes,
  edges: [satToIrdEdge, ...routerEdges],
};

export default flowRulesDiagram;
