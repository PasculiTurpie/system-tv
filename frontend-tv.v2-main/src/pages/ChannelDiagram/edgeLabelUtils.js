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
}) => {
  const sourceOffset = resolveEndpointOffset(sourcePosition, "source");
  const targetOffset = resolveEndpointOffset(targetPosition, "target");

  return {
    source: { x: sourceX + sourceOffset.x, y: sourceY + sourceOffset.y },
    target: { x: targetX + targetOffset.x, y: targetY + targetOffset.y },
  };
};

export default computeEndpointLabelDefaults;
