import { useCallback } from 'react';
import api from './api.js';

export function useChannelsApi() {
  const listChannels = useCallback(async ({ query = '', page = 1, limit = 20 } = {}) => {
    const { data } = await api.get('/channels', {
      params: { query, page, limit },
    });
    return data;
  }, []);

  const getChannel = useCallback(async (id) => {
    const { data } = await api.get(`/channels/${id}`);
    return data;
  }, []);

  const createChannel = useCallback(async (payload) => {
    const { data } = await api.post('/channels', payload);
    return data;
  }, []);

  const deleteChannel = useCallback(async (id) => {
    await api.delete(`/channels/${id}`);
  }, []);

  const duplicateChannel = useCallback(async (id) => {
    const { data } = await api.post(`/channels/${id}/duplicate`);
    return data;
  }, []);

  const versionChannel = useCallback(async (id) => {
    const { data } = await api.post(`/channels/${id}/version`);
    return data;
  }, []);

  const patchChannelNodes = useCallback(async (id, nodes) => {
    await api.patch(`/channels/${id}/nodes`, { nodes });
  }, []);

  const patchChannelEdges = useCallback(async (id, edges) => {
    await api.patch(`/channels/${id}/edges`, { edges });
  }, []);

  const saveDiagram = useCallback(async (id, payload) => {
    const { data } = await api.put(`/channels/${id}`, payload);
    return data;
  }, []);

  return {
    listChannels,
    getChannel,
    createChannel,
    deleteChannel,
    duplicateChannel,
    versionChannel,
    patchChannelNodes,
    patchChannelEdges,
    saveDiagram,
  };
}
