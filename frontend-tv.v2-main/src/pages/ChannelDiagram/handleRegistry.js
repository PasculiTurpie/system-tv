// src/pages/ChannelDiagram/handleRegistry.js
import { HANDLE_IDS, HANDLE_CONFIG_BY_TYPE } from "./handleConstants.js";
import {
  ensureEdgeHandlesForTypes,
  ensureHandleForType,
  ensureHandleId,
  parseHandleDescriptor,
  toHandleTypeKey,
  HANDLE_DIRECTIONS,
} from "./handleStandard.js";

// Set con todos los IDs canónicos declarados
const ALL_HANDLE_IDS = new Set(
  Object.values(HANDLE_IDS)
    .map((value) => ensureHandleId(value))
    .filter(Boolean)
);

export const KNOWN_TYPES = new Set(Object.keys(HANDLE_CONFIG_BY_TYPE));

export function isKnownHandle(id) {
  if (!id) return false;
  const normalized = ensureHandleId(id);
  return normalized ? ALL_HANDLE_IDS.has(normalized) : false;
}

export function getTypeConfig(tipo = "default") {
  const key = toHandleTypeKey(tipo);
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
 * Ajusta un handle al set válido del tipo indicado. Mantiene direction/side.
 */
export function coerceHandleForType(tipo, handleId) {
  const descriptor = parseHandleDescriptor(handleId);
  if (!descriptor) return undefined;
  return ensureHandleForType(
    tipo,
    descriptor.id,
    descriptor.direction ?? HANDLE_DIRECTIONS.SOURCE,
    descriptor.side
  );
}

/**
 * Normaliza los handles de un edge según los tipos reales de source/target.
 * Si un handle no existe para ese tipo, lo corrige; si no hay candidatos, lo elimina.
 */
export function normalizeEdgeHandlesForTypes(edge, srcType = "default", tgtType = "default") {
  const next = { ...edge };
  const { sourceHandle, targetHandle } = ensureEdgeHandlesForTypes(
    edge,
    toHandleTypeKey(srcType),
    toHandleTypeKey(tgtType),
    edge
  );

  if (sourceHandle) next.sourceHandle = sourceHandle;
  else delete next.sourceHandle;

  if (targetHandle) next.targetHandle = targetHandle;
  else delete next.targetHandle;

  return next;
}
