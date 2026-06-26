import axios from 'axios';
 
// In development: Vite proxy forwards /api to localhost:5000
// In production: VITE_API_URL points to the Render server
const baseURL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api';

const api = axios.create({
  baseURL: '/api',
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
