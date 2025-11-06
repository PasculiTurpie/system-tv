// src/pages/ChannelDiagram/edges/DraggableDirectionalEdge.jsx
import { BaseEdge, getSmoothStepPath } from "@xyflow/react";
import { useMemo, useState, useRef, useEffect } from "react";

import { getDirectionColor } from "./directionColors";

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

  const dragRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const onLabelMouseDown = (e) => {
    e.stopPropagation();
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: currentLabelX,
      origY: currentLabelY,
    };
    setDragging(true);
  };

  const dispatchLabelPos = (x, y) => {
    window.dispatchEvent(new CustomEvent("rf-edge-label-move", {
      detail: { id, x, y },
    }));
  };

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e) => {
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      const nx = dragRef.current.origX + dx;
      const ny = dragRef.current.origY + dy;
      dispatchLabelPos(nx, ny);
    };
    const onUp = () => setDragging(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragging, id]);

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
      <foreignObject
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
      </foreignObject>

      {/* Tooltip al hover */}
      {hover && (data?.tooltip || data?.multicast) && (
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
              {data?.tooltipTitle ?? "Detalle de enlace"}
            </div>
            <div>{data?.tooltip ?? "Sin descripción"}</div>
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
