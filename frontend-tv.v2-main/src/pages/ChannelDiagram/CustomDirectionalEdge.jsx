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
        allowEditing={!isReadOnly}
        allowDragging={!isReadOnly}
        ariaLabel="Etiqueta del enlace"
        placeholder="Etiqueta del enlace"
        onTextCommit={handleCentralLabelCommit}
        onPositionChange={handleCentralPositionChange}
        onPersist={handleCentralPersist}
      />

      {multicast && multicastDefaultPosition && (
        <EdgeLabelDraggable
          text={multicast}
          position={data?.multicastPosition}
          defaultPosition={multicastDefaultPosition}
          readOnly={isReadOnly}
          allowEditing={false}
          allowDragging={!isReadOnly}
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
