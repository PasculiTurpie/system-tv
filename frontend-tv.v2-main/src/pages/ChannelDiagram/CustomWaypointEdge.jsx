import React, { useCallback, useContext, useMemo } from "react";
import { BaseEdge, getSmoothStepPath } from "@xyflow/react";
import { DiagramContext } from "./DiagramContext";
import EdgeLabelDraggable from "./EdgeLabelDraggable";
import EditableEdgeLabel from "./EditableEdgeLabel";
import { computeEndpointLabelDefaults } from "./edgeLabelUtils";

const SOURCE_FALLBACK_OFFSET = Object.freeze({ x: -20, y: -24 });
const TARGET_FALLBACK_OFFSET = Object.freeze({ x: 20, y: -24 });
const ORIENTED_OFFSETS = Object.freeze({
  left: { x: -28, y: -8 },
  right: { x: 28, y: -8 },
  top: { x: 0, y: -28 },
  bottom: { x: 0, y: 20 },
});

const resolveEndpointOffset = (position, kind) => {
  const normalized = typeof position === "string" ? position.toLowerCase() : "";
  const oriented = ORIENTED_OFFSETS[normalized];
  if (oriented) return oriented;
  return kind === "target" ? TARGET_FALLBACK_OFFSET : SOURCE_FALLBACK_OFFSET;
};

export default function CustomWaypointEdge(props) {
  const {
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    style,
    markerEnd,
    data = {},
    label,
  } = props;

  const {
    isReadOnly,
    onEdgeLabelChange,
    onEdgeLabelPositionChange,
    onEdgeEndpointLabelChange,
    onEdgeEndpointLabelPositionChange,
    onEdgeEndpointLabelPersist,
    persistLabelPositions,
  } = useContext(DiagramContext);

  const [edgePath, defaultLabelX, defaultLabelY] = useMemo(() => {
    const [d, lx, ly] = getSmoothStepPath({
      sourceX,
      sourceY,
      targetX,
      targetY,
      sourcePosition,
      targetPosition,
      borderRadius: 0,
    });
    return [d, lx, ly];
  }, [sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition]);

  const centralLabelPosition = useMemo(() => {
    const stored = data?.labelPosition || data?.labelPos;
    if (stored && Number.isFinite(stored.x) && Number.isFinite(stored.y)) {
      return stored;
    }
    return { x: defaultLabelX, y: defaultLabelY };
  }, [data?.labelPosition, data?.labelPos, defaultLabelX, defaultLabelY]);

  const rawEndpointLabels = data?.endpointLabels || {};
  const labelStart = data?.labelStart ?? rawEndpointLabels.source;
  const labelEnd = data?.labelEnd ?? rawEndpointLabels.target;
  const endpointLabels = {
    ...(labelStart ? { source: labelStart } : {}),
    ...(labelEnd ? { target: labelEnd } : {}),
  };
  const endpointLabelPositions = data?.endpointLabelPositions || {};

  const endpointDefaults = useMemo(
    () =>
      computeEndpointLabelDefaults({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
      }),
    [sourcePosition, sourceX, sourceY, targetPosition, targetX, targetY]
  );

  const handleCentralLabelCommit = useCallback(
    (nextLabel) => onEdgeLabelChange?.(id, nextLabel),
    [id, onEdgeLabelChange]
  );

  const handleCentralPositionChange = useCallback(
    (position) => onEdgeLabelPositionChange?.(id, position),
    [id, onEdgeLabelPositionChange]
  );

  const handleCentralPersist = useCallback(
    (nextPosition, meta) => {
      if (!meta?.moved || isReadOnly || !persistLabelPositions) {
        return;
      }
      persistLabelPositions({
        edges: {
          [id]: { labelPosition: nextPosition },
        },
      }).catch((error) => {
        console.error("Persist waypoint label position failed", error);
        if (meta?.initial) {
          onEdgeLabelPositionChange?.(id, meta.initial);
        }
      });
    },
    [id, isReadOnly, onEdgeLabelPositionChange, persistLabelPositions]
  );

  const handleEndpointLabelCommit = useCallback(
    (endpoint, nextLabel) => onEdgeEndpointLabelChange?.(id, endpoint, nextLabel),
    [id, onEdgeEndpointLabelChange]
  );

  const handleEndpointPositionChange = useCallback(
    (endpoint, position) =>
      onEdgeEndpointLabelPositionChange?.(id, endpoint, position),
    [id, onEdgeEndpointLabelPositionChange]
  );

  const handleEndpointPersist = useCallback(
    (endpoint, position, meta) =>
      onEdgeEndpointLabelPersist?.(id, endpoint, position, meta),
    [id, onEdgeEndpointLabelPersist]
  );

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={style} markerEnd={markerEnd} />
      <EdgeLabelDraggable
        text={label || data?.label || ""}
        position={data?.labelPosition}
        defaultPosition={centralLabelPosition}
        readOnly={isReadOnly}
        allowEditing={!isReadOnly}
        allowDragging={!isReadOnly}
        ariaLabel="Etiqueta del enlace"
        placeholder="Etiqueta del enlace"
        onTextCommit={handleCentralLabelCommit}
        onPositionChange={handleCentralPositionChange}
        onPersist={handleCentralPersist}
      />

      {(endpointLabels.source || !isReadOnly) && (
        <EditableEdgeLabel
          text={endpointLabels.source || ""}
          position={endpointLabelPositions.source}
          defaultPosition={endpointDefaults.source}
          readOnly={isReadOnly}
          ariaLabel="Etiqueta del extremo de origen"
          placeholder="Etiqueta origen"
          onCommit={(value) => handleEndpointLabelCommit("source", value)}
          onPositionChange={(position) =>
            handleEndpointPositionChange("source", position)
          }
          onPersist={(position, meta) =>
            handleEndpointPersist("source", position, meta)
          }
        />
      )}

      {(endpointLabels.target || !isReadOnly) && (
        <EditableEdgeLabel
          text={endpointLabels.target || ""}
          position={endpointLabelPositions.target}
          defaultPosition={endpointDefaults.target}
          readOnly={isReadOnly}
          ariaLabel="Etiqueta del extremo de destino"
          placeholder="Etiqueta destino"
          onCommit={(value) => handleEndpointLabelCommit("target", value)}
          onPositionChange={(position) =>
            handleEndpointPositionChange("target", position)
          }
          onPersist={(position, meta) =>
            handleEndpointPersist("target", position, meta)
          }
        />
      )}
    </>
  );
}
