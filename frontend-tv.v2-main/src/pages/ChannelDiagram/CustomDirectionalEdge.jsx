import React, { useCallback, useContext, useMemo } from "react";
import { BaseEdge } from "@xyflow/react";
import { DiagramContext } from "./DiagramContext";
import EdgeLabelDraggable from "./EdgeLabelDraggable";
import { computeParallelPath } from "./diagramUtils";

export default function CustomDirectionalEdge(props) {
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
    onEdgeMulticastPositionChange,
    persistLabelPositions,
  } = useContext(DiagramContext);
  const isReverse = !!data?.__reversed;

  const [edgePath, defaultLabelX, defaultLabelY, shift] = useMemo(
    () =>
      computeParallelPath({
        sourceX,
        sourceY,
        targetX,
        targetY,
        sourcePosition,
        targetPosition,
        isReverse,
      }),
    [
      sourceX,
      sourceY,
      targetX,
      targetY,
      sourcePosition,
      targetPosition,
      isReverse,
    ]
  );

  const centralLabelPosition = useMemo(() => {
    const stored = data?.labelPosition || data?.labelPos;
    if (stored && Number.isFinite(stored.x) && Number.isFinite(stored.y)) {
      return stored;
    }
    return { x: defaultLabelX, y: defaultLabelY };
  }, [data?.labelPosition, data?.labelPos, defaultLabelX, defaultLabelY]);

  const endpointDefaults = useMemo(
    () => ({
      source: {
        x: sourceX + (shift?.ox || 0) - 24,
        y: sourceY + (shift?.oy || 0) - 24,
      },
      target: {
        x: targetX + (shift?.ox || 0) + 24,
        y: targetY + (shift?.oy || 0) - 24,
      },
    }),
    [shift?.ox, shift?.oy, sourceX, sourceY, targetX, targetY]
  );

  const endpointLabels = data?.endpointLabels || {};
  const endpointLabelPositions = data?.endpointLabelPositions || {};

  const multicast = data?.multicast;
  const multicastDefaultPosition = useMemo(() => {
    if (!multicast) return null;
    const BASE_OFFSET = 14;
    return {
      x: sourceX + (shift?.ox || 0) + BASE_OFFSET,
      y: sourceY + (shift?.oy || 0) - BASE_OFFSET,
    };
  }, [multicast, shift?.ox, shift?.oy, sourceX, sourceY]);

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
        console.error("Persist edge label position failed", error);
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

  const handleMulticastPersist = useCallback(
    (nextPosition, meta) => {
      if (!meta?.moved || isReadOnly || !persistLabelPositions) {
        return;
      }
      persistLabelPositions({
        edges: {
          [id]: { multicastPosition: nextPosition },
        },
      }).catch((error) => {
        console.error("Persist edge multicast position failed", error);
        if (meta?.initial) {
          onEdgeMulticastPositionChange?.(id, meta.initial);
        }
      });
    },
    [id, isReadOnly, onEdgeMulticastPositionChange, persistLabelPositions]
  );

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={style} markerEnd={markerEnd} />

      <EdgeLabelDraggable
        text={label || data?.label || ""}
        position={data?.labelPosition}
        defaultPosition={centralLabelPosition}
        readOnly={isReadOnly}
        ariaLabel="Etiqueta del enlace"
        placeholder="Etiqueta del enlace"
        onTextCommit={handleCentralLabelCommit}
        onPositionChange={handleCentralPositionChange}
        onPersist={handleCentralPersist}
      />

    {/*   {(endpointLabels.source || !isReadOnly) && (
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
      )} */}

      {multicast && multicastDefaultPosition && (
        <EdgeLabelDraggable
          text={multicast}
          position={data?.multicastPosition}
          defaultPosition={multicastDefaultPosition}
          readOnly={isReadOnly}
          allowEditing={false}
          ariaLabel="Badge multicast"
          onPositionChange={(position) =>
            onEdgeMulticastPositionChange?.(id, position)
          }
          onPersist={handleMulticastPersist}
          style={{
            background: "#1f2937",
            color: "#fff",
            border: "1px solid #111827",
            borderRadius: 6,
            padding: "2px 6px",
            fontSize: 11,
            boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
            whiteSpace: "nowrap",
            opacity: 0.9,
            textTransform: "uppercase",
            letterSpacing: 0.4,
          }}
        />
      )}
    </>
  );
}
