import React, { useCallback, useContext, useMemo, useRef, useState } from "react";
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, useReactFlow } from "@xyflow/react";
import { UserContext } from "../../components/context/UserContext";

/** Para waypoint usamos el mismo label editable/arrastrable */
function EditableDraggableLabel({ id, x, y, text }) {
  const rf = useReactFlow();
  const { isAuth } = useContext(UserContext);

  const dragRef = useRef({ dragging: false, startOffset: { x: 0, y: 0 } });
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(text ?? "");

  const startEdit = useCallback((e) => {
    if (!isAuth) return;
    e.stopPropagation();
    e.preventDefault();
    setValue(String(text ?? ""));
    setEditing(true);
  }, [text, isAuth]);

  const commit = useCallback(() => {
    if (!isAuth) return;
    setEditing(false);
    rf.setEdges((eds) =>
      eds.map((e) => (e.id === id ? { ...e, data: { ...(e.data || {}), label: value } } : e))
    );
    window.dispatchEvent(new Event("flow:save"));
  }, [id, value, rf, isAuth]);

  const onKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter") commit();
      if (e.key === "Escape") setEditing(false);
    },
    [commit]
  );

  const onPointerDown = useCallback(
    (e) => {
      if (!isAuth || editing) return;
      e.stopPropagation();
      e.preventDefault();

      const startClient = {
        x: "touches" in e ? e.touches[0].clientX : e.clientX,
        y: "touches" in e ? e.touches[0].clientY : e.clientY,
      };
      const startPane = rf.project(startClient);

      dragRef.current.dragging = true;
      dragRef.current.startOffset = {
        x: x - startPane.x,
        y: y - startPane.y,
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
        rf.setEdges((eds) =>
          eds.map((edge) =>
            edge.id === id ? { ...edge, data: { ...(edge.data || {}), labelPos: next } } : edge
          )
        );
      };

      const onUp = () => {
        dragRef.current.dragging = false;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        window.removeEventListener("touchmove", onMove);
        window.removeEventListener("touchend", onUp);
        window.dispatchEvent(new Event("flow:save"));
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
      window.addEventListener("touchmove", onMove, { passive: false });
      window.addEventListener("touchend", onUp);
    },
    [editing, x, y, rf, id, isAuth]
  );

  return (
    <EdgeLabelRenderer>
      {!editing ? (
        <div
          onMouseDown={onPointerDown}
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
            cursor: isAuth ? "grab" : "default",
            userSelect: "none",
            whiteSpace: "nowrap",
          }}
          className="nodrag nopan"
          title={isAuth ? "Doble click para editar. Arrastra para mover." : "Solo lectura"}
        >
          {text}
        </div>
      ) : (
        <input
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

export default function CustomWaypointEdge(props) {
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

  // Si hay waypoints en data, podrías construir un path poligonal.
  // Para simplificar, usamos smooth step (igual que directional).
  const [edgePath, defaultLabelX, defaultLabelY] = useMemo(() => {
    const [d, lx, ly] = getSmoothStepPath({
      sourceX,
      sourceY,
      targetX,
      targetY,
      sourcePosition,
      targetPosition,
      borderRadius: 0,
    });
    return [d, lx, ly];
  }, [sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition]);

  const labelPos = useMemo(() => {
    const lp = data?.labelPos;
    return {
      x: Number.isFinite(lp?.x) ? lp.x : defaultLabelX,
      y: Number.isFinite(lp?.y) ? lp.y : defaultLabelY,
    };
  }, [data?.labelPos, defaultLabelX, defaultLabelY]);

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={style} markerEnd={markerEnd} />
      <EditableDraggableLabel id={id} x={labelPos.x} y={labelPos.y} text={label || data?.label} />
    </>
  );
}
