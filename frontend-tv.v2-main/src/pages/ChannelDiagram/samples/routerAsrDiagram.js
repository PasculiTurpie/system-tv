const OFFSET_Y_TOP = 180;
const OFFSET_Y_BOTTOM = 380;
const OFFSET_X_STEP = 180;

const createNode = (id, label, columnIndex, rowOffset = OFFSET_Y_TOP, extra = {}) => ({
  id,
  type: extra.type || "custom",
  position: {
    x: columnIndex * OFFSET_X_STEP,
    y: rowOffset,
  },
  data: {
    label,
    ...(extra.data || {}),
  },
});

const createRouterNode = () => ({
  id: "router-asr",
  type: "router",
  position: { x: 0, y: 0 },
  data: {
    label: "Router ASR",
    description: "Router principal de contribución",
    tooltip: "Nodo principal para enlaces ida/retorno",
  },
});

const EDGE_BASE_STYLE = {
  strokeWidth: 2,
  strokeDasharray: "8 4",
};

const createDirectionalEdge = ({
  id,
  source,
  target,
  label,
  multicast,
  direction = "ida",
  marker = { type: "arrowclosed" },
  sourceHandle,
  targetHandle,
}) => {
  const color = direction === "vuelta" ? "#16a34a" : "#dc2626";
  return {
    id,
    source,
    target,
    type: "directional",
    ...(sourceHandle ? { sourceHandle } : {}),
    ...(targetHandle ? { targetHandle } : {}),
    data: {
      label,
      multicast,
      direction,
    },
    markerEnd: marker,
    animated: false,
    style: {
      ...EDGE_BASE_STYLE,
      stroke: color,
    },
  };
};

const routerAsrDiagram = {
  _id: "router-asr-demo",
  signal: {
    _id: "router-asr-demo-signal",
    nameChannel: "Demo Router ASR",
    tipoTecnologia: "IP Broadcast",
  },
  metadata: {
    title: "Diagrama demo Router ASR",
    aliases: ["router-asr", "demo-router-asr", "router-asr-demo"],
    description:
      "Ejemplo de topología MERN + React Flow replicando el flujo Router ASR del anexo.",
  },
};

const topNodes = [
  createNode("subida", "Subida", -2),
  createNode("suite-9", "Suite 9", -1),
  createNode("suite-8", "Suite 8", 1),
  createNode("suite-7", "Suite 7", 2),
];

const bottomNodes = [
  createNode("ipd", "IPD", -3.5, OFFSET_Y_BOTTOM),
  createNode("jrd", "JRD", -2.5, OFFSET_Y_BOTTOM),
  createNode("suite-tv1", "Suite TV1", -1.5, OFFSET_Y_BOTTOM),
  createNode("suite-tv2", "Suite TV2", -0.5, OFFSET_Y_BOTTOM),
  createNode("suite-tv3", "Suite TV3", 0.5, OFFSET_Y_BOTTOM),
  createNode("suite-tv4", "Suite TV4", 1.5, OFFSET_Y_BOTTOM),
  createNode("dom2-lans", "DOM2_LANS", 2.5, OFFSET_Y_BOTTOM),
  createNode("tv-host-st", "TV-HOST_ST", 3.5, OFFSET_Y_BOTTOM),
  createNode("rts66", "RTS66", 4.5, OFFSET_Y_BOTTOM),
];

const nodes = [createRouterNode(), ...topNodes, ...bottomNodes];

const routerConnections = [
  {
    nodeId: "subida",
    idaLabel: "Gi0/0/3",
    idaMulticast: "29.243.2.222",
    vueltaLabel: "Gi0/0/3",
    vueltaMulticast: "29.243.2.222",
  },
  {
    nodeId: "suite-9",
    idaLabel: "Gi0/0/11",
    idaMulticast: "29.243.53.33",
    vueltaLabel: "Gi0/0/11",
    vueltaMulticast: "29.243.53.33",
  },
  {
    nodeId: "suite-8",
    idaLabel: "Gi0/0/12",
    idaMulticast: "29.243.53.32",
    vueltaLabel: "Gi0/0/12",
    vueltaMulticast: "29.243.53.32",
  },
  {
    nodeId: "suite-7",
    idaLabel: "Gi0/0/13",
    idaMulticast: "29.243.53.31",
    vueltaLabel: "Gi0/0/13",
    vueltaMulticast: "29.243.53.31",
  },
  {
    nodeId: "ipd",
    idaLabel: "Gi0/1/1",
    idaMulticast: "29.243.53.11",
    vueltaLabel: "Gi0/1/1",
    vueltaMulticast: "29.243.53.11",
  },
  {
    nodeId: "jrd",
    idaLabel: "Gi0/1/2",
    idaMulticast: "29.243.53.12",
    vueltaLabel: "Gi0/1/2",
    vueltaMulticast: "29.243.53.12",
  },
  {
    nodeId: "suite-tv1",
    idaLabel: "Gi0/1/3",
    idaMulticast: "29.243.53.21",
    vueltaLabel: "Gi0/1/3",
    vueltaMulticast: "29.243.53.21",
  },
  {
    nodeId: "suite-tv2",
    idaLabel: "Gi0/1/4",
    idaMulticast: "29.243.53.22",
    vueltaLabel: "Gi0/1/4",
    vueltaMulticast: "29.243.53.22",
  },
  {
    nodeId: "suite-tv3",
    idaLabel: "Gi0/1/5",
    idaMulticast: "29.243.53.23",
    vueltaLabel: "Gi0/1/5",
    vueltaMulticast: "29.243.53.23",
  },
  {
    nodeId: "suite-tv4",
    idaLabel: "Gi0/1/6",
    idaMulticast: "29.243.53.24",
    vueltaLabel: "Gi0/1/6",
    vueltaMulticast: "29.243.53.24",
  },
  {
    nodeId: "dom2-lans",
    idaLabel: "Gi0/1/7",
    idaMulticast: "29.243.53.25",
    vueltaLabel: "Gi0/1/7",
    vueltaMulticast: "29.243.53.25",
  },
  {
    nodeId: "tv-host-st",
    idaLabel: "Gi0/1/8",
    idaMulticast: "29.243.53.26",
    vueltaLabel: "Gi0/1/8",
    vueltaMulticast: "29.243.53.26",
  },
  {
    nodeId: "rts66",
    idaLabel: "Gi0/1/9",
    idaMulticast: "29.243.53.27",
    vueltaLabel: "Gi0/1/9",
    vueltaMulticast: "29.243.53.27",
  },
];

const edges = routerConnections.flatMap((connection) => {
  const { nodeId, idaLabel, idaMulticast, vueltaLabel, vueltaMulticast } = connection;
  const idaEdge = createDirectionalEdge({
    id: `edge-${nodeId}-ida`,
    source: "router-asr",
    target: nodeId,
    label: idaLabel,
    multicast: idaMulticast,
    direction: "ida",
  });
  const vueltaEdge = createDirectionalEdge({
    id: `edge-${nodeId}-vuelta`,
    source: nodeId,
    target: "router-asr",
    label: vueltaLabel,
    multicast: vueltaMulticast,
    direction: "vuelta",
  });
  return [idaEdge, vueltaEdge];
});

routerAsrDiagram.nodes = nodes;
routerAsrDiagram.edges = edges;

export default Object.freeze(routerAsrDiagram);
