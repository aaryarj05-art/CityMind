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
  getNearby: (params) => api.get('/hospitals/nearby', { params, timeout: 15000 }),
  rankLive: (payload) => api.post('/hospitals/rank-live', payload, { timeout: 30000 }),
};

export const mapsAPI = {
  getRoute: (payload) => api.post('/maps/route', payload, { timeout: 15000 }),
  getRouteMatrix: (payload) => api.post('/maps/route-matrix', payload, { timeout: 20000 }),
};

export const complaintsAPI = {
  getAll: () => api.get('/complaints'),
};

export const riskAPI = {
  getSummary: () => api.get('/risk/summary'),
  getAreas: (params) => api.get('/risk/areas', { params }),
  getAreaById: (id) => api.get(`/risk/areas/${id}`),
  getIncidents: (params) => api.get('/risk/incidents', { params }),
  getIncidentById: (id) => api.get(`/risk/incidents/${id}`),
};

export const allocationAPI = {
  getPlan: (incidentId) => api.get(`/allocation/incidents/${incidentId}/plan`),
};

export const dispatchAPI = {
  create: (payload) => api.post('/dispatches', payload),
  getAll: (params) => api.get('/dispatches', { params }),
  getSummary: () => api.get('/dispatches/summary'),
  getById: (id) => api.get(`/dispatches/${id}`),
  updateStatus: (id, status) => api.patch(`/dispatches/${id}/status`, { status }),
  cancel: (id) => api.post(`/dispatches/${id}/cancel`),
  complete: (id) => api.post(`/dispatches/${id}/complete`),
};

export const demoAPI = {
  reset: () => api.post('/demo/reset'),
};

export const aiAPI = {
  query: (payload) => api.post('/ai/query', payload),
};

export default api;
