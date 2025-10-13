import React, { useCallback, useContext, useMemo } from "react";
import PropTypes from "prop-types";
import { EdgeLabelRenderer } from "@xyflow/react";
import useDraggableLabel from "../../hooks/useDraggableLabel";
import { DiagramContext } from "./DiagramContext";
import { resolveLabelPosition } from "./diagramUtils";

const baseStyle = {
  position: "absolute",
  pointerEvents: "all",
  padding: "2px 6px",
  background: "#1f2937",
  color: "#f9fafb",
  borderRadius: 6,
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: 0.4,
  textTransform: "uppercase",
  userSelect: "none",
  whiteSpace: "nowrap",
  boxShadow: "0 2px 10px rgba(15, 23, 42, 0.25)",
  border: "1px solid rgba(17, 24, 39, 0.8)",
  zIndex: 16,
  touchAction: "none",
};

export default function NodeMulticastDraggable({
  nodeId,
  text,
  position,
  defaultPosition,
  readOnly,
}) {
  const { clampPosition, onNodeMulticastPositionChange, persistLabelPositions } =
    useContext(DiagramContext);

  if (!text || (!position && !defaultPosition)) {
    return null;
  }

  const resolvedInitial = useMemo(
    () => resolveLabelPosition(position, defaultPosition, clampPosition),
    [position, defaultPosition, clampPosition]
  );

  const handlePersist = useCallback(
    (nextPosition, meta) => {
      if (!meta?.moved || readOnly || !persistLabelPositions) {
        return;
      }
      persistLabelPositions({
        nodes: [
          {
            id: nodeId,
            data: { multicastPosition: nextPosition },
          },
        ],
      }).catch((error) => {
        console.error("Persist node multicast position failed", error);
        if (meta?.initial) {
          onNodeMulticastPositionChange?.(nodeId, meta.initial);
        }
      });
    },
    [nodeId, onNodeMulticastPositionChange, persistLabelPositions, readOnly]
  );

  const { transform, isDragging, handlePointerDown } = useDraggableLabel({
    initial: resolvedInitial,
    disabled: readOnly,
    clamp: clampPosition,
    onChange: (next) => onNodeMulticastPositionChange?.(nodeId, next),
    onDragEnd: handlePersist,
  });

  return (
    <EdgeLabelRenderer>
      <div
        role="button"
        tabIndex={readOnly ? -1 : 0}
        onMouseDown={handlePointerDown}
        onPointerDown={handlePointerDown}
        onTouchStart={handlePointerDown}
        style={{
          ...baseStyle,
          transform,
          cursor: readOnly ? "default" : isDragging ? "grabbing" : "grab",
        }}
        className="nodrag nopan channel-node-multicast-badge"
        draggable={false}
        aria-label="Etiqueta multicast del nodo"
      >
        {text}
      </div>
    </EdgeLabelRenderer>
  );
}

NodeMulticastDraggable.propTypes = {
  nodeId: PropTypes.string.isRequired,
  text: PropTypes.string,
  position: PropTypes.shape({
    x: PropTypes.number,
    y: PropTypes.number,
  }),
  defaultPosition: PropTypes.shape({
    x: PropTypes.number,
    y: PropTypes.number,
  }),
  readOnly: PropTypes.bool,
};

NodeMulticastDraggable.defaultProps = {
  text: "",
  position: null,
  defaultPosition: null,
  readOnly: false,
};
