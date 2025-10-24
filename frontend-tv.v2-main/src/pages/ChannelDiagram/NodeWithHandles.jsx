import React, { useMemo } from "react";
import { Handle, Position } from "@xyflow/react";

import { getHandlesForNodeType, parseHandle } from "./handles";

const SIDE_TO_POSITION = {
  left: Position.Left,
  right: Position.Right,
  top: Position.Top,
  bottom: Position.Bottom,
};

const SIDE_ORDER = {
  top: 0,
  right: 1,
  bottom: 2,
  left: 3,
};

const DEFAULT_HANDLE_STYLE = {
  width: 10,
  height: 10,
  borderRadius: "50%",
  border: "2px solid #1e40af",
  background: "#fff",
};

const normalizeHandleEntry = (entry) => {
  if (!entry) return null;

  const rawId =
    typeof entry === "string"
      ? entry
      : entry.id || entry.handleId || entry.handle || entry.handleID;

  if (!rawId) return null;

  const parsed = parseHandle(String(rawId));
  if (!parsed) return null;

  const side =
    typeof entry.side === "string"
      ? entry.side.toLowerCase()
      : parsed.side;

  const kind =
    typeof entry.type === "string"
      ? entry.type.toLowerCase()
      : parsed.kind === "in"
      ? "target"
      : "source";

  const type = kind === "target" || kind === "in" ? "target" : "source";

  const topPct = Number(entry.topPct);
  const leftPct = Number(entry.leftPct);

  return {
    id: parsed.kind ? `${parsed.kind}-${parsed.side}-${parsed.index}` : rawId,
    side,
    type,
    topPct: Number.isFinite(topPct) ? topPct : undefined,
    leftPct: Number.isFinite(leftPct) ? leftPct : undefined,
  };
};

const buildFallbackHandles = (nodeType) => {
  const handles = getHandlesForNodeType(nodeType);
  const entries = [];

  const pushHandles = (ids = [], type) => {
    const grouped = new Map();
    ids.forEach((id) => {
      const parsed = parseHandle(id);
      if (!parsed) return;
      const side = parsed.side || "top";
      if (!grouped.has(side)) {
        grouped.set(side, []);
      }
      grouped.get(side).push({ id, parsed });
    });

    grouped.forEach((list, side) => {
      const sorted = list.sort((a, b) => a.parsed.index - b.parsed.index);
      const total = sorted.length;
      sorted.forEach(({ id: handleId }, index) => {
        const positionPct = Math.round(((index + 1) / (total + 1)) * 100);
        entries.push({
          id: handleId,
          type,
          side,
          topPct: side === "left" || side === "right" ? positionPct : undefined,
          leftPct: side === "top" || side === "bottom" ? positionPct : undefined,
        });
      });
    });
  };

  pushHandles(handles.in, "target");
  pushHandles(handles.out, "source");

  return entries;
};

const useHandleEntries = (data, nodeType) =>
  useMemo(() => {
    const seen = new Set();
    const list = [];

    const addHandle = (entry) => {
      const normalized = normalizeHandleEntry(entry);
      if (!normalized) return;

      const key = `${normalized.type}:${normalized.id}`;
      if (seen.has(key)) return;
      seen.add(key);
      list.push(normalized);
    };

    const dataHandles = Array.isArray(data?.handles)
      ? data.handles
      : Array.isArray(data?.handleIds)
      ? data.handleIds
      : [];

    dataHandles.forEach(addHandle);

    if (!list.length) {
      buildFallbackHandles(nodeType).forEach(addHandle);
    }

    const sortBySideAndIndex = (a, b) => {
      const sideDelta =
        (SIDE_ORDER[a.side] ?? 99) - (SIDE_ORDER[b.side] ?? 99);
      if (sideDelta !== 0) return sideDelta;
      const parsedA = parseHandle(a.id);
      const parsedB = parseHandle(b.id);
      return (parsedA?.index || 0) - (parsedB?.index || 0);
    };

    const targets = list
      .filter((handle) => handle.type === "target")
      .sort(sortBySideAndIndex);
    const sources = list
      .filter((handle) => handle.type === "source")
      .sort(sortBySideAndIndex);

    return { targets, sources };
  }, [data?.handleIds, data?.handles, nodeType]);

export default function NodeWithHandles({ id, data = {}, type }) {
  const handleEntries = useHandleEntries(data, type);

  const renderHandle = (handle) => {
    const position = SIDE_TO_POSITION[handle.side] || Position.Top;
    const style = { ...DEFAULT_HANDLE_STYLE };

    if (handle.type === "target") {
      style.borderColor = "#dc2626";
    }

    if (handle.side === "left" || handle.side === "right") {
      if (handle.topPct !== undefined) {
        style.top = `${handle.topPct}%`;
        style.transform = "translateY(-50%)";
      }
    } else if (handle.leftPct !== undefined) {
      style.left = `${handle.leftPct}%`;
      style.transform = "translateX(-50%)";
    }

    return (
      <Handle
        key={`${handle.type}-${handle.id}`}
        id={handle.id}
        type={handle.type}
        position={position}
        data-handle-id={handle.id}
        style={style}
      />
    );
  };

  return (
    <div
      className="node-with-handles"
      style={{
        minWidth: 160,
        minHeight: 60,
        borderRadius: 12,
        border: "1px solid #cbd5f5",
        background: "#fff",
        padding: "12px 16px",
        boxShadow: "0 2px 6px rgba(15, 23, 42, 0.08)",
        position: "relative",
        fontSize: 13,
        color: "#0f172a",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
      }}
    >
      {handleEntries.targets.map(renderHandle)}
      <div
        style={{
          pointerEvents: "none",
          fontWeight: 600,
          lineHeight: 1.4,
        }}
      >
        {data?.label || type || id}
      </div>
      {handleEntries.sources.map(renderHandle)}
    </div>
  );
}
