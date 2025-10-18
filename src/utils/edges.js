import { MarkerType } from '@xyflow/react';

const FORWARD_SOURCE_HANDLES = [
  'right-1',
  'right-2',
  'right-3',
  'bottom-1',
  'bottom-2',
  'bottom-3',
  'left-out-1',
  'left-out-2',
  'left-out-3',
];

const RETURN_TARGET_HANDLES = ['left-1', 'left-2', 'left-3'];

export function generateRouterEdges(nodeId) {
  const edges = [];

  FORWARD_SOURCE_HANDLES.forEach((handle, index) => {
    edges.push({
      id: `${nodeId}-forward-${index}`,
      source: nodeId,
      sourceHandle: handle,
      target: nodeId,
      targetHandle: RETURN_TARGET_HANDLES[index % RETURN_TARGET_HANDLES.length],
      type: 'signal',
      markerEnd: { type: MarkerType.ArrowClosed },
      animated: true,
      style: { stroke: '#ef4444' },
      data: { label: `Forward ${index + 1}`, labelPosition: { x: 0, y: 0 } },
    });
  });

  FORWARD_SOURCE_HANDLES.forEach((handle, index) => {
    edges.push({
      id: `${nodeId}-return-${index}`,
      source: nodeId,
      sourceHandle: RETURN_TARGET_HANDLES[index % RETURN_TARGET_HANDLES.length],
      target: nodeId,
      targetHandle: handle,
      type: 'signal',
      markerEnd: { type: MarkerType.ArrowClosed },
      animated: true,
      style: { stroke: '#22c55e' },
      data: { label: `Return ${index + 1}`, labelPosition: { x: 0, y: 0 } },
    });
  });

  return edges;
}

export function getHandleConnections(edges, handleKey) {
  return edges.filter((edge) => `${edge.source}-${edge.sourceHandle || 'default'}` === handleKey).length;
}

export function isDuplicateEdge(connection, edges) {
  return edges.some(
    (edge) =>
      edge.source === connection.source &&
      edge.target === connection.target &&
      edge.sourceHandle === connection.sourceHandle &&
      edge.targetHandle === connection.targetHandle
  );
}

export function isHandleAvailable(edge, edges) {
  const key = `${edge.source}-${edge.sourceHandle}`;
  return !edges.some((existing) => `${existing.source}-${existing.sourceHandle}` === key);
}
