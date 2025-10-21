export const resolveHandleId = (data, type, side, fallback) => {
  const handles = data?.handles || data?.nodeHandles || {};
  const typeHandles = handles?.[type];
  const list = typeHandles?.[side];
  if (Array.isArray(list) && list.length) {
    const first = list.find((value) => typeof value === "string");
    if (first) return first;
  }
  return fallback;
};
