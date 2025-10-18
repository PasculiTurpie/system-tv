import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE,
  withCredentials: true,
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if ([401, 403].includes(error?.response?.status)) {
      console.warn('Autenticación requerida');
    }
    return Promise.reject(error);
  }
);

export default api;
