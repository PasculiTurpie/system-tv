import React, { useCallback, useContext, useMemo } from "react";
import PropTypes from "prop-types";
import { EdgeLabelRenderer } from "@xyflow/react";
import useDraggableLabel from "../../hooks/useDraggableLabel";
import { DiagramContext } from "./DiagramContext";
import { resolveLabelPosition } from "./diagramUtils";

const baseStyle = {
  position: "absolute",
  pointerEvents: "all",
  padding: "4px 8px",
  background: "rgba(255, 255, 255, 0.95)",
  border: "1px solid #d1d5db",
  borderRadius: 6,
  fontSize: 13,
  fontWeight: 600,
  color: "#111827",
  boxShadow: "0 2px 6px rgba(15, 23, 42, 0.12)",
  userSelect: "none",
  whiteSpace: "nowrap",
  zIndex: 15,
};

export default function NodeLabelDraggable({
  nodeId,
  text,
  position,
  defaultPosition,
  readOnly,
}) {
  const { clampPosition, onNodeLabelPositionChange, persistLabelPositions } =
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
            data: { labelPosition: nextPosition },
          },
        ],
      }).catch((error) => {
        console.error("Persist node label position failed", error);
        if (meta?.initial) {
          onNodeLabelPositionChange?.(nodeId, meta.initial);
        }
      });
    },
    [nodeId, onNodeLabelPositionChange, persistLabelPositions, readOnly]
  );

  const { transform, isDragging, handlePointerDown } = useDraggableLabel({
    initial: resolvedInitial,
    disabled: readOnly,
    clamp: clampPosition,
    onChange: (next) => onNodeLabelPositionChange?.(nodeId, next),
    onDragEnd: handlePersist,
  });

  return (
    <EdgeLabelRenderer>
      <div
        role="button"
        tabIndex={readOnly ? -1 : 0}
        onMouseDown={handlePointerDown}
        onTouchStart={handlePointerDown}
        style={{
          ...baseStyle,
          transform: transform,
          cursor: readOnly ? "default" : isDragging ? "grabbing" : "grab",
        }}
        className="channel-node-floating-label"
        aria-label="Etiqueta del nodo"
      >
        {text}
      </div>
    </EdgeLabelRenderer>
  );
}

NodeLabelDraggable.propTypes = {
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

NodeLabelDraggable.defaultProps = {
  text: "",
  position: null,
  defaultPosition: null,
  readOnly: false,
};
