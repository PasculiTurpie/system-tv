import { useEffect, useRef } from 'react';
import { debounce } from '../utils/debounce.js';
import { useDiagramStore } from '../store/useDiagramStore.js';
import { useChannelsApi } from '../services/channels.api.js';

const AUTOSAVE_DELAY = 500;

export function useAutosave(channelId) {
  const { saveDiagram } = useChannelsApi();
  const { nodes, edges, meta, markSaving, markSaved } = useDiagramStore();
  const pending = useRef(null);

  useEffect(() => {
    if (!channelId) return;

    const runSave = debounce(async () => {
      if (meta.status !== 'dirty') return;
      markSaving();
      try {
        await saveDiagram(channelId, { nodes, edges });
        markSaved();
      } catch (error) {
        console.error('Autosave error', error);
      }
    }, AUTOSAVE_DELAY);

    pending.current = runSave;
    runSave();

    return () => {
      pending.current?.cancel?.();
    };
  }, [channelId, nodes, edges, meta.status, markSaving, markSaved, saveDiagram]);

  return pending.current;
}
