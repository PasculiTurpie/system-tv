let counter = 0;

export function createNodeId(prefix = 'node') {
  counter += 1;
  return `${prefix}-${counter}`;
}
