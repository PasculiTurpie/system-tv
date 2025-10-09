import React, { useCallback, useContext, useMemo } from "react";
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath } from "@xyflow/react";
import { DiagramContext } from "./DiagramContext";
import EditableEdgeLabel from "./EditableEdgeLabel";

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

  const endpointLabels = data?.endpointLabels || {};
  const endpointLabelPositions = data?.endpointLabelPositions || {};

  const endpointDefaults = useMemo(
    () => ({
      source: { x: sourceX - 20, y: sourceY - 24 },
      target: { x: targetX + 20, y: targetY - 24 },
    }),
    [sourceX, sourceY, targetX, targetY]
  );

  const handleCentralLabelCommit = useCallback(
    (nextLabel) => onEdgeLabelChange?.(id, nextLabel),
    [id, onEdgeLabelChange]
  );

  const handleCentralPositionChange = useCallback(
    (position) => onEdgeLabelPositionChange?.(id, position),
    [id, onEdgeLabelPositionChange]
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

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={style} markerEnd={markerEnd} />
      <EditableEdgeLabel
        text={label || data?.label || ""}
        position={data?.labelPosition}
        defaultPosition={centralLabelPosition}
        readOnly={isReadOnly}
        ariaLabel="Etiqueta del enlace"
        onCommit={handleCentralLabelCommit}
        onPositionChange={handleCentralPositionChange}
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
        />
      )}
    </>
  );
}
