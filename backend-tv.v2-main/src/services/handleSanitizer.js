const HANDLE_SIDES = Object.freeze(["top", "right", "bottom", "left"]);
const HANDLE_TYPES = Object.freeze(["source", "target"]);

const HANDLE_DEFAULTS = Object.freeze({
  top: { topPct: 0, leftPct: 50 },
  right: { topPct: 50, leftPct: 100 },
  bottom: { topPct: 100, leftPct: 50 },
  left: { topPct: 50, leftPct: 0 },
});

const normalizeString = (value) => {
  if (value === undefined || value === null) return null;
  const str = String(value).trim();
  return str.length ? str : null;
};

const inferTypeFromHandleId = (handleId) => {
  const normalized = normalizeString(handleId);
  if (!normalized) return null;
  const lower = normalized.toLowerCase();
  if (lower.startsWith("in-")) return "target";
  if (lower.startsWith("out-")) return "source";
  return null;
};

const inferSideFromHandleId = (handleId) => {
  const normalized = normalizeString(handleId);
  if (!normalized) return null;
  const lower = normalized.toLowerCase();
  if (lower.includes("-left")) return "left";
  if (lower.includes("-right")) return "right";
  if (lower.includes("-top")) return "top";
  if (lower.includes("-bottom")) return "bottom";
  return null;
};

const clampPercentage = (value, fallback) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return Number(fallback ?? 0);
  if (num < 0) return 0;
  if (num > 100) return 100;
  return Number(num.toFixed(3));
};

const sanitizeHandleEntry = (entry = {}, fallback = {}) => {
  const id = normalizeString(entry.id ?? fallback.id);
  if (!id) return null;

  const candidateType =
    normalizeString(entry.type ?? fallback.type) || inferTypeFromHandleId(id);
  const type = candidateType ? candidateType.toLowerCase() : null;
  if (!type || !HANDLE_TYPES.includes(type)) return null;

  const candidateSide =
    normalizeString(entry.side ?? fallback.side) || inferSideFromHandleId(id);
  const side = candidateSide ? candidateSide.toLowerCase() : null;
  if (!side || !HANDLE_SIDES.includes(side)) return null;

  const defaults = HANDLE_DEFAULTS[side] || { topPct: 50, leftPct: 50 };
  const topPct = clampPercentage(entry.topPct, fallback.topPct ?? defaults.topPct);
  const leftPct = clampPercentage(entry.leftPct, fallback.leftPct ?? defaults.leftPct);

  return {
    id,
    type,
    side,
    topPct,
    leftPct,
  };
};

const iterateHandles = (handles, visitor) => {
  if (Array.isArray(handles)) {
    handles.forEach((entry) => visitor(entry));
    return;
  }

  if (handles && typeof handles === "object") {
    HANDLE_TYPES.forEach((type) => {
      const entries = handles?.[type];
      HANDLE_SIDES.forEach((side) => {
        const list = Array.isArray(entries?.[side]) ? entries[side] : [];
        list.forEach((value) => {
          if (typeof value === "string") {
            visitor({ id: value, type, side });
          } else if (value && typeof value === "object") {
            visitor({ ...value, type: value.type ?? type, side: value.side ?? side });
          }
        });
      });
    });
  }
};

const sanitizeHandles = (handles = [], fallback = []) => {
  const fallbackMap = new Map();
  (Array.isArray(fallback) ? fallback : []).forEach((item) => {
    const normalizedId = normalizeString(item?.id);
    if (normalizedId) {
      fallbackMap.set(normalizedId, item);
    }
  });

  const seen = new Set();
  const result = [];
  iterateHandles(handles, (entry) => {
    const normalized = sanitizeHandleEntry(
      entry,
      fallbackMap.get(normalizeString(entry?.id)) || {}
    );
    if (!normalized) return;
    const dedupeKey = `${normalized.id}|${normalized.type}`;
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    result.push(normalized);
  });

  return result.slice(0, 64);
};

const normalizeHandles = (handles = []) => sanitizeHandles(handles);

module.exports = {
  HANDLE_SIDES,
  HANDLE_TYPES,
  HANDLE_DEFAULTS,
  inferTypeFromHandleId,
  inferSideFromHandleId,
  clampPercentage,
  sanitizeHandleEntry,
  sanitizeHandles,
  normalizeHandles,
};
