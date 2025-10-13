// src/components/CustomNode.jsx
import React, { useCallback, useContext, useMemo } from "react";
import PropTypes from "prop-types";
import { Handle, Position, useStore } from "@xyflow/react";
import { shallow } from "zustand/shallow";
import EditableEdgeLabel from "./EditableEdgeLabel";
import { DiagramContext } from "./DiagramContext";

const DEFAULT_SLOTS = {
  top: [20, 50, 80],
  bottom: [20, 50, 80],
  left: [30, 70],
  right: [30, 70],
};

function CustomNode({ id, data }) {
  const { isReadOnly, onNodeLabelChange, onNodeLabelPositionChange } =
    useContext(DiagramContext);

  const { xAbs, yAbs, width, ready } = useStore(
    useCallback(
      (state) => {
        const map = state?.nodeInternals;
        if (!map || typeof map.get !== "function") {
          return { xAbs: null, yAbs: null, width: 0, ready: false };
        }
        const node = map.get(id);
        const pos = node?.positionAbsolute;
        return {
          xAbs: Number.isFinite(pos?.x) ? pos.x : null,
          yAbs: Number.isFinite(pos?.y) ? pos.y : null,
          width: Number.isFinite(node?.width) ? node.width : 0,
          ready: true,
        };
      },
      [id]
    ),
    shallow
  );

  const hasStoredLabelPosition =
    data?.labelPosition &&
    Number.isFinite(data.labelPosition.x) &&
    Number.isFinite(data.labelPosition.y);

  const defaultLabelPosition = useMemo(() => {
    if (!ready || !Number.isFinite(xAbs) || !Number.isFinite(yAbs)) return null;
    const cx = xAbs + (Number.isFinite(width) ? width : 0) / 2;
    const cy = yAbs - 24;
    return { x: cx, y: cy };
  }, [ready, xAbs, yAbs, width]);

  const effectiveLabelDefault = useMemo(() => {
    if (hasStoredLabelPosition) return data.labelPosition;
    if (defaultLabelPosition) return defaultLabelPosition;
    return { x: 0, y: 0 };
  }, [hasStoredLabelPosition, data?.labelPosition, defaultLabelPosition]);

  const slots = useMemo(() => {
    const s = data?.slots ?? {};
    return {
      top: Array.isArray(s.top) && s.top.length ? s.top : DEFAULT_SLOTS.top,
      bottom:
        Array.isArray(s.bottom) && s.bottom.length
          ? s.bottom
          : DEFAULT_SLOTS.bottom,
      left:
        Array.isArray(s.left) && s.left.length ? s.left : DEFAULT_SLOTS.left,
      right:
        Array.isArray(s.right) && s.right.length ? s.right : DEFAULT_SLOTS.right,
    };
  }, [data?.slots]);

  const boxStyle = useMemo(
    () => ({
      padding: 10,
      border: "1px solid #444",
      borderRadius: 10,
      background: "#fff",
      width: 170,
      position: "relative",
      textAlign: "center",
      cursor: isReadOnly ? "default" : "grab",
      userSelect: "none",
    }),
    [isReadOnly]
  );

  const titleText = useMemo(
    () => data?.tooltip || data?.description || data?.label || "Nodo",
    [data?.tooltip, data?.description, data?.label]
  );

  const dotBase = useMemo(() => ({ background: "transparent" }), []);
  const pctTop = useCallback((p) => ({ top: `${p}%` }), []);
  const pctLeft = useCallback((p) => ({ left: `${p}%` }), []);

  const handleLabelCommit = useCallback(
    (nextLabel) => onNodeLabelChange?.(id, nextLabel),
    [id, onNodeLabelChange]
  );

  const handleLabelPositionChange = useCallback(
    (position) => onNodeLabelPositionChange?.(id, position),
    [id, onNodeLabelPositionChange]
  );

  const renderHandles = useCallback(
    (side, list) =>
      list.map((p, i) => {
        const idx = i + 1;
        const key = `${side}-${idx}`;
        const style =
          side === "top" || side === "bottom"
            ? { ...dotBase, ...pctLeft(p) }
            : { ...dotBase, ...pctTop(p) };

        const pos =
          side === "top"
            ? Position.Top
            : side === "bottom"
            ? Position.Bottom
            : side === "left"
            ? Position.Left
            : Position.Right;

        return (
          <React.Fragment key={key}>
            <Handle
              id={`in-${side}-${idx}`}
              type="target"
              position={pos}
              style={style}
              isConnectableStart={!isReadOnly}
              isConnectableEnd={!isReadOnly}
              aria-label={`Entrada ${side} ${idx}`}
            />
            <Handle
              id={`out-${side}-${idx}`}
              type="source"
              position={pos}
              style={style}
              isConnectableStart={!isReadOnly}
              isConnectableEnd={!isReadOnly}
              aria-label={`Salida ${side} ${idx}`}
            />
          </React.Fragment>
        );
      }),
    [dotBase, pctLeft, pctTop, isReadOnly]
  );

  return (
    <>
      <div title={titleText} style={boxStyle} role="group" aria-label="Nodo">
        <div
          style={{ fontWeight: "bold", padding: "2px 4px" }}
          title={
            isReadOnly
              ? "Solo lectura"
              : "Doble click para editar o arrastra la etiqueta flotante"
          }
        >
          {data?.label}
        </div>

        {/* TOP */}
        {renderHandles("top", slots.top)}

        {/* BOTTOM */}
        {renderHandles("bottom", slots.bottom)}

        {/* LEFT */}
        {renderHandles("left", slots.left)}

        {/* RIGHT */}
        {renderHandles("right", slots.right)}
      </div>

      {/* {(defaultLabelPosition || hasStoredLabelPosition) && (
        <EditableEdgeLabel
          text={data?.label || ""}
          position={hasStoredLabelPosition ? data.labelPosition : undefined}
          defaultPosition={effectiveLabelDefault}
          readOnly={!!isReadOnly}
          ariaLabel="Etiqueta del nodo"
          placeholder="Etiqueta del nodo"
          onCommit={handleLabelCommit}
          onPositionChange={handleLabelPositionChange}
          style={{ fontSize: 14, fontWeight: 600, zIndex: 10 }}
          className="channel-node-label"
        />
      )} */}
    </>
  );
}

CustomNode.propTypes = {
  id: PropTypes.string.isRequired,
  data: PropTypes.shape({
    label: PropTypes.string,
    tooltip: PropTypes.string,
    description: PropTypes.string,
    labelPosition: PropTypes.shape({
      x: PropTypes.number,
      y: PropTypes.number,
    }),
    slots: PropTypes.shape({
      top: PropTypes.arrayOf(PropTypes.number),
      bottom: PropTypes.arrayOf(PropTypes.number),
      left: PropTypes.arrayOf(PropTypes.number),
      right: PropTypes.arrayOf(PropTypes.number),
    }),
  }),
};

export default React.memo(
  CustomNode,
  (prev, next) => {
    const a = prev;
    const b = next;
    return (
      a.id === b.id &&
      a.data?.label === b.data?.label &&
      a.data?.tooltip === b.data?.tooltip &&
      a.data?.description === b.data?.description &&
      a.data?.labelPosition?.x === b.data?.labelPosition?.x &&
      a.data?.labelPosition?.y === b.data?.labelPosition?.y &&
      JSON.stringify(a.data?.slots ?? {}) === JSON.stringify(b.data?.slots ?? {})
    );
  }
);
