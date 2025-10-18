import PropTypes from 'prop-types';
import { Handle, Position } from '@xyflow/react';
import { useNodeLabelDrag } from '../../hooks/useNodeLabelDrag.js';

const targetHandles = [
  { id: 'left-1', position: Position.Left },
  { id: 'left-2', position: Position.Left },
  { id: 'left-3', position: Position.Left },
];

const sourceHandles = [
  { id: 'right-1', position: Position.Right },
  { id: 'right-2', position: Position.Right },
  { id: 'right-3', position: Position.Right },
  { id: 'bottom-1', position: Position.Bottom },
  { id: 'bottom-2', position: Position.Bottom },
  { id: 'bottom-3', position: Position.Bottom },
  { id: 'left-out-1', position: Position.Left },
  { id: 'left-out-2', position: Position.Left },
  { id: 'left-out-3', position: Position.Left },
];

export default function RouterNode({ id, data }) {
  const { ref, onDragStart } = useNodeLabelDrag(id, data?.labelPosition);

  return (
    <div className="relative rounded-lg border border-slate-700 bg-slate-800/80 px-4 py-3 shadow-lg">
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
      <p className="text-xs text-slate-400">Router</p>
      {targetHandles.map((handle) => (
        <Handle key={handle.id} type="target" position={handle.position} id={handle.id} className="!bg-rose-400" />
      ))}
      {sourceHandles.map((handle) => (
        <Handle key={handle.id} type="source" position={handle.position} id={handle.id} className="!bg-emerald-400" />
      ))}
    </div>
  );
}

RouterNode.propTypes = {
  id: PropTypes.string.isRequired,
  data: PropTypes.object.isRequired,
};
