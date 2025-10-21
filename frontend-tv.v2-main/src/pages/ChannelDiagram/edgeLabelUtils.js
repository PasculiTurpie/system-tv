const SOURCE_FALLBACK_OFFSET = Object.freeze({ x: -20, y: -24 });
const TARGET_FALLBACK_OFFSET = Object.freeze({ x: 20, y: -24 });

const ORIENTED_OFFSETS = Object.freeze({
  left: { x: -28, y: -8 },
  right: { x: 28, y: -8 },
  top: { x: 0, y: -28 },
  bottom: { x: 0, y: 20 },
});

export const resolveEndpointOffset = (position, kind) => {
  const normalized = typeof position === "string" ? position.toLowerCase() : "";
  const oriented = ORIENTED_OFFSETS[normalized];
  if (oriented) return oriented;
  return kind === "target" ? TARGET_FALLBACK_OFFSET : SOURCE_FALLBACK_OFFSET;
};

export const computeEndpointLabelDefaults = ({
  sourceX,
  sourceY,
  sourcePosition,
  targetX,
  targetY,
  targetPosition,
  offset,
}) => {
  const sourceOffset = resolveEndpointOffset(sourcePosition, "source");
  const targetOffset = resolveEndpointOffset(targetPosition, "target");
  const shiftX = Number(offset?.ox ?? offset?.x ?? 0);
  const shiftY = Number(offset?.oy ?? offset?.y ?? 0);

  return {
    source: {
      x: sourceX + shiftX + sourceOffset.x,
      y: sourceY + shiftY + sourceOffset.y,
    },
    target: {
      x: targetX + shiftX + targetOffset.x,
      y: targetY + shiftY + targetOffset.y,
    },
  };
};

export default computeEndpointLabelDefaults;
