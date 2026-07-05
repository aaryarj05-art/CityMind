import axios from 'axios';
import { clearSession, getAccessToken } from '../auth/authStorage.js';
import { buildLiveHospitalRankingPayload } from './hospitalPayload.js';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const requestUrl = error.config?.url || '';
    if (status === 401 && !requestUrl.includes('/auth/google')) {
      clearSession();
      window.dispatchEvent(new CustomEvent('citymind-auth-cleared', { detail: 'session' }));
      if (window.location.pathname !== '/login') window.location.replace('/login?reason=session');
    } else if (status === 403) {
      window.dispatchEvent(new CustomEvent('citymind-access-denied', {
        detail: error.response?.data?.detail || 'You do not have permission for that action.',
      }));
    }
    return Promise.reject(error);
  },
);

export const authAPI = {
  google: (credential) => api.post('/auth/google', { credential }),
  me: () => api.get('/auth/me'),
  logout: () => api.post('/auth/logout'),
  sessionStatus: () => api.get('/auth/session-status'),
};
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
  rankLive: (incidentId, limit = 10) => api.post(
    '/hospitals/rank-live',
    buildLiveHospitalRankingPayload(incidentId, limit),
    { timeout: 30000 },
  ),
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
