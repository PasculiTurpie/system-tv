import { memo } from 'react';
import { useDiagramStore } from '../store/useDiagramStore.js';
import { createNodeId } from '../utils/id.js';

const baseNodes = [
  { type: 'equipo', label: 'Equipo' },
  { type: 'router', label: 'Router' },
  { type: 'annotation', label: 'Nota' },
];

function Palette() {
  const addNode = useDiagramStore((state) => state.addNode);

  const handleAdd = (type) => {
    const id = createNodeId(type);
    const position = { x: 50, y: 50 };
    const baseData = { label: `${type} ${id}`, initialized: type !== 'router' };
    addNode({
      id,
      type,
      position,
      data: baseData,
    });
  };

  return (
    <aside className="w-48 shrink-0 border-r border-slate-800 bg-slate-900/70 backdrop-blur p-4 space-y-3">
      <h2 className="text-sm font-semibold tracking-wide uppercase text-slate-400">Palette</h2>
      <ul className="space-y-2">
        {baseNodes.map((node) => (
          <li key={node.type}>
            <button
              type="button"
              onClick={() => handleAdd(node.type)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-left text-sm hover:border-sky-500 focus-visible:outline-none focus-visible:ring focus-visible:ring-sky-500/60"
            >
              {node.label}
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}

export default memo(Palette);
