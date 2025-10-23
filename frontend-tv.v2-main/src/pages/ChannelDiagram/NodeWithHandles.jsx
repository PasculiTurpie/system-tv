import React from "react";
import { Handle, Position } from "@xyflow/react";

import { getHandlesForNodeType, parseHandle } from "./handles";

const SIDE_TO_POSITION = {
  left: Position.Left,
  right: Position.Right,
  top: Position.Top,
  bottom: Position.Bottom,
};

function renderHandles(handleIds, expectedKind) {
  return handleIds
    .map((id) => {
      const parsed = parseHandle(id);
      if (!parsed) {
        return null;
      }
      const { side, kind } = parsed;
      const position = SIDE_TO_POSITION[side] || Position.Top;
      const type = kind === "in" ? "target" : "source";
      if (type === "target" && expectedKind !== "target") {
        // Skip mismatched handles if the map is incorrect
        return null;
      }
      if (type === "source" && expectedKind !== "source") {
        return null;
      }
      return (
        <Handle
          key={id}
          id={id}
          type={type}
          position={position}
          data-handle-id={id}
          style={{ width: 8, height: 8 }}
        />
      );
    })
    .filter(Boolean);
}

export default function NodeWithHandles({ id, data = {}, type }) {
  const handles = getHandlesForNodeType(type);
  const targetHandles = renderHandles(handles.in || [], "target");
  const sourceHandles = renderHandles(handles.out || [], "source");

  return (
    <div
      className="node-with-handles"
      style={{
        minWidth: 160,
        minHeight: 60,
        borderRadius: 12,
        border: "1px solid #cbd5f5",
        background: "#fff",
        padding: "12px 16px",
        boxShadow: "0 2px 6px rgba(15, 23, 42, 0.08)",
        position: "relative",
        fontSize: 13,
        color: "#0f172a",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
      }}
    >
      {targetHandles}
      <div
        style={{
          pointerEvents: "none",
          fontWeight: 600,
          lineHeight: 1.4,
        }}
      >
        {data?.label || type || id}
      </div>
      {sourceHandles}
    </div>
  );
}
