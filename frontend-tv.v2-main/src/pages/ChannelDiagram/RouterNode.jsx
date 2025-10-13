// src/pages/ChannelDiagram/RouterNode.jsx
import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Handle, Position } from "@xyflow/react";
import { DiagramContext } from "./DiagramContext";

const styles = {
  box: {
    padding: 10,
    border: "1px solid #1f2937",
    borderRadius: 12,
    background: "#ffffff",
    width: 200,
    position: "relative",
    textAlign: "center",
    boxShadow: "0 2px 8px rgba(0,0,0,.06)",
    overflow: "hidden",
  },
  title: { fontWeight: 800, color: "#1f2937", cursor: "text", padding: "2px 4px" },
  input: {
    width: "100%",
    fontWeight: 800,
    fontSize: 14,
    padding: "2px 4px",
    border: "1px solid #bbb",
    borderRadius: 8,
    outline: "none",
  },
  dot: { background: "transparent" },
};

const leftSlots = [30, 70];
const rightSlots = [30, 70];
const bottomSlots = [25, 50, 75];

export default function RouterNode({ id, data }) {
  const { isReadOnly, onNodeLabelChange } = useContext(DiagramContext);
  const canEdit = !isReadOnly;
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(() => data?.label ?? "Router");
  const inputRef = useRef(null);

  const backgroundSource = data?.backgroundImage || data?.icon || null;

  const boxStyle = useMemo(() => {
    const base = {
      ...styles.box,
    };

    if (!backgroundSource) {
      return base;
    }

    return {
      ...base,
      backgroundImage: `linear-gradient(rgba(255, 255, 255, 0.82), rgba(255, 255, 255, 0.82)), url(${backgroundSource})`,
      backgroundSize: "cover",
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat",
    };
  }, [backgroundSource]);

  useEffect(() => {
    setValue(data?.label ?? "Router");
  }, [data?.label]);

  const startEdit = useCallback((e) => {
    if (!canEdit) return;
    e.stopPropagation();
    setValue(String(data?.label ?? "Router"));
    setEditing(true);
  }, [data?.label, canEdit]);

  const commit = useCallback(() => {
    if (!canEdit) return;
    setEditing(false);
    onNodeLabelChange?.(id, value);
  }, [canEdit, id, onNodeLabelChange, value]);

  const onKeyDown = useCallback((e) => {
    if (e.key === "Enter") commit();
    if (e.key === "Escape") {
      setEditing(false);
      setValue(String(data?.label ?? "Router"));
    }
  }, [commit, data?.label]);

  return (
    <div style={boxStyle} title={data?.tooltip || data?.label || "Router"}>
      {!editing ? (
        <div
          style={{ ...styles.title, cursor: canEdit ? "text" : "default" }}
          onDoubleClick={startEdit}
          title={canEdit ? "Doble click para editar" : "Solo lectura"}
        >
          {data?.label ?? "Router"}
        </div>
      ) : (
        <input
          ref={(el) => {
            if (el) {
              el.focus();
              el.select();
            }
            inputRef.current = el;
          }}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={commit}
          onKeyDown={onKeyDown}
          style={styles.input}
          aria-label="Editar etiqueta del router"
        />
      )}

      {leftSlots.map((p, index) => (
        <Handle
          key={`in-left-${index + 1}`}
          id={`in-left-${index + 1}`}
          type="target"
          position={Position.Left}
          style={{ ...styles.dot, top: `${p}%` }}
        />
      ))}

      {rightSlots.map((p, index) => (
        <Handle
          key={`out-right-${index + 1}`}
          id={`out-right-${index + 1}`}
          type="source"
          position={Position.Right}
          style={{ ...styles.dot, top: `${p}%` }}
        />
      ))}

      {bottomSlots.map((p, index) => (
        <React.Fragment key={`bottom-${index}`}>
          <Handle
            id={`in-bottom-${index + 1}`}
            type="target"
            position={Position.Bottom}
            style={{ ...styles.dot, left: `${p}%` }}
          />
          <Handle
            id={`out-bottom-${index + 1}`}
            type="source"
            position={Position.Bottom}
            style={{ ...styles.dot, left: `${p}%` }}
          />
        </React.Fragment>
      ))}
    </div>
  );
}
