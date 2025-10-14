import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import PropTypes from "prop-types";
import { EdgeLabelRenderer } from "@xyflow/react";
import useDraggableLabel from "../../hooks/useDraggableLabel";
import { DiagramContext } from "./DiagramContext";
import { resolveLabelPosition } from "./diagramUtils";

const baseStyle = {
  position: "absolute",
  pointerEvents: "all",
  padding: "4px 8px",
  background: "rgba(255, 255, 255, 0.95)",
  border: "1px solid #e2e8f0",
  borderRadius: 6,
  fontSize: 12,
  color: "#0f172a",
  boxShadow: "0 2px 6px rgba(15, 23, 42, 0.14)",
  userSelect: "none",
  whiteSpace: "nowrap",
  zIndex: 20,
  touchAction: "none",
};

const draggingStyle = {
  boxShadow: "0 10px 18px rgba(15, 23, 42, 0.25)",
};

const editingStyle = {
  border: "1px solid #94a3b8",
  padding: "4px 8px",
  outline: "none",
  boxShadow: "0 0 0 2px rgba(148, 163, 184, 0.35)",
};

const ghostStyle = {
  color: "#64748b",
  fontStyle: "italic",
};

export default function EdgeLabelDraggable({
  text,
  position,
  defaultPosition,
  readOnly,
  placeholder,
  ariaLabel,
  className,
  style,
  allowEditing,
  allowDragging,
  onTextCommit,
  onPositionChange,
  onPersist,
}) {
  const { clampPosition } = useContext(DiagramContext);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(text ?? "");
  const inputRef = useRef(null);

  useEffect(() => {
    setValue(text ?? "");
  }, [text]);

  useEffect(() => {
    if (!editing) return undefined;
    const el = inputRef.current;
    if (el) {
      requestAnimationFrame(() => {
        el.focus();
        el.select();
      });
    }
    return undefined;
  }, [editing]);

  const canEdit = !readOnly && allowEditing;
  const canDrag = !readOnly && allowDragging;

  const resolvedInitial = useMemo(
    () => resolveLabelPosition(position, defaultPosition, clampPosition),
    [position, defaultPosition, clampPosition]
  );

  const handlePersist = useCallback(
    (nextPosition, meta) => {
      if (!canDrag) return;
      onPersist?.(nextPosition, meta);
    },
    [canDrag, onPersist]
  );

  const { transform, isDragging, handlePointerDown } = useDraggableLabel({
    initial: resolvedInitial,
    disabled: !canDrag || editing,
    clamp: clampPosition,
    onChange: onPositionChange,
    onDragEnd: handlePersist,
  });

  const handleDoubleClick = useCallback(
    (event) => {
      if (!canEdit) return;
      event.preventDefault();
      event.stopPropagation();
      setEditing(true);
    },
    [canEdit]
  );

  const commit = useCallback(() => {
    if (!canEdit) return;
    setEditing(false);
    onTextCommit?.(value);
  }, [canEdit, onTextCommit, value]);

  const cancelEditing = useCallback(() => {
    setEditing(false);
    setValue(text ?? "");
  }, [text]);

  const handleKeyDown = useCallback(
    (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        commit();
      } else if (event.key === "Escape") {
        event.preventDefault();
        cancelEditing();
      }
    },
    [cancelEditing, commit]
  );

  const interactive = canEdit || canDrag;

  const handlePointerStart = useCallback(
    (event) => {
      if (!interactive) return;
      if (!canDrag) {
        event.stopPropagation();
        return;
      }
      handlePointerDown(event);
    },
    [canDrag, handlePointerDown, interactive]
  );

  const preventNativeDrag = useCallback((event) => {
    event.preventDefault();
  }, []);

  const baseClassName = ["nodrag", "nopan", className].filter(Boolean).join(" ");
  const displayText = value || placeholder || "";

  return (
    <EdgeLabelRenderer>
      {editing ? (
        <input
          ref={inputRef}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onBlur={commit}
          onKeyDown={handleKeyDown}
          aria-label={ariaLabel}
          style={{
            ...baseStyle,
            ...editingStyle,
            ...(style || {}),
            transform,
            cursor: "text",
          }}
          className={baseClassName}
        />
      ) : (
        <div
          role={interactive ? "button" : "presentation"}
          tabIndex={interactive ? 0 : -1}
          onMouseDown={handlePointerStart}
          onPointerDown={handlePointerStart}
          onTouchStart={handlePointerStart}
          onDoubleClick={handleDoubleClick}
          onDragStart={preventNativeDrag}
          aria-label={ariaLabel}
          style={{
            ...baseStyle,
            ...(style || {}),
            transform,
            cursor: canDrag ? (isDragging ? "grabbing" : "grab") : "default",
            ...(isDragging ? draggingStyle : {}),
            ...(value ? {} : ghostStyle),
          }}
          className={baseClassName}
          draggable={false}
          aria-disabled={interactive ? undefined : true}
        >
          {displayText}
        </div>
      )}
    </EdgeLabelRenderer>
  );
}

EdgeLabelDraggable.propTypes = {
  text: PropTypes.string,
  position: PropTypes.shape({
    x: PropTypes.number,
    y: PropTypes.number,
  }),
  defaultPosition: PropTypes.shape({
    x: PropTypes.number,
    y: PropTypes.number,
  }),
  readOnly: PropTypes.bool,
  placeholder: PropTypes.string,
  ariaLabel: PropTypes.string,
  className: PropTypes.string,
  style: PropTypes.object,
  allowEditing: PropTypes.bool,
  allowDragging: PropTypes.bool,
  onTextCommit: PropTypes.func,
  onPositionChange: PropTypes.func,
  onPersist: PropTypes.func,
};

EdgeLabelDraggable.defaultProps = {
  text: "",
  position: null,
  defaultPosition: null,
  readOnly: false,
  placeholder: "",
  ariaLabel: "Etiqueta",
  className: undefined,
  style: undefined,
  allowEditing: true,
  allowDragging: true,
  onTextCommit: undefined,
  onPositionChange: undefined,
  onPersist: undefined,
};
