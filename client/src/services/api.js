import axios from 'axios';

const apiBaseURL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL.replace(/\/$/, '')}/api`
  : import.meta.env.PROD
    ? 'https://reportiq-api.onrender.com/api'
    : '/api';

const api = axios.create({
  baseURL: apiBaseURL,
  timeout: 60000,
});

// Attach token from localStorage on every request
api.interceptors.request.use(config => {
  const token = localStorage.getItem('riq_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle 401 globally — redirect to login if token expired
api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('riq_token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
