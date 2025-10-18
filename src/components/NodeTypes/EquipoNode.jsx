import PropTypes from 'prop-types';
import { Handle, Position } from '@xyflow/react';
import { useNodeLabelDrag } from '../../hooks/useNodeLabelDrag.js';

export default function EquipoNode({ id, data }) {
  const { ref, onDragStart } = useNodeLabelDrag(id, data?.labelPosition);

  return (
    <div className="relative rounded-lg border border-slate-700 bg-slate-800/80 px-4 py-3 shadow-lg">
      {data.image && (
        <img src={data.image} alt="" className="mb-2 h-12 w-12 rounded-md object-cover" />
      )}
      <p
        ref={ref}
        role="button"
        tabIndex={0}
        onMouseDown={onDragStart}
        onKeyDown={(event) => event.key === 'Enter' && onDragStart(event)}
        className="text-sm font-medium text-white cursor-move"
        style={{ transform: `translate(${data?.labelPosition?.x ?? 0}px, ${data?.labelPosition?.y ?? 0}px)` }}
      >
        {data.label || id}
      </p>
      <p className="text-xs text-slate-400">Equipo</p>
      <Handle type="target" position={Position.Left} id="in" className="!bg-sky-400" />
      <Handle type="source" position={Position.Right} id="out" className="!bg-emerald-400" />
    </div>
  );
}

EquipoNode.propTypes = {
  id: PropTypes.string.isRequired,
  data: PropTypes.object.isRequired,
};
