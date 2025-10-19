import { createContext } from "react";

export const DiagramContext = createContext({
  isReadOnly: true,
  onNodeLabelChange: () => {},
  onNodeLabelPositionChange: () => {},
  onNodeMulticastPositionChange: () => {},
  onEdgeLabelChange: () => {},
  onEdgeLabelPositionChange: () => {},
  onEdgeEndpointLabelChange: () => {},
  onEdgeEndpointLabelPositionChange: () => {},
  onEdgeEndpointLabelPersist: () => {},
  onEdgeMulticastPositionChange: () => {},
  persistLabelPositions: () => Promise.resolve({ ok: false }),
  clampPosition: (pos) => pos,
  ensureRouterEdges: () => ({ added: 0, removed: 0 }),
});

