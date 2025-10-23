// src/pages/ChannelDiagram/handleRegistry.js
import { HANDLE_IDS, HANDLE_CONFIG_BY_TYPE } from "./handleConstants";
import normalizeHandle from "../../utils/normalizeHandle";

// Set con todos los IDs canónicos declarados
const ALL_HANDLE_IDS = new Set(Object.values(HANDLE_IDS).map(String));

export const KNOWN_TYPES = new Set(Object.keys(HANDLE_CONFIG_BY_TYPE));

export function isKnownHandle(id) {
  if (!id) return false;
  const norm = normalizeHandle(id);
  return ALL_HANDLE_IDS.has(norm);
}

export function getTypeConfig(tipo = "default") {
  const key = String(tipo || "default").trim().toLowerCase();
  return HANDLE_CONFIG_BY_TYPE[key] || HANDLE_CONFIG_BY_TYPE.default;
}

/**
 * Devuelve todos los handles válidos (source/target) por side para un tipo de nodo.
 * { source: { top: [...], right: [...], bottom: [...], left: [...] }, target: {...} }
 */
export function listHandlesByType(tipo = "default") {
  return getTypeConfig(tipo);
}

/**
 * Ajusta un handle al set válido del tipo indicado. Mantiene direction/side;
 * si el índice no existe, selecciona el más cercano.
 */
export function coerceHandleForType(tipo, handleId) {
  if (!handleId) return undefined;
  const normalized = normalizeHandle(handleId);
  if (!normalized) return undefined;

  const m = /^(in|out)-(top|right|bottom|left)-(\d+)$/.exec(normalized);
  if (!m) {
    // Si no cumple el patrón canónico, pero existe exacto en catálogo, usarlo.
    return isKnownHandle(normalized) ? normalized : undefined;
  }

  const direction = m[1] === "in" ? "target" : "source";
  const side = m[2];
  const index = Number(m[3]);

  const perType = getTypeConfig(tipo);
  const candidates = perType?.[direction]?.[side] || [];
  if (!candidates.length) return undefined;

  if (candidates.includes(normalized)) return normalized;

  const toIdx = (id) => {
    const mm = /-(\d+)$/.exec(id);
    return mm ? Number(mm[1]) : 1;
  };
  const ordered = [...candidates].sort((a, b) => toIdx(a) - toIdx(b));

  let best = ordered[0];
  let bestDist = Math.abs(toIdx(best) - index);
  for (const c of ordered) {
    const dist = Math.abs(toIdx(c) - index);
    if (dist < bestDist) {
      best = c;
      bestDist = dist;
    }
  }
  return best;
}

/**
 * Normaliza los handles de un edge según los tipos reales de source/target.
 * Si un handle no existe para ese tipo, lo corrige; si no hay candidatos, lo elimina.
 */
export function normalizeEdgeHandlesForTypes(edge, srcType = "default", tgtType = "default") {
  const next = { ...edge };
  if (edge.sourceHandle) {
    const fixed = coerceHandleForType(srcType, edge.sourceHandle);
    if (fixed) next.sourceHandle = fixed;
    else delete next.sourceHandle;
  }
  if (edge.targetHandle) {
    const fixed = coerceHandleForType(tgtType, edge.targetHandle);
    if (fixed) next.targetHandle = fixed;
    else delete next.targetHandle;
  }
  return next;
}
