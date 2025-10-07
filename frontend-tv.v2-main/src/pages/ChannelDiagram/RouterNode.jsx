// src/pages/ChannelDiagram/RouterNode.jsx
import React, { useCallback, useContext, useRef, useState } from "react";
import { Handle, Position, useReactFlow } from "@xyflow/react";
import { UserContext } from "../../components/context/UserContext";

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

const vSlots = [6, 17, 28, 39, 50, 61, 72, 83, 94]; // 9 puertos verticales

export default function RouterNode({ id, data }) {
  const rf = useReactFlow();
  const { isAuth } = useContext(UserContext);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(() => data?.label ?? "Router");
  const inputRef = useRef(null);

  const startEdit = useCallback((e) => {
    if (!isAuth) return;
    e.stopPropagation();
    setValue(String(data?.label ?? "Router"));
    setEditing(true);
  }, [data?.label, isAuth]);

  const commit = useCallback(() => {
    if (!isAuth) return;
    setEditing(false);
    rf.setNodes((nds) =>
      nds.map((n) =>
        n.id === id ? { ...n, data: { ...(n.data || {}), label: value } } : n
      )
    );
    // que el autosave arriba escuche
    window.dispatchEvent(new Event("flow:save"));
  }, [id, value, rf, isAuth]);

  const onKeyDown = useCallback((e) => {
    if (e.key === "Enter") commit();
    if (e.key === "Escape") {
      setEditing(false);
      setValue(String(data?.label ?? "Router"));
    }
  }, [commit, data?.label]);

  return (
    <div style={styles.box} title={data?.tooltip || data?.label || "Router"}>
      {!editing ? (
        <div
          style={{ ...styles.title, cursor: isAuth ? "text" : "default" }}
          onDoubleClick={startEdit}
          title={isAuth ? "Doble click para editar" : "Solo lectura"}
        >
          {data?.label ?? "Router"}
        </div>
      ) : (
        <input
          ref={(el) => { if (el) { el.focus(); el.select(); } inputRef.current = el; }}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={commit}
          onKeyDown={onKeyDown}
          style={styles.input}
        />
      )}

      {/* 9 IN a la izquierda */}
      {vSlots.map((p, i) => (
        <Handle
          key={`in-left-${i + 1}`}
          id={`in-left-${i + 1}`}
          type="target"
          position={Position.Left}
          style={{ ...styles.dot, top: `${p}%` }}
        />
      ))}

      {/* 9 OUT a la derecha */}
      {vSlots.map((p, i) => (
        <Handle
          key={`out-right-${i + 1}`}
          id={`out-right-${i + 1}`}
          type="source"
          position={Position.Right}
          style={{ ...styles.dot, top: `${p}%` }}
        />
      ))}
    </div>
  );
}
