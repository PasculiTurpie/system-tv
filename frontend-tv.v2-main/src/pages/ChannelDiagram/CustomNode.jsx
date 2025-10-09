import React, { useCallback, useContext, useMemo } from "react";
import { Handle, Position, useStore } from "@xyflow/react";
import EditableEdgeLabel from "./EditableEdgeLabel";
import { DiagramContext } from "./DiagramContext";

const box = {
  padding: 10,
  border: "1px solid #444",
  borderRadius: 10,
  background: "#fff",
  width: 170,
  position: "relative",
  textAlign: "center",
};

const dot = { background: "transparent" };
const pctTop = (p) => ({ top: `${p}%` });
const pctLeft = (p) => ({ left: `${p}%` });

export default function CustomNode({ id, data }) {
  const { isReadOnly, onNodeLabelChange, onNodeLabelPositionChange } =
    useContext(DiagramContext);

  const selectNode = useCallback((state) => state.nodeInternals.get(id), [id]);
  const nodeState = useStore(selectNode);

  const handleLabelCommit = useCallback(
    (nextLabel) => {
      onNodeLabelChange?.(id, nextLabel);
    },
    [id, onNodeLabelChange]
  );

  const handleLabelPositionChange = useCallback(
    (position) => {
      onNodeLabelPositionChange?.(id, position);
    },
    [id, onNodeLabelPositionChange]
  );

  const defaultLabelPosition = useMemo(() => {
    if (!nodeState?.positionAbsolute) {
      return null;
    }
    const width = Number.isFinite(nodeState.width) ? nodeState.width : 0;
    const x = nodeState.positionAbsolute.x + width / 2;
    const y = nodeState.positionAbsolute.y - 24;
    return { x, y };
  }, [
    nodeState?.positionAbsolute?.x,
    nodeState?.positionAbsolute?.y,
    nodeState?.width,
  ]);

  const hasStoredLabelPosition =
    data?.labelPosition &&
    Number.isFinite(data.labelPosition.x) &&
    Number.isFinite(data.labelPosition.y);

  const leftSlots = [30, 70];
  const rightSlots = [30, 70];
  const topSlots = [20, 50, 80];
  const bottomSlots = [20, 50, 80];

  return (
    <>
      <div title={data?.tooltip || data?.description || data?.label} style={box}>
        <div
          style={{
            fontWeight: "bold",
            padding: "2px 4px",
            cursor: isReadOnly ? "default" : "grab",
          }}
          title={
            isReadOnly
              ? "Solo lectura"
              : "Doble click para editar o arrastra la etiqueta flotante"
          }
        >
          {data?.label}
        </div>

        {/* TOP */}
        {topSlots.map((p, i) => (
          <React.Fragment key={`top-${i}`}>
            <Handle
              id={`in-top-${i + 1}`}
              type="target"
              position={Position.Top}
              style={{ ...dot, ...pctLeft(p) }}
            />
            <Handle
              id={`out-top-${i + 1}`}
              type="source"
              position={Position.Top}
              style={{ ...dot, ...pctLeft(p) }}
            />
          </React.Fragment>
        ))}

        {/* BOTTOM */}
        {bottomSlots.map((p, i) => (
          <React.Fragment key={`bottom-${i}`}>
            <Handle
              id={`in-bottom-${i + 1}`}
              type="target"
              position={Position.Bottom}
              style={{ ...dot, ...pctLeft(p) }}
            />
            <Handle
              id={`out-bottom-${i + 1}`}
              type="source"
              position={Position.Bottom}
              style={{ ...dot, ...pctLeft(p) }}
            />
          </React.Fragment>
        ))}

        {/* LEFT */}
        {leftSlots.map((p, i) => (
          <React.Fragment key={`left-${i}`}>
            <Handle
              id={`in-left-${i + 1}`}
              type="target"
              position={Position.Left}
              style={{ ...dot, ...pctTop(p) }}
            />
            <Handle
              id={`out-left-${i + 1}`}
              type="source"
              position={Position.Left}
              style={{ ...dot, ...pctTop(p) }}
            />
          </React.Fragment>
        ))}

        {/* RIGHT */}
        {rightSlots.map((p, i) => (
          <React.Fragment key={`right-${i}`}>
            <Handle
              id={`in-right-${i + 1}`}
              type="target"
              position={Position.Right}
              style={{ ...dot, ...pctTop(p) }}
            />
            <Handle
              id={`out-right-${i + 1}`}
              type="source"
              position={Position.Right}
              style={{ ...dot, ...pctTop(p) }}
            />
          </React.Fragment>
        ))}
      </div>

      {(defaultLabelPosition || hasStoredLabelPosition) && (
        <EditableEdgeLabel
          text={data?.label || ""}
          position={data?.labelPosition}
          defaultPosition={
            defaultLabelPosition || data?.labelPosition || { x: 0, y: 0 }
          }
          readOnly={isReadOnly}
          ariaLabel="Etiqueta del nodo"
          placeholder="Etiqueta del nodo"
          onCommit={handleLabelCommit}
          onPositionChange={handleLabelPositionChange}
          style={{ fontSize: 14, fontWeight: 600, zIndex: 10 }}
          className="channel-node-label"
        />
      )}
    </>
  );
}
