// Mapea "in-left" -> "in-left-1", "out-right" -> "out-right-1", etc.
// Si ya viene con índice (-1, -2, …), lo deja igual.
const SIDES = new Set(["top", "bottom", "left", "right"]);

const buildCanonicalId = (direction, side, index) => {
  if (!direction || !side || !SIDES.has(side)) return null;
  const numericIndex = Number.parseInt(index, 10);
  const safeIndex = Number.isFinite(numericIndex) && numericIndex > 0 ? numericIndex : 1;
  return `${direction}-${side}-${safeIndex}`;
};

const normalizeHandle = (handle) => {
  if (handle === undefined || handle === null) return undefined;

  const value = String(handle).trim();
  if (!value) return undefined;

  const lower = value.toLowerCase();

  const directMatch = /^(in|out)-(top|bottom|left|right)(?:-(\d+))?$/.exec(lower);
  if (directMatch) {
    return buildCanonicalId(directMatch[1], directMatch[2], directMatch[3]);
  }

  const srcPrefixMatch = /^(src|source)-(top|bottom|left|right)(?:-(\d+))?$/.exec(lower);
  if (srcPrefixMatch) {
    return buildCanonicalId("out", srcPrefixMatch[2], srcPrefixMatch[3]);
  }

  const tgtPrefixMatch = /^(tgt|target)-(top|bottom|left|right)(?:-(\d+))?$/.exec(lower);
  if (tgtPrefixMatch) {
    return buildCanonicalId("in", tgtPrefixMatch[2], tgtPrefixMatch[3]);
  }

  const srcSuffixMatch = /^(top|bottom|left|right)-(src|source)(?:-(\d+))?$/.exec(lower);
  if (srcSuffixMatch) {
    return buildCanonicalId("out", srcSuffixMatch[1], srcSuffixMatch[3]);
  }

  const tgtSuffixMatch = /^(top|bottom|left|right)-(tgt|target)(?:-(\d+))?$/.exec(lower);
  if (tgtSuffixMatch) {
    return buildCanonicalId("in", tgtSuffixMatch[1], tgtSuffixMatch[3]);
  }

  // Mantiene el identificador original para manejadores personalizados.
  return value;
};

export default normalizeHandle;
