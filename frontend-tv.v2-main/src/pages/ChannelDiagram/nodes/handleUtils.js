import normalizeHandle from "../../../utils/normalizeHandle.js";

const SIDES = ["top", "right", "bottom", "left"];

const pickFromArray = (handles = [], targetType, targetSide) => {
  if (!Array.isArray(handles)) return null;
  const normalizedSide = targetSide ? targetSide.toLowerCase() : null;
  for (const handle of handles) {
    if (!handle || typeof handle !== "object") continue;
    const handleType = handle.type === "target" ? "target" : handle.type === "source" ? "source" : null;
    if (handleType !== targetType) continue;
    if (normalizedSide) {
      if (typeof handle.side === "string" && handle.side.toLowerCase() === normalizedSide) {
        if (handle.id) {
          const normalizedId = normalizeHandle(handle.id);
          return normalizedId || handle.id;
        }
      }
    } else if (handle.id) {
      const normalizedId = normalizeHandle(handle.id);
      return normalizedId || handle.id;
    }
  }
  return null;
};

const pickFromObject = (entries = {}, targetSide) => {
  if (targetSide && entries[targetSide]) {
    const list = entries[targetSide];
    if (Array.isArray(list)) {
      const match = list.find((value) => typeof value === "string");
      if (match) {
        const normalizedId = normalizeHandle(match);
        return normalizedId || match;
      }
    }
  }
  for (const side of SIDES) {
    const list = entries[side];
    if (!Array.isArray(list) || !list.length) continue;
    const match = list.find((value) => typeof value === "string");
    if (match) {
      const normalizedId = normalizeHandle(match);
      return normalizedId || match;
    }
  }
  return null;
};

export const resolveHandleId = (data, type, side, fallback) => {
  const normalizedType = type === "target" ? "target" : "source";
  const normalizedSide = typeof side === "string" ? side.toLowerCase() : null;

  const fromArray = pickFromArray(data?.handles, normalizedType, normalizedSide);
  if (fromArray) return fromArray;

  const handlesMap = !Array.isArray(data?.handles) && data?.handles ? data.handles : data?.nodeHandles || {};
  const typeHandles = handlesMap?.[normalizedType];
  if (typeHandles) {
    const match = pickFromObject(typeHandles, normalizedSide);
    if (match) return match;
  }

  const normalizedFallback = normalizeHandle(fallback);
  return normalizedFallback || fallback;
};
