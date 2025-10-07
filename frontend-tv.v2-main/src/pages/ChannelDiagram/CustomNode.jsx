import React, { useCallback, useContext, useRef, useState } from "react";
import { Handle, Position, useReactFlow } from "@xyflow/react";
import { UserContext } from "../../components/context/UserContext";

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
  const rf = useReactFlow();
  const { isAuth } = useContext(UserContext);

  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(() => data?.label ?? "");
  const inputRef = useRef(null);

  const startEdit = useCallback(
    (e) => {
      if (!isAuth) return; // solo usuarios logueados
      e.stopPropagation();
      setValue(String(data?.label ?? ""));
      setEditing(true);
    },
    [data?.label, isAuth]
  );

  const commit = useCallback(() => {
    if (!isAuth) return;
    setEditing(false);
    rf.setNodes((nds) =>
      nds.map((n) =>
        n.id === id ? { ...n, data: { ...(n.data || {}), label: value } } : n
      )
    );
    // avisar para guardar
    window.dispatchEvent(new Event("flow:save"));
  }, [id, value, rf, isAuth]);

  const onKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter") commit();
      if (e.key === "Escape") {
        setEditing(false);
        setValue(String(data?.label ?? ""));
      }
    },
    [commit, data?.label]
  );

  const onInputRef = useCallback((el) => {
    if (el) {
      el.focus();
      el.select();
    }
    inputRef.current = el;
  }, []);

  const leftSlots = [30, 70];
  const rightSlots = [30, 70];
  const topSlots = [20, 50, 80];
  const bottomSlots = [20, 50, 80];

  return (
    <div title={data?.tooltip || data?.description || data?.label} style={box}>
      {/* Header / Título editable */}
      {!editing ? (
        <div
          style={{
            fontWeight: "bold",
            cursor: isAuth ? "text" : "default",
            padding: "2px 4px",
          }}
          title={isAuth ? "Doble click para editar" : "Solo lectura"}
          onDoubleClick={startEdit}
        >
          {data?.label}
        </div>
      ) : (
        <input
          ref={onInputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={commit}
          onKeyDown={onKeyDown}
          style={{
            width: "100%",
            fontWeight: 700,
            fontSize: 14,
            padding: "2px 4px",
            border: "1px solid #bbb",
            borderRadius: 6,
            outline: "none",
          }}
        />
      )}

      {/* TOP */}
      {topSlots.map((p, i) => (
        <React.Fragment key={`top-${i}`}>
          <Handle id={`in-top-${i + 1}`} type="target" position={Position.Top} style={{ ...dot, ...pctLeft(p) }} />
          <Handle id={`out-top-${i + 1}`} type="source" position={Position.Top} style={{ ...dot, ...pctLeft(p) }} />
        </React.Fragment>
      ))}

      {/* BOTTOM */}
      {bottomSlots.map((p, i) => (
        <React.Fragment key={`bottom-${i}`}>
          <Handle id={`in-bottom-${i + 1}`} type="target" position={Position.Bottom} style={{ ...dot, ...pctLeft(p) }} />
          <Handle id={`out-bottom-${i + 1}`} type="source" position={Position.Bottom} style={{ ...dot, ...pctLeft(p) }} />
        </React.Fragment>
      ))}

      {/* LEFT */}
      {leftSlots.map((p, i) => (
        <React.Fragment key={`left-${i}`}>
          <Handle id={`in-left-${i + 1}`} type="target" position={Position.Left} style={{ ...dot, ...pctTop(p) }} />
          <Handle id={`out-left-${i + 1}`} type="source" position={Position.Left} style={{ ...dot, ...pctTop(p) }} />
        </React.Fragment>
      ))}

      {/* RIGHT */}
      {rightSlots.map((p, i) => (
        <React.Fragment key={`right-${i}`}>
          <Handle id={`in-right-${i + 1}`} type="target" position={Position.Right} style={{ ...dot, ...pctTop(p) }} />
          <Handle id={`out-right-${i + 1}`} type="source" position={Position.Right} style={{ ...dot, ...pctTop(p) }} />
        </React.Fragment>
      ))}
    </div>
  );
}
