import React, { useMemo } from "react";
import {
  BaseEdge,
  BezierEdge,
  EdgeLabelRenderer,
  getBezierPath,
} from "@xyflow/react";

/**
 * Edge custom con:
 * - label central (data.label o edge.label)
 * - labelStart (cerca del source)
 * - labelEnd (cerca del target)
 * - color por dirección: ida (rojo), vuelta (verde) — configurable por style
 * - soporta sourceHandle / targetHandle existentes
 */
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
    markerStart,
    data = {},
    label, // por si viene en edge.label
  } = props;

  // Dirección y color (puedes sobreescribir por style.stroke)
  const direction = data.direction ?? "ida"; // "ida" | "vuelta"
  const defaultStroke = direction === "vuelta" ? "green" : "red";
  const stroke = style?.stroke || defaultStroke;
  const strokeWidth = style?.strokeWidth ?? 2;

  // Bezier path + punto medio
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

  // Posición del label central: usa data.labelPosition si llega desde API
  const { labelPosition } = data;
  const midX = labelPosition?.x ?? centerX;
  const midY = labelPosition?.y ?? centerY;

  // Aproximaciones para ubicar labelStart y labelEnd (10% y 90% del tramo)
  const startPos = useMemo(() => {
    const t = 0.1;
    return {
      x: sourceX + (targetX - sourceX) * t,
      y: sourceY + (targetY - sourceY) * t,
    };
  }, [sourceX, sourceY, targetX, targetY]);

  const endPos = useMemo(() => {
    const t = 0.9;
    return {
      x: sourceX + (targetX - sourceX) * t,
      y: sourceY + (targetY - sourceY) * t,
    };
  }, [sourceX, sourceY, targetX, targetY]);

  // Marcadores (flechas). Si no llegan desde props, setea por dirección.
  const computedMarkerEnd =
    markerEnd ??
    (direction === "ida"
      ? { type: "arrowclosed" }
      : undefined);

  const computedMarkerStart =
    markerStart ??
    (direction === "vuelta"
      ? { type: "arrowclosed" }
      : undefined);

  // Clase para pill de labels
  const pillClass =
    "px-2 py-1 rounded-full text-xs font-medium bg-white/90 shadow border border-black/10";

  return (
    <>
      {/* Dibujo del edge (Bezier) */}
      <BaseEdge id={id} path={edgePath} style={{ stroke, strokeWidth }} />

      {/* Flechas: si usas BezierEdge, renderiza markers automáticamente */}
      <BezierEdge
        {...props}
        style={{ stroke: "transparent", strokeWidth: 0 }}
        markerEnd={computedMarkerEnd}
        markerStart={computedMarkerStart}
      />

      {/* Labels */}
      <EdgeLabelRenderer>
        {/* Label central */}
        {(data.label || label) && (
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${midX}px, ${midY}px)`,
              pointerEvents: "all",
            }}
            className={pillClass}
          >
            {data.label ?? label}
          </div>
        )}

        {/* LabelStart (cerca del source) */}
        {data.labelStart && (
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${startPos.x}px, ${startPos.y}px)`,
              pointerEvents: "all",
            }}
            className={pillClass}
          >
            {data.labelStart}
          </div>
        )}

        {/* LabelEnd (cerca del target) */}
        {data.labelEnd && (
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${endPos.x}px, ${endPos.y}px)`,
              pointerEvents: "all",
            }}
            className={pillClass}
          >
            {data.labelEnd}
          </div>
        )}
      </EdgeLabelRenderer>
    </>
  );
}
