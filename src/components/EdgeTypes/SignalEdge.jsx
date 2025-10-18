import PropTypes from 'prop-types';
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath } from '@xyflow/react';
import { useEdgeLabelDrag } from '../../hooks/useEdgeLabelDrag.js';

export default function SignalEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style, data, markerEnd }) {
  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  const { labelRef, onDragStart } = useEdgeLabelDrag(id, data?.labelPosition);

  return (
    <>
      <BaseEdge id={id} path={path} style={style} markerEnd={markerEnd} />
      <EdgeLabelRenderer>
        <div
          ref={labelRef}
          role="button"
          tabIndex={0}
          onMouseDown={onDragStart}
          onKeyDown={(event) => event.key === 'Enter' && onDragStart(event)}
          className="absolute select-none rounded bg-slate-800/90 px-2 py-1 text-xs text-white shadow-lg"
          style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
        >
          {data?.label ?? 'Edge'}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

SignalEdge.propTypes = {
  id: PropTypes.string.isRequired,
  sourceX: PropTypes.number.isRequired,
  sourceY: PropTypes.number.isRequired,
  targetX: PropTypes.number.isRequired,
  targetY: PropTypes.number.isRequired,
  sourcePosition: PropTypes.string.isRequired,
  targetPosition: PropTypes.string.isRequired,
  style: PropTypes.object,
  data: PropTypes.object,
  markerEnd: PropTypes.object,
};

SignalEdge.defaultProps = {
  style: {},
  data: {},
  markerEnd: undefined,
};
