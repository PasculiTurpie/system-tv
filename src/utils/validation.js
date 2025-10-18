import { getHandleConnections, isDuplicateEdge } from './edges.js';

export function validateConnection(connection, nodes, edges) {
  if (!connection?.source || !connection?.target) return false;
  if (connection.source === connection.target) return false;

  const handleKey = `${connection.source}-${connection.sourceHandle || 'default'}`;
  const handleConnections = getHandleConnections(edges, handleKey);
  if (handleConnections >= 1) return false;

  if (isDuplicateEdge(connection, edges)) return false;

  return true;
}

export function validateEdgeMetadata(edge) {
  const badges = [];
  if (!edge?.data) return { badges };
  if (edge.data.url) badges.push('url');
  if (edge.data.multicast) badges.push('multicast');
  return { badges };
}
