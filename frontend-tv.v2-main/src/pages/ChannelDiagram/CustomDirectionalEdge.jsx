import React, { useMemo } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  MarkerType,
  getBezierPath,
} from "@xyflow/react";

const DIRECTION_STYLE = {
  ida: {
    stroke: "#dc2626",
    markerStart: null,
    markerEnd: { type: MarkerType.ArrowClosed, color: "#dc2626" },
  },
  vuelta: {
    stroke: "#16a34a",
    markerStart: { type: MarkerType.ArrowClosed, color: "#16a34a" },
    markerEnd: null,
  },
  bi: {
    stroke: "#2563eb",
    markerStart: { type: MarkerType.ArrowClosed, color: "#2563eb" },
    markerEnd: { type: MarkerType.ArrowClosed, color: "#2563eb" },
  },
};

function renderLabel(id, text, x, y) {
  if (!text) {
    return null;
  }
  return (
    <EdgeLabelRenderer key={id}>
      <div
        style={{
          position: "absolute",
          transform: `translate(-50%, -50%) translate(${x}px, ${y}px)`
            + " scale(var(--rf-edge-label-zoom, 1))",
          padding: "2px 6px",
          borderRadius: 6,
          background: "rgba(15, 23, 42, 0.84)",
          color: "#fff",
          fontSize: 11,
          lineHeight: 1.2,
          whiteSpace: "nowrap",
          pointerEvents: "all",
        }}
        className="directional-edge__label"
      >
        {text}
      </div>
    </EdgeLabelRenderer>
  );
}

export default function CustomDirectionalEdge(props) {
  const {
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    style = {},
    markerStart,
    markerEnd,
    data = {},
    label,
  } = props;

  const direction = data?.direction || "ida";
  const config = DIRECTION_STYLE[direction] || DIRECTION_STYLE.ida;

  const [edgePath, centerX, centerY] = useMemo(
    () =>
      getBezierPath({
        sourceX,
        sourceY,
        targetX,
        targetY,
        sourcePosition,
        targetPosition,
      }),
    [sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition]
  );

  const startLabelPosition = useMemo(
    () => ({
      x: (sourceX + centerX) / 2,
      y: (sourceY + centerY) / 2,
    }),
    [centerX, centerY, sourceX, sourceY]
  );

  const endLabelPosition = useMemo(
    () => ({
      x: (targetX + centerX) / 2,
      y: (targetY + centerY) / 2,
    }),
    [centerX, centerY, targetX, targetY]
  );

  const mergedStyle = {
    strokeWidth: 2,
    stroke: config.stroke,
    ...style,
  };

  const appliedMarkerStart = markerStart || config.markerStart || undefined;
  const appliedMarkerEnd = markerEnd || config.markerEnd || undefined;

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerStart={appliedMarkerStart}
        markerEnd={appliedMarkerEnd}
        style={mergedStyle}
      />
      {renderLabel(`${id}-start`, data?.labelStart, startLabelPosition.x, startLabelPosition.y)}
      {renderLabel(`${id}-center`, label, centerX, centerY)}
      {renderLabel(`${id}-end`, data?.labelEnd, endLabelPosition.x, endLabelPosition.y)}
    </>
  );
}
