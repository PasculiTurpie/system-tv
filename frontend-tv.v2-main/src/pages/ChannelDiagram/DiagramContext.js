import { createContext } from "react";

export const DiagramContext = createContext({
  isReadOnly: true,
  onNodeLabelChange: () => {},
  onNodeLabelPositionChange: () => {},
  onEdgeLabelChange: () => {},
  onEdgeLabelPositionChange: () => {},
  onEdgeEndpointLabelChange: () => {},
  onEdgeEndpointLabelPositionChange: () => {},
  clampPosition: (pos) => pos,
});

