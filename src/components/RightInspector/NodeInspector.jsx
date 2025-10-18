import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useDiagramStore } from '../../store/useDiagramStore.js';
import { debounce } from '../../utils/debounce.js';

const debouncedPatch = debounce((updateNode, id, patch) => updateNode(id, patch), 300);

export default function NodeInspector({ node }) {
  const updateNode = useDiagramStore((state) => state.updateNode);
  const [form, setForm] = useState({
    label: node?.data?.label ?? '',
    image: node?.data?.image ?? '',
    tags: node?.data?.tags?.join(', ') ?? '',
  });

  useEffect(() => {
    setForm({
      label: node?.data?.label ?? '',
      image: node?.data?.image ?? '',
      tags: node?.data?.tags?.join(', ') ?? '',
    });
  }, [node?.id, node?.data]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    debouncedPatch(updateNode, node.id, {
      data: {
        ...node.data,
        [name]: name === 'tags' ? value.split(',').map((tag) => tag.trim()).filter(Boolean) : value,
      },
    });
  };

  return (
    <section aria-labelledby="node-inspector-title" className="space-y-3 text-sm">
      <div>
        <h2 id="node-inspector-title" className="text-xs uppercase tracking-wide text-slate-400">
          Nodo
        </h2>
        <p className="text-lg font-semibold text-white">{node.id}</p>
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
          <span className="text-xs text-slate-400">Imagen</span>
          <input
            name="image"
            value={form.image}
            onChange={handleChange}
            className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-400">Tags</span>
          <input
            name="tags"
            value={form.tags}
            onChange={handleChange}
            className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1"
          />
        </label>
      </div>
      <div className="space-y-1">
        <p className="text-xs uppercase tracking-wide text-slate-400">Handles</p>
        <ul className="space-y-1">
          {node?.data?.handles?.map((handle) => (
            <li key={handle.id} className="flex justify-between text-xs text-slate-300">
              <span>{handle.id}</span>
              <span>{handle.connections}</span>
            </li>
          )) || <li className="text-xs text-slate-500">Sin handles</li>}
        </ul>
      </div>
    </section>
  );
}

NodeInspector.propTypes = {
  node: PropTypes.object.isRequired,
};
