import { useCallback } from 'react';
import api from './api.js';

export function useAuditApi() {
  const listEvents = useCallback(async (channelId) => {
    const { data } = await api.get('/audit', { params: { resource: `channel/${channelId}` } });
    return data;
  }, []);

  return { listEvents };
}
