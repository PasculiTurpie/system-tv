const RAW_SAMPLES = [];

const clone = (diagram) => JSON.parse(JSON.stringify(diagram));

const entries = RAW_SAMPLES.map((diagram) => ({
  diagram,
  aliases: [diagram._id, ...(diagram?.metadata?.aliases || [])]
    .filter(Boolean)
    .map((alias) => String(alias).trim().toLowerCase()),
}));

const lookup = new Map();
entries.forEach(({ diagram, aliases }) => {
  aliases.forEach((alias) => {
    if (!lookup.has(alias)) {
      lookup.set(alias, diagram);
    }
  });
});

export const getSampleDiagramById = (id) => {
  if (!id) return null;
  const key = String(id).trim().toLowerCase();
  const source = lookup.get(key);
  if (!source) return null;
  const copy = clone(source);
  copy.isSample = true;
  return copy;
};

export const listSampleDiagrams = () =>
  entries.map(({ diagram }) => {
    const copy = clone(diagram);
    copy.isSample = true;
    return copy;
  });

export const getSampleChannelSummaries = () =>
  listSampleDiagrams().map((diagram) => ({
    _id: diagram._id,
    signal: diagram.signal,
    nodes: diagram.nodes,
    edges: diagram.edges,
    isSample: true,
    metadata: diagram.metadata || {},
  }));
