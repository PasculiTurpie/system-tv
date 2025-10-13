import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { EdgeLabelRenderer, useReactFlow } from "@xyflow/react";
import { DiagramContext } from "./DiagramContext";
import { resolveLabelPosition } from "./diagramUtils";

const baseBoxStyle = {
  position: "absolute",
  pointerEvents: "all",
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 6,
  padding: "4px 8px",
  fontSize: 12,
  boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
  userSelect: "none",
  whiteSpace: "nowrap",
};

const editingStyle = {
  border: "1px solid #94a3b8",
  padding: "2px 6px",
  outline: "none",
  boxShadow: "0 0 0 2px rgba(148,163,184,0.35)",
  fontSize: 12,
  borderRadius: 6,
};

const draggingStyle = {
  boxShadow: "0 8px 18px rgba(15, 23, 42, 0.18)",
  cursor: "grabbing",
};

const ghostStyle = {
  color: "#64748b",
  fontStyle: "italic",
};

export default function EditableEdgeLabel({
  text,
  position,
  defaultPosition,
  readOnly,
  ariaLabel,
  placeholder = "",
  onCommit,
  onPositionChange,
  style: styleOverride,
  className,
  allowEditing = true,
  allowDragging = true,
}) {
  const rf = useReactFlow();
  const { clampPosition } = useContext(DiagramContext);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(text ?? "");
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef({ startOffset: { x: 0, y: 0 }, pointerStart: { x: 0, y: 0 } });
  const inputRef = useRef(null);

  const canEdit = allowEditing && !readOnly;
  const canDrag = allowDragging && !readOnly;

  const currentPosition = useMemo(
    () => resolveLabelPosition(position, defaultPosition, clampPosition),
    [position, defaultPosition, clampPosition]
  );

  useEffect(() => {
    setValue(text ?? "");
  }, [text]);

  useEffect(() => {
    if (!editing) return undefined;
    const el = inputRef.current;
    if (el) {
      el.focus();
      el.select();
    }
    return undefined;
  }, [editing]);

  const stopEditing = useCallback(() => {
    setEditing(false);
    setValue(text ?? "");
  }, [text]);

  const commit = useCallback(() => {
    if (!canEdit) return;
    setEditing(false);
    onCommit?.(value);
  }, [canEdit, onCommit, value]);

  const handleDoubleClick = useCallback(
    (event) => {
      if (!canEdit) return;
      event.stopPropagation();
      event.preventDefault();
      setEditing(true);
    },
    [canEdit]
  );

  const handleKeyDown = useCallback(
    (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        commit();
      } else if (event.key === "Escape") {
        event.preventDefault();
        stopEditing();
      }
    },
    [commit, stopEditing]
  );

  const projectClient = useCallback(
    (event) => {
      const pointer = "touches" in event ? event.touches[0] : event;
      const clientPoint = { x: pointer.clientX, y: pointer.clientY };
      return rf.project(clientPoint);
    },
    [rf]
  );

  const updatePosition = useCallback(
    (event) => {
      if (event?.cancelable) {
        event.preventDefault();
      }
      const projected = projectClient(event);
      const next = {
        x: projected.x + dragRef.current.startOffset.x,
        y: projected.y + dragRef.current.startOffset.y,
      };
      const clamped = clampPosition ? clampPosition(next) : next;
      onPositionChange?.(clamped);
    },
    [clampPosition, onPositionChange, projectClient]
  );

  const stopDragging = useCallback(() => {
    setDragging(false);
    window.removeEventListener("mousemove", updatePosition);
    window.removeEventListener("mouseup", stopDragging);
    window.removeEventListener("touchmove", updatePosition);
    window.removeEventListener("touchend", stopDragging);
  }, [updatePosition]);

  const startDragging = useCallback(
    (event) => {
      if (editing || !canDrag) return;
      event.preventDefault();
      event.stopPropagation();
      const projected = projectClient(event);
      dragRef.current.startOffset = {
        x: currentPosition.x - projected.x,
        y: currentPosition.y - projected.y,
      };
      setDragging(true);
      window.addEventListener("mousemove", updatePosition);
      window.addEventListener("mouseup", stopDragging);
      window.addEventListener("touchmove", updatePosition, { passive: false });
      window.addEventListener("touchend", stopDragging);
    },
    [
      canDrag,
      currentPosition.x,
      currentPosition.y,
      editing,
      projectClient,
      stopDragging,
      updatePosition,
    ]
  );

  useEffect(
    () => () => {
      window.removeEventListener("mousemove", updatePosition);
      window.removeEventListener("mouseup", stopDragging);
      window.removeEventListener("touchmove", updatePosition);
      window.removeEventListener("touchend", stopDragging);
    },
    [stopDragging, updatePosition]
  );

  const transform = `translate(-50%, -50%) translate(${currentPosition.x}px, ${currentPosition.y}px)`;

  const baseClassName = ["nodrag", "nopan", className].filter(Boolean).join(" ");

  return (
    <EdgeLabelRenderer>
      {!editing ? (
        <div
          role="button"
          tabIndex={canEdit || canDrag ? 0 : -1}
          onMouseDown={startDragging}
          onTouchStart={startDragging}
          onDoubleClick={handleDoubleClick}
          style={{
            ...baseBoxStyle,
            ...(styleOverride || {}),
            transform,
            cursor: canDrag ? (dragging ? "grabbing" : "grab") : "default",
            ...(dragging ? draggingStyle : {}),
            ...(text ? {} : ghostStyle),
          }}
          className={baseClassName}
          aria-label={ariaLabel}
          title={
            canEdit
              ? "Doble click para editar. Arrastra para mover."
              : canDrag
              ? "Arrastra para mover"
              : "Solo lectura"
          }
        >
          {text || placeholder}
        </div>
      ) : (
        <input
          ref={inputRef}
          aria-label={ariaLabel}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onBlur={commit}
          onKeyDown={handleKeyDown}
          style={{
            ...baseBoxStyle,
            ...editingStyle,
            ...(styleOverride || {}),
            transform,
            cursor: "text",
          }}
          className={baseClassName}
          placeholder={placeholder}
        />
      )}
    </EdgeLabelRenderer>
  );
}

