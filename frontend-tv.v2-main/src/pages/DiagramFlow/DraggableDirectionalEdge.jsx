// src/pages/ChannelDiagram/edges/DraggableDirectionalEdge.jsx
import { BaseEdge, getSmoothStepPath } from "@xyflow/react";
import { useMemo, useState } from "react";

import "./DraggableDirectionalEdge.css";

import { getDirectionColor } from "./directionColors";

const buildTooltip = (edgeData = {}) => {
  const start = edgeData?.labelStart ?? edgeData?.endpointLabels?.source ?? "";
  const end = edgeData?.labelEnd ?? edgeData?.endpointLabels?.target ?? "";

  const title =
    edgeData?.tooltipTitle ??
    edgeData?.label ??
    edgeData?.id ??
    start ||
    end ||
    "Etiqueta centro";

  const body = edgeData?.tooltip ?? (start || end ? `${start} to ${end}` : "");

  return { title, body };
};

export default function DraggableDirectionalEdge(props) {
  const {
    id,
    sourceX, sourceY,
    targetX, targetY,
    sourcePosition, targetPosition,
    markerEnd,
    style,
    data = {},
  } = props;

  const isSaving = Boolean(data?.isSaving);

  // path con curva suave tipo "SmoothStep"
  const [edgePath, labelX, labelY] = useMemo(() => {
    return getSmoothStepPath({
      sourceX,
      sourceY,
      targetX,
      targetY,
      sourcePosition,
      targetPosition,
      borderRadius: 12, // suaviza aún más la curva
    });
  }, [sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition]);

  /* ---------------------- label arrastrable ---------------------- */
  const currentLabelX = data?.labelPosition?.x ?? labelX;
  const currentLabelY = data?.labelPosition?.y ?? labelY;

  const { title: tooltipTitle, body: tooltipBody } = useMemo(
    () => buildTooltip(data),
    [data]
  );

  /* --------------------------- Tooltip --------------------------- */
  const [hover, setHover] = useState(false);
  const [mouse, setMouse] = useState({ x: labelX, y: labelY });

  const onHoverMove = (e) => {
    if (typeof e.nativeEvent.offsetX === "number") {
      setMouse({ x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY });
    }
  };

  /* --------------------------- Estilos --------------------------- */
  const direction = data?.direction ?? "ida";
  const strokeColor = getDirectionColor(direction);

  const animatedStyle = {
    stroke: strokeColor,
    strokeWidth: 2,
    ...style,
  };

  /* ----------------------- Render del Edge ----------------------- */
  return (
    <>
      {/* Línea visible con animación */}
      <path
        d={edgePath}
        fill="none"
        style={animatedStyle}
        markerEnd={markerEnd}
        className="edge-stroke-animated"
      />

      {/* Path invisible que detecta hover */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={16}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onMouseMove={onHoverMove}
      />

      {/* Label arrastrable */}
      {/* <foreignObject
        x={(currentLabelX ?? labelX) - 60}
        y={(currentLabelY ?? labelY) - 16}
        width={120}
        height={28}
        requiredExtensions="http://www.w3.org/1999/xhtml"
      >
        <div
          xmlns="http://www.w3.org/1999/xhtml"
          onMouseDown={onLabelMouseDown}
          style={{
            width: "100%", height: "100%",
            display: "flex", alignItems: "center", justifyContent: "center",
            borderRadius: 8, padding: "2px 8px",
            background: "rgba(255,255,255,0.95)",
            boxShadow: "0 2px 6px rgba(0,0,0,.25)",
            fontSize: 12, cursor: "grab", userSelect: "none",
            border: `1px solid ${strokeColor}`,
          }}
          title={data?.tooltip || ""}
        >
          {data?.label ?? "label"}
        </div>
      </foreignObject> */}

      {/* Tooltip al hover */}
      {isSaving && (
        <foreignObject
          x={(currentLabelX ?? labelX) - 40}
          y={(currentLabelY ?? labelY) - 50}
          width={90}
          height={24}
          requiredExtensions="http://www.w3.org/1999/xhtml"
        >
          <div
            xmlns="http://www.w3.org/1999/xhtml"
            style={{
              padding: "4px 6px",
              borderRadius: 6,
              background: "rgba(13,110,253,0.85)",
              color: "#fff",
              fontSize: 11,
              fontWeight: 600,
              pointerEvents: "none",
            }}
          >
            Guardando…
          </div>
        </foreignObject>
      )}

      {hover && (tooltipBody || data?.multicast) && (
        <foreignObject
          x={(mouse.x ?? labelX) + 10}
          y={(mouse.y ?? labelY) + 10}
          width={260}
          height={120}
          requiredExtensions="http://www.w3.org/1999/xhtml"
        >
          <div
            xmlns="http://www.w3.org/1999/xhtml"
            style={{
              maxWidth: 'fit-content',
              padding: "8px 10px",
              borderRadius: 8,
              background: "rgba(0,0,0,0.8)",
              color: "#fff",
              fontSize: 12,
              lineHeight: 1.3,
              boxShadow: "0 6px 14px rgba(0,0,0,.3)",
              pointerEvents: "none",
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 4 }}>
              {tooltipTitle}
            </div>
            <div>{tooltipBody || "Sin descripción"}</div>
            {data?.multicast && (
              <div style={{ marginTop: 6, opacity: .9 }}>
                Multicast: {data.multicast}
              </div>
            )}
          </div>
        </foreignObject>
      )}
    </>
  );
}
