import React, { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import "./MultiHandleNode.css";

const MultiHandleNode = memo(({ data }) => {
    console.log(data)
  const { title = `${data.label}`, subtitle = "", readOnly = false } = data || {};

  // Función auxiliar para generar handles según tipo y posición
  const renderHandles = (type, side, count = 8) => {
    const positionMap = {
      top: Position.Top,
      right: Position.Right,
      bottom: Position.Bottom,
      left: Position.Left,
    };
    const position = positionMap[side];

    return Array.from({ length: count }).map((_, index) => {
      const i = index + 1;
      const id = `${type}-${side}-${i}`;
      return (
        <Handle
          key={id}
          id={id}
          type={type === "in" ? "target" : "source"}
          position={position}
          isConnectable={!readOnly}
          className={`mh-handle ${type === "in" ? "mh-in" : "mh-out"} mh-${side}`}
        />
      );
    });
  };

  return (
    <div className="mh-node">
      <div className="mh-header">
        <div className="mh-title">{title}</div>
        {subtitle && <div className="mh-subtitle">{subtitle}</div>}
      </div>

      {/* Handles de entrada */}
      {["left", "top", "bottom", "right"].map((side) =>
        renderHandles("in", side)
      )}

      {/* Handles de salida */}
      {["left", "top", "bottom", "right"].map((side) =>
        renderHandles("out", side)
      )}
    </div>
  );
});

export default MultiHandleNode;
