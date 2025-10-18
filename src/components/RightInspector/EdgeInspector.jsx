import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { useDiagramStore } from '../../store/useDiagramStore.js';
import { debounce } from '../../utils/debounce.js';
import { validateEdgeMetadata } from '../../utils/validation.js';

const debouncedPatch = debounce((updateEdge, id, patch) => updateEdge(id, patch), 300);

export default function EdgeInspector({ edge }) {
  const updateEdge = useDiagramStore((state) => state.updateEdge);
  const [form, setForm] = useState({
    label: edge?.data?.label ?? '',
    url: edge?.data?.url ?? '',
    multicast: edge?.data?.multicast ?? '',
  });
  const { badges } = validateEdgeMetadata(edge);

  useEffect(() => {
    setForm({
      label: edge?.data?.label ?? '',
      url: edge?.data?.url ?? '',
      multicast: edge?.data?.multicast ?? '',
    });
  }, [edge?.id, edge?.data]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    debouncedPatch(updateEdge, edge.id, {
      data: {
        ...edge.data,
        [name]: value,
      },
    });
  };

  return (
    <section aria-labelledby="edge-inspector-title" className="space-y-3 text-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 id="edge-inspector-title" className="text-xs uppercase tracking-wide text-slate-400">
            Conexión
          </h2>
          <p className="text-lg font-semibold text-white">{edge.source} ➜ {edge.target}</p>
        </div>
        <div className="flex flex-wrap gap-1">
          {badges.map((badge) => (
            <span
              key={badge}
              className="rounded-full bg-slate-800 border border-slate-700 px-2 py-0.5 text-[10px] uppercase tracking-wide"
            >
              {badge}
            </span>
          ))}
        </div>
      </div>
      <div className="grid gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-400">Etiqueta</span>
          <input
            name="label"
            value={form.label}
            onChange={handleChange}
            className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-400">URL</span>
          <input
            name="url"
            value={form.url}
            onChange={handleChange}
            className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-400">Multicast</span>
          <input
            name="multicast"
            value={form.multicast}
            onChange={handleChange}
            className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1"
          />
        </label>
      </div>
    </section>
  );
}

EdgeInspector.propTypes = {
  edge: PropTypes.object.isRequired,
};
