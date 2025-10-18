import { useCallback, useRef } from 'react';
import { useDiagramStore } from '../store/useDiagramStore.js';

export function useNodeLabelDrag(nodeId, initialPosition) {
  const updateNode = useDiagramStore((state) => state.updateNode);
  const ref = useRef(null);
  const position = useRef(initialPosition ?? { x: 0, y: 0 });

  const onDragStart = useCallback(
    (event) => {
      event.preventDefault();
      const startX = event.clientX;
      const startY = event.clientY;
      const { x: initialX, y: initialY } = position.current;

      const handleMove = (moveEvent) => {
        const dx = moveEvent.clientX - startX;
        const dy = moveEvent.clientY - startY;
        position.current = { x: initialX + dx, y: initialY + dy };
        updateNode(nodeId, { data: { labelPosition: position.current } });
      };

      const handleUp = () => {
        window.removeEventListener('mousemove', handleMove);
        window.removeEventListener('mouseup', handleUp);
      };

      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleUp);
    },
    [nodeId, updateNode]
  );

  return { ref, onDragStart };
}
