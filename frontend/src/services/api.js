import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

export const dashboardAPI = {
  getSummary: () => api.get('/dashboard/summary'),
  getDashboardData: () => api.get('/dashboard'),
};

export const areasAPI = {
  getAll: () => api.get('/areas'),
  getById: (id) => api.get(`/areas/${id}`),
};

export const incidentsAPI = {
  getAll: () => api.get('/incidents'),
  getById: (id) => api.get(`/incidents/${id}`),
};

export const resourcesAPI = {
  getAll: () => api.get('/resources'),
  getById: (id) => api.get(`/resources/${id}`),
};

export const hospitalsAPI = {
  getAll: () => api.get('/hospitals'),
};

export const complaintsAPI = {
  getAll: () => api.get('/complaints'),
};

export default api;
