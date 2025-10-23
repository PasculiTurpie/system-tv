// src/pages/ChannelDiagram/RouterNode.jsx
import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Handle, Position, useStore } from "@xyflow/react";
import { shallow } from "zustand/shallow";
import { DiagramContext } from "./DiagramContext";
import NodeLabelDraggable from "./NodeLabelDraggable";
import NodeMulticastDraggable from "./NodeMulticastDraggable";
import { ROUTER_HANDLE_PRESETS } from "./handleConstants.js";

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
    userSelect: "none",
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

const ROUTER_PRESET_MAP = new Map(
  ROUTER_HANDLE_PRESETS.map((handle) => [handle.id, handle])
);

const ROUTER_SIDE_DEFAULTS = Object.freeze({
  left: { topPct: 50, leftPct: 0 },
  right: { topPct: 50, leftPct: 100 },
  top: { topPct: 0, leftPct: 50 },
  bottom: { topPct: 100, leftPct: 50 },
});

const clampHandlePercentage = (value, fallback) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  if (num < 0) return 0;
  if (num > 100) return 100;
  return Number(num.toFixed(3));
};

const normalizeRouterHandle = (handle) => {
  if (!handle || typeof handle !== "object") return null;
  const rawId = handle.id ?? handle.handleId;
  if (rawId === undefined || rawId === null) return null;
  const id = String(rawId).trim();
  if (!id) return null;
  const preset = ROUTER_PRESET_MAP.get(id);
  const type = preset?.type || (handle.type === "target" ? "target" : handle.type === "source" ? "source" : null);
  const side = preset?.side || (typeof handle.side === "string" ? handle.side.toLowerCase() : null);
  if (!type || !side || !ROUTER_SIDE_DEFAULTS[side]) return null;
  const defaults = ROUTER_SIDE_DEFAULTS[side];
  const topPct = clampHandlePercentage(handle.topPct, preset?.topPct ?? defaults.topPct);
  const leftPct = clampHandlePercentage(handle.leftPct, preset?.leftPct ?? defaults.leftPct);
  return {
    id,
    type,
    side,
    topPct,
    leftPct,
  };
};

const handlesEqual = (a = [], b = []) => {
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  for (let index = 0; index < a.length; index += 1) {
    const left = a[index];
    const right = b[index];
    if (!left || !right) return false;
    if (left.id !== right.id || left.type !== right.type || left.side !== right.side) return false;
    if (Math.abs(left.topPct - right.topPct) > 0.001) return false;
    if (Math.abs(left.leftPct - right.leftPct) > 0.001) return false;
  }
  return true;
};

const ensureRouterHandles = (handles) => {
  const normalized = new Map();
  const extras = [];
  if (Array.isArray(handles)) {
    handles.forEach((entry) => {
      const normalizedEntry = normalizeRouterHandle(entry);
      if (!normalizedEntry) return;
      if (ROUTER_PRESET_MAP.has(normalizedEntry.id)) {
        const preset = ROUTER_PRESET_MAP.get(normalizedEntry.id);
        normalized.set(normalizedEntry.id, {
          ...preset,
          topPct: normalizedEntry.topPct,
          leftPct: normalizedEntry.leftPct,
        });
      } else {
        extras.push(normalizedEntry);
      }
    });
  }
  const ordered = ROUTER_HANDLE_PRESETS.map((preset) => normalized.get(preset.id) || { ...preset });
  return [...ordered, ...extras];
};

export default function RouterNode({ id, data }) {
  const { isReadOnly, onNodeLabelChange, onNodeHandlesChange } = useContext(DiagramContext);
  const canEdit = !isReadOnly;
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(() => data?.label ?? "Router");
  const inputRef = useRef(null);
  const containerRef = useRef(null);
  const handlesRef = useRef(ensureRouterHandles(data?.handles));
  const draggingRef = useRef(null);

  const normalizedHandles = useMemo(
    () => ensureRouterHandles(data?.handles),
    [data?.handles]
  );
  const [handles, setHandles] = useState(normalizedHandles);

  useEffect(() => {
    setHandles((current) => (handlesEqual(current, normalizedHandles) ? current : normalizedHandles));
    handlesRef.current = normalizedHandles;
  }, [normalizedHandles]);

  useEffect(() => {
    handlesRef.current = handles;
  }, [handles]);

  const { xAbs, yAbs, width, ready } = useStore(
    useCallback((state) => {
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
    }, [id]),
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
    if (hasStoredLabelPosition) return data?.labelPosition;
    if (defaultLabelPosition) return defaultLabelPosition;
    return null;
  }, [hasStoredLabelPosition, data?.labelPosition, defaultLabelPosition]);

  const multicastDefaultPosition = useMemo(() => {
    if (!ready || !Number.isFinite(xAbs) || !Number.isFinite(yAbs)) return null;
    const offsetX = Number.isFinite(width) ? width : 0;
    return {
      x: xAbs + offsetX + 28,
      y: yAbs + 18,
    };
  }, [ready, xAbs, yAbs, width]);

  const backgroundSource = data?.backgroundImage || data?.icon || null;

  const boxStyle = useMemo(() => {
    const base = {
      ...styles.box,
      cursor: isReadOnly ? "default" : "grab",
    };
    if (!backgroundSource) return base;
    return {
      ...base,
      backgroundImage: `linear-gradient(rgba(255, 255, 255, 0.82), rgba(255, 255, 255, 0.82)), url(${backgroundSource})`,
      backgroundSize: "cover",
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat",
    };
  }, [backgroundSource, isReadOnly]);

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

  const sideToPosition = useMemo(
    () => ({
      left: Position.Left,
      right: Position.Right,
      top: Position.Top,
      bottom: Position.Bottom,
    }),
    []
  );

  const getHandleGripStyle = useCallback((handle) => {
    const base = {
      position: "absolute",
      width: 16,
      height: 16,
      borderRadius: "50%",
      background: "rgba(59,130,246,0.12)",
      border: "1px solid rgba(59,130,246,0.35)",
      transform: "translate(-50%, -50%)",
      cursor:
        handle.side === "left" || handle.side === "right" ? "ns-resize" : "ew-resize",
      zIndex: 10,
    };

    if (handle.side === "left") {
      return { ...base, top: `${handle.topPct}%`, left: 0, transform: "translate(-30%, -50%)" };
    }
    if (handle.side === "right") {
      return { ...base, top: `${handle.topPct}%`, left: "100%", transform: "translate(-70%, -50%)" };
    }
    if (handle.side === "top") {
      return { ...base, top: 0, left: `${handle.leftPct}%`, transform: "translate(-50%, -30%)" };
    }
    return {
      ...base,
      top: "100%",
      left: `${handle.leftPct}%`,
      transform: "translate(-50%, -70%)",
    };
  }, []);

  const updateHandleFromPointer = useCallback(
    (event) => {
      const dragState = draggingRef.current;
      if (!dragState) return;
      const bounds = containerRef.current?.getBoundingClientRect();
      if (!bounds || bounds.width <= 0 || bounds.height <= 0) return;

      const nextX = ((event.clientX - bounds.left) / bounds.width) * 100;
      const nextY = ((event.clientY - bounds.top) / bounds.height) * 100;

      setHandles((current) => {
        const next = current.map((handle) => {
          if (handle.id !== dragState.id) return handle;
          if (dragState.side === "left" || dragState.side === "right") {
            return {
              ...handle,
              topPct: clampHandlePercentage(nextY, handle.topPct),
            };
          }
          if (dragState.side === "top" || dragState.side === "bottom") {
            return {
              ...handle,
              leftPct: clampHandlePercentage(nextX, handle.leftPct),
            };
          }
          return handle;
        });
        handlesRef.current = next;
        return next;
      });
    },
    [setHandles]
  );

  const finishHandleDrag = useCallback(
    (event) => {
      const dragState = draggingRef.current;
      if (!dragState) return;

      if (event) {
        updateHandleFromPointer(event);
      }

      if (dragState.moveListener) {
        window.removeEventListener("pointermove", dragState.moveListener);
      }
      if (dragState.upListener) {
        window.removeEventListener("pointerup", dragState.upListener);
      }
      if (
        dragState.captureTarget &&
        dragState.pointerId !== undefined &&
        typeof dragState.captureTarget.releasePointerCapture === "function"
      ) {
        try {
          dragState.captureTarget.releasePointerCapture(dragState.pointerId);
        } catch {
          /* ignore */
        }
      }

      draggingRef.current = null;

      const sanitized = ensureRouterHandles(handlesRef.current);
      handlesRef.current = sanitized;
      setHandles((current) => (handlesEqual(current, sanitized) ? current : sanitized));

      const previous = ensureRouterHandles(dragState.startHandles || []);
      if (handlesEqual(sanitized, previous)) return;

      onNodeHandlesChange?.(id, sanitized.map((handle) => ({ ...handle })), {
        onError: () => {
          const fallback = ensureRouterHandles(previous);
          handlesRef.current = fallback;
          setHandles(fallback);
        },
      });
    },
    [id, onNodeHandlesChange, setHandles, updateHandleFromPointer]
  );

  const startHandleDrag = useCallback(
    (handle, event) => {
      if (!canEdit) return;
      event.stopPropagation();
      event.preventDefault();

      const startHandles = handlesRef.current.map((entry) => ({ ...entry }));
      const moveListener = (moveEvent) => updateHandleFromPointer(moveEvent);
      const upListener = (upEvent) => finishHandleDrag(upEvent);

      draggingRef.current = {
        id: handle.id,
        side: handle.side,
        pointerId: event.pointerId,
        moveListener,
        upListener,
        startHandles,
        captureTarget: event.currentTarget,
      };

      window.addEventListener("pointermove", moveListener);
      window.addEventListener("pointerup", upListener);

      if (event.pointerId !== undefined && event.currentTarget?.setPointerCapture) {
        try {
          event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
          /* ignore */
        }
      }

      updateHandleFromPointer(event);
    },
    [canEdit, finishHandleDrag, updateHandleFromPointer]
  );

  useEffect(() => () => {
    const dragState = draggingRef.current;
    if (!dragState) return;
    if (dragState.moveListener) {
      window.removeEventListener("pointermove", dragState.moveListener);
    }
    if (dragState.upListener) {
      window.removeEventListener("pointerup", dragState.upListener);
    }
    draggingRef.current = null;
  }, []);

  // ✅ expone los ids reales que renderiza este nodo
  if (data) {
    data.handleIds = handles.map((h) => h.id);
  }

  return (
    <>
      <div
        ref={containerRef}
        style={boxStyle}
        title={data?.tooltip || data?.label || "Router"}
      >
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

        {handles.map((handle) => {
          const position = sideToPosition[handle.side] || Position.Right;
          const style = {
            ...styles.dot,
            ...(handle.side === "left" || handle.side === "right"
              ? { top: `${handle.topPct}%` }
              : { left: `${handle.leftPct}%` }),
          };

          return (
            <React.Fragment key={handle.id}>
              <Handle
                id={handle.id}
                type={handle.type === "target" ? "target" : "source"}
                position={position}
                style={style}
              />
              {!isReadOnly && (
                <div
                  role="presentation"
                  className="router-node__handle-grip"
                  onPointerDown={(event) => startHandleDrag(handle, event)}
                  style={getHandleGripStyle(handle)}
                  title="Arrastra para mover este puerto"
                />
              )}
            </React.Fragment>
          );
        })}
      </div>

      <NodeLabelDraggable
        nodeId={id}
        text={data?.label ?? "Router"}
        position={data?.labelPosition}
        defaultPosition={effectiveLabelDefault}
        readOnly={!!isReadOnly}
      />

      <NodeMulticastDraggable
        nodeId={id}
        text={data?.multicast || ""}
        position={data?.multicastPosition}
        defaultPosition={multicastDefaultPosition}
        readOnly={!!isReadOnly}
      />
    </>
  );
}
