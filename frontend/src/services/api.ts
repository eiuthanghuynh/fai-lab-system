import axios from 'axios';
import { useAuthStore } from '../stores/auth';

const api = axios.create({
  baseURL: 'http://localhost:3000/api', // fallback if env is not loaded, but Vite proxy is better
  timeout: 10000,
});

api.interceptors.request.use(
  (config) => {
    const authStore = useAuthStore();
    if (authStore.token) {
      config.headers.Authorization = `Bearer ${authStore.token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      const authStore = useAuthStore();
      if (authStore.isAuthenticated) {
        authStore.logout();
        window.dispatchEvent(new CustomEvent('session-expired', { detail: 'invalidated' }));
      }
    }
    return Promise.reject(error);
  }
);

export default api;
