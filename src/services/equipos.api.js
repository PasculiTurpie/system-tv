import { useCallback } from 'react';
import api from './api.js';

export function useEquiposApi() {
  const listEquipos = useCallback(async (tipo) => {
    const { data } = await api.get('/equipo', { params: { tipo } });
    return data;
  }, []);

  return { listEquipos };
}
