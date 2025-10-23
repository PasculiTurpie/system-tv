// src/utils/normalizeHandle.js
// Canoniza ids de handle al formato: in|out-(top|bottom|left|right)-<index>
// Acepta alias históricos (camelCase, underscores, src/tgt, sufijos, etc.)

const SIDES = new Set(["top", "bottom", "left", "right"]);

const buildCanonicalId = (direction, side, index) => {
  if (!direction || !side || !SIDES.has(side)) return null;
  const numericIndex = Number.parseInt(index, 10);
  const safeIndex = Number.isFinite(numericIndex) && numericIndex > 0 ? numericIndex : 1;
  return `${direction}-${side}-${safeIndex}`;
};

const normalizeHandle = (handle) => {
  if (handle === undefined || handle === null) return undefined;

  let value = String(handle).trim();
  if (!value) return undefined;

  // normaliza separadores/estilos
  value = value
    .replace(/_/g, "-")
    .replace(/\s+/g, "-")
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .toLowerCase();

  // canónico
  let m = /^(in|out)-(top|bottom|left|right)(?:-(\d+))?$/.exec(value);
  if (m) return buildCanonicalId(m[1], m[2], m[3]);

  // prefijos alternos
  m = /^(src|source)-(top|bottom|left|right)(?:-(\d+))?$/.exec(value);
  if (m) return buildCanonicalId("out", m[2], m[3]);

  m = /^(tgt|target)-(top|bottom|left|right)(?:-(\d+))?$/.exec(value);
  if (m) return buildCanonicalId("in", m[2], m[3]);

  // sufijos alternos
  m = /^(top|bottom|left|right)-(src|source)(?:-(\d+))?$/.exec(value);
  if (m) return buildCanonicalId("out", m[1], m[3]);

  m = /^(top|bottom|left|right)-(tgt|target)(?:-(\d+))?$/.exec(value);
  if (m) return buildCanonicalId("in", m[1], m[3]);

  // alias varios (p.ej. "right-out-1", "left-in2", "output-right3")
  m = /^(right|left|top|bottom)-(out|in)(?:-(\d+))?$/.exec(value);
  if (m) return buildCanonicalId(m[2] === "in" ? "in" : "out", m[1], m[3]);

  m = /^(in|out)(?:put)?-(right|left|top|bottom)(\d+)$/.exec(value);
  if (m) return buildCanonicalId(m[1], m[2], m[3]);

  // deja pasar manejadores custom no canónicos (responsabilidad del caller)
  return value;
};

export default normalizeHandle;
