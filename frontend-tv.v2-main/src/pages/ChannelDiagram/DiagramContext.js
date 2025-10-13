import { createContext } from "react";

export const DiagramContext = createContext({
  isReadOnly: true,
  onNodeLabelChange: () => {},
  onNodeLabelPositionChange: () => {},
  onEdgeLabelChange: () => {},
  onEdgeLabelPositionChange: () => {},
  onEdgeEndpointLabelChange: () => {},
  onEdgeEndpointLabelPositionChange: () => {},
  onEdgeMulticastPositionChange: () => {},
  clampPosition: (pos) => pos,
});

