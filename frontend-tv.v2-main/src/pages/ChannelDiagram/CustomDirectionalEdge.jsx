// src/pages/ChannelDiagram/CustomDirectionalEdge.jsx
import React, { useCallback, useContext, useMemo, useRef, useState } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  useReactFlow,
} from "@xyflow/react";
import { UserContext } from "../../components/context/UserContext";

/** Offset para separar visualmente ida/vuelta */
const PARALLEL_OFFSET = 10;

function offsetPathStep({
  sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, isReverse
}) {
  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const vertical = Math.abs(dy) >= Math.abs(dx);

  const sign = isReverse ? 1 : -1;
  const ox = vertical ? sign * PARALLEL_OFFSET : 0;
  const oy = vertical ? 0 : sign * PARALLEL_OFFSET;

  const [d, lx, ly] = getSmoothStepPath({
    sourceX: sourceX + ox,
    sourceY: sourceY + oy,
    targetX: targetX + ox,
    targetY: targetY + oy,
    sourcePosition,
    targetPosition,
    borderRadius: 0,
  });

  return [d, lx + ox, ly + oy, { ox, oy }];
}

/** Label editable + draggable (centro) */
function EditableDraggableLabel({ id, x, y, text, onDragStart, onDragMove, onDragEnd, canEdit }) {
  const rf = useReactFlow();
  const dragRef = useRef({ dragging: false, startOffset: { x: 0, y: 0 } });
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(text ?? "");
  const inputRef = useRef(null);

  const startEdit = useCallback((e) => {
    if (!canEdit) return;
    e.stopPropagation();
    e.preventDefault();
    setValue(String(text ?? ""));
    setEditing(true);
  }, [text, canEdit]);

  const commit = useCallback(() => {
    if (!canEdit) return;
    setEditing(false);
    rf.setEdges((eds) =>
      eds.map((e) =>
        e.id === id ? { ...e, data: { ...(e.data || {}), label: value } } : e
      )
    );
    window.dispatchEvent(new Event("flow:save")); // autosave arriba
  }, [id, value, rf, canEdit]);

  const onKeyDown = useCallback((e) => {
    if (e.key === "Enter") commit();
    if (e.key === "Escape") {
      setEditing(false);
      setValue(String(text ?? ""));
    }
  }, [commit, text]);

  const onPointerDown = useCallback(
    (e) => {
      if (editing || !canEdit) return;
      e.stopPropagation();
      e.preventDefault();

      const startClient = {
        x: "touches" in e ? e.touches[0].clientX : e.clientX,
        y: "touches" in e ? e.touches[0].clientY : e.clientY,
      };
      const startPane = rf.project(startClient);

      dragRef.current.dragging = true;
      dragRef.current.startOffset = {
        x: (x ?? startPane.x) - startPane.x,
        y: (y ?? startPane.y) - startPane.y,
      };

      const onMove = (ev) => {
        if (!dragRef.current.dragging) return;
        const currClient = {
          x: "touches" in ev ? ev.touches[0].clientX : ev.clientX,
          y: "touches" in ev ? ev.touches[0].clientY : ev.clientY,
        };
        const currPane = rf.project(currClient);
        const next = {
          x: currPane.x + dragRef.current.startOffset.x,
          y: currPane.y + dragRef.current.startOffset.y,
        };
        onDragMove?.(next);
      };

      const onUp = () => {
        dragRef.current.dragging = false;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        window.removeEventListener("touchmove", onMove);
        window.removeEventListener("touchend", onUp);
        onDragEnd?.();
        window.dispatchEvent(new Event("flow:save"));
      };

      onDragStart?.();
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
      window.addEventListener("touchmove", onMove, { passive: false });
      window.addEventListener("touchend", onUp);
    },
    [editing, canEdit, x, y, rf, onDragStart, onDragMove, onDragEnd]
  );

  return (
    <EdgeLabelRenderer>
      {!editing ? (
        <div
          onMouseDown={onPointerDown}
          onTouchStart={onPointerDown}
          onDoubleClick={startEdit}
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${x}px, ${y}px)`,
            pointerEvents: "all",
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 6,
            padding: "4px 8px",
            fontSize: 12,
            boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
            cursor: canEdit ? "grab" : "default",
            userSelect: "none",
            whiteSpace: "nowrap",
          }}
          className="nodrag nopan"
          title={canEdit ? "Doble click para editar. Arrastra para mover." : "Solo lectura"}
        >
          {text}
        </div>
      ) : (
        <input
          ref={(el) => {
            if (el) { el.focus(); el.select(); }
            inputRef.current = el;
          }}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={commit}
          onKeyDown={onKeyDown}
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${x}px, ${y}px)`,
            pointerEvents: "all",
            background: "#fff",
            border: "1px solid #bbb",
            borderRadius: 6,
            padding: "2px 6px",
            fontSize: 12,
            boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
            outline: "none",
          }}
          className="nodrag nopan"
        />
      )}
    </EdgeLabelRenderer>
  );
}

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

  const rf = useReactFlow();
  const { isAuth } = useContext(UserContext);
  const isReverse = !!data?.__reversed;

  // Path + punto central
  const [edgePath, defaultLabelX, defaultLabelY, shift] = useMemo(() => {
    return offsetPathStep({
      sourceX,
      sourceY,
      targetX,
      targetY,
      sourcePosition,
      targetPosition,
      isReverse,
    });
  }, [sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, isReverse]);

  // Posición central
  const labelPos = useMemo(() => {
    const lp = data?.labelPos;
    return {
      x: Number.isFinite(lp?.x) ? lp.x : defaultLabelX,
      y: Number.isFinite(lp?.y) ? lp.y : defaultLabelY,
    };
  }, [data?.labelPos, defaultLabelX, defaultLabelY]);

  // Arrastre del label central (para guardar en store)
  const onDragStart = useCallback(() => { }, []);
  const onDragMove = useCallback((next) => {
    if (!isAuth) return;
    rf.setEdges((eds) =>
      eds.map((e) =>
        e.id === id ? { ...e, data: { ...(e.data || {}), labelPos: next } } : e
      )
    );
  }, [rf, id, isAuth]);
  const onDragEnd = useCallback(() => { }, []);

  // Posición del badge multicast cerca del ORIGEN del enlace
  const multicast = data?.multicast;
  const multicastPos = useMemo(() => {
    if (!multicast) return null;
    // Offset pequeño desde el source para que no se superponga con el nodo
    const BASE_OFFSET = 14;
    return {
      x: sourceX + (shift?.ox || 0) + BASE_OFFSET,
      y: sourceY + (shift?.oy || 0) - BASE_OFFSET,
    };
  }, [multicast, sourceX, sourceY, shift?.ox, shift?.oy]);

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={style} markerEnd={markerEnd} />

      {/* Label central editable */}
      <EditableDraggableLabel
        id={id}
        x={labelPos.x}
        y={labelPos.y}
        text={label || data?.label}
        onDragStart={onDragStart}
        onDragMove={onDragMove}
        onDragEnd={onDragEnd}
        canEdit={isAuth}
      />

      {/* Badge multicast (solo si existe) */}
      {multicast && multicastPos && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${multicastPos.x}px, ${multicastPos.y}px)`,
              pointerEvents: "none",
              background: "#1f2937",
              color: "#fff",
              border: "1px solid #111827",
              borderRadius: 6,
              padding: "2px 6px",
              fontSize: 11,
              boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
              whiteSpace: "nowrap",
              opacity: 0.9,
            }}
          >
            {multicast}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
