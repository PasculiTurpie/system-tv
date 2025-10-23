// src/pages/ChannelDiagram/flowRules.js
import normalizeHandle from "../../utils/normalizeHandle";
import { HANDLE_IDS } from "./handleConstants";
import { normalizeEdgeHandlesForTypes } from "./handleRegistry";

/**
 * Normaliza sourceHandle/targetHandle de un edge en base al tipo real de los nodos.
 */
export function normalizeEdgeHandles(edge, nodes = []) {
  const srcNode = nodes.find((n) => String(n.id) === String(edge.source));
  const tgtNode = nodes.find((n) => String(n.id) === String(edge.target));

  const srcType =
    srcNode?.data?.equipoTipo ||
    (typeof srcNode?.type === "string" ? srcNode?.type.toLowerCase() : "default");
  const tgtType =
    tgtNode?.data?.equipoTipo ||
    (typeof tgtNode?.type === "string" ? tgtNode?.type.toLowerCase() : "default");

  const base = {
    ...edge,
    ...(edge.sourceHandle ? { sourceHandle: normalizeHandle(edge.sourceHandle) } : {}),
    ...(edge.targetHandle ? { targetHandle: normalizeHandle(edge.targetHandle) } : {}),
  };

  return normalizeEdgeHandlesForTypes(base, srcType, tgtType);
}

/**
 * Regla negocio: SATÉLITE -> IRD fuerza out-right-1 → in-left-1
 */
export function enforceSateliteToIrd(edge, nodes = []) {
  const srcNode = nodes.find((n) => String(n.id) === String(edge.source));
  const tgtNode = nodes.find((n) => String(n.id) === String(edge.target));
  if (!srcNode || !tgtNode) return edge;

  const srcTipo = (srcNode.data?.equipoTipo || srcNode.type || "").toLowerCase();
  const tgtTipo = (tgtNode.data?.equipoTipo || tgtNode.type || "").toLowerCase();

  if (srcTipo === "satelite" && tgtTipo === "ird") {
    return {
      ...edge,
      sourceHandle: HANDLE_IDS.OUT_RIGHT_PRIMARY,
      targetHandle: HANDLE_IDS.IN_LEFT_PRIMARY,
    };
  }
  return edge;
}

/**
 * Asegura/propaga labels para UX consistente.
 */
export function autoLabelEdge(edge) {
  const direction = edge?.data?.direction || (edge.style?.stroke === "green" ? "vuelta" : "ida");
  const fallbackLabel = edge.label || edge?.data?.label || edge.id;
  const nextData = {
    ...(edge.data || {}),
    direction,
    label: fallbackLabel,
  };

  let endpointLabels = { ...(nextData.endpointLabels || {}) };
  if (nextData.labelStart) endpointLabels.source = nextData.labelStart;
  if (nextData.labelEnd) endpointLabels.target = nextData.labelEnd;
  if (Object.keys(endpointLabels).length) {
    nextData.endpointLabels = endpointLabels;
  } else if (nextData.endpointLabels) {
    delete nextData.endpointLabels;
  }

  return {
    ...edge,
    label: fallbackLabel,
    data: nextData,
  };
}
