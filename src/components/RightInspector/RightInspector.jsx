import { memo, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useDiagramStore } from '../../store/useDiagramStore.js';
import NodeInspector from './NodeInspector.jsx';
import EdgeInspector from './EdgeInspector.jsx';
import AnnotationInspector from './AnnotationInspector.jsx';

function RightInspector({ selection }) {
  const autoOpenInspector = useDiagramStore((state) => state.autoOpenInspector);

  useEffect(() => {
    if (selection?.type) {
      autoOpenInspector();
    }
  }, [selection?.type, autoOpenInspector]);

  const visible = Boolean(selection?.type);

  return (
    <aside
      className={`transition-all duration-300 border-l border-slate-800 bg-slate-900/80 backdrop-blur w-80 overflow-y-auto scrollbar-thin ${
        visible ? 'translate-x-0' : 'translate-x-full'
      }`}
      aria-hidden={!visible}
      aria-label="Inspector"
    >
      <div className="p-4 space-y-4">
        {!selection?.type && <p className="text-sm text-slate-500">Selecciona un nodo o arista.</p>}
        {selection?.type === 'node' && <NodeInspector node={selection.item} />}
        {selection?.type === 'edge' && <EdgeInspector edge={selection.item} />}
        {selection?.type === 'annotation' && <AnnotationInspector annotation={selection.item} />}
      </div>
    </aside>
  );
}

RightInspector.propTypes = {
  selection: PropTypes.shape({
    type: PropTypes.string,
    item: PropTypes.object,
  }),
};

RightInspector.defaultProps = {
  selection: null,
};

export default memo(RightInspector);
