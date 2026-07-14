import axios from 'axios';
import { useAuthStore } from '../stores/auth';

const api = axios.create({
  baseURL: 'http://localhost:3000/api', // fallback if env is not loaded, but Vite proxy is better
  timeout: 10000,
  withCredentials: true // send cookies automatically
});

let isRefreshing = false;
let failedQueue: any[] = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

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
  async (error) => {
    const originalRequest = error.config;
    
    // Check if it's a 401 and we haven't retried yet
    // Do not intercept auth/me or login calls to avoid infinite loops
    if (
      error.response && 
      error.response.status === 401 && 
      !originalRequest._retry && 
      !originalRequest.url.includes('/auth/login') &&
      !originalRequest.url.includes('/auth/me')
    ) {
      if (isRefreshing) {
        // Queue the request
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          originalRequest.headers.Authorization = 'Bearer ' + token;
          return api(originalRequest);
        }).catch(err => {
          return Promise.reject(err);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const authStore = useAuthStore();
      
      try {
        const success = await authStore.autoLogin();
        if (success) {
          processQueue(null, authStore.token);
          originalRequest.headers.Authorization = 'Bearer ' + authStore.token;
          return api(originalRequest);
        } else {
          processQueue(new Error('Refresh token expired'), null);
          authStore.logout();
          window.dispatchEvent(new CustomEvent('session-expired', { detail: 'invalidated' }));
          return Promise.reject(error);
        }
      } catch (err) {
        processQueue(err, null);
        authStore.logout();
        window.dispatchEvent(new CustomEvent('session-expired', { detail: 'invalidated' }));
        return Promise.reject(error);
      } finally {
        isRefreshing = false;
      }
    }
    
    return Promise.reject(error);
  }
);

export default api;
