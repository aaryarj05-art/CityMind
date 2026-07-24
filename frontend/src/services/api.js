import axios from 'axios';
import { clearSession, getAccessToken } from '../auth/authStorage.js';
import { buildLiveHospitalRankingPayload } from './hospitalPayload.js';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => {
    const method = response.config?.method?.toLowerCase();
    if (['post', 'put', 'patch', 'delete'].includes(method)) {
      window.dispatchEvent(new CustomEvent('citymind-data-mutated'));
    }
    return response;
  },
  (error) => {
    const status = error.response?.status;
    const requestUrl = error.config?.url || '';
    if (status === 401 && !requestUrl.includes('/auth/google')) {
      clearSession();
      window.dispatchEvent(new CustomEvent('citymind-auth-cleared', { detail: 'session' }));
      if (window.location.pathname !== '/login') window.location.replace('/login?reason=session');
    } else if (status === 403 && error.response?.data?.detail?.code !== 'AI_REQUEST_BLOCKED') {
      window.dispatchEvent(new CustomEvent('citymind-access-denied', {
        detail: error.response?.data?.detail || 'You do not have permission for that action.',
      }));
    }
    return Promise.reject(error);
  },
);

export const authAPI = {
  google: (credential) => api.post('/auth/google', { credential }),
  me: () => api.get('/auth/me'), logout: () => api.post('/auth/logout'),
  sessionStatus: () => api.get('/auth/session-status'),
};
export const dashboardAPI = { getSummary: () => api.get('/dashboard/summary'), getDashboardData: () => api.get('/dashboard') };
export const areasAPI = { getAll: () => api.get('/areas'), getById: (id) => api.get(`/areas/${id}`) };
export const incidentsAPI = {
  getAll: (params) => api.get('/incidents', { params }), getById: (id) => api.get(`/incidents/${id}`),
  getEvidence: (id) => api.get(`/incidents/${id}/evidence`, { timeout: 12000 }),
  getSources: (id) => api.get(`/incidents/${id}/sources`, { timeout: 12000 }),
  getConfidence: (id) => api.get(`/incidents/${id}/confidence`, { timeout: 12000 }),
  create: (payload) => api.post('/incidents', payload), update: (id, payload) => api.patch(`/incidents/${id}`, payload),
};
export const resourcesAPI = {
  getAll: (params) => api.get('/resources', { params }),
  getPage: (params) => api.get('/resources', { params: { page: 1, page_size: 25, ...params } }),
  getBases: (params) => api.get('/resources/bases', { params }),
  getById: (id) => api.get(`/resources/${id}`),
  updateStatus: (id, status) => api.patch(`/resources/${id}/status`, { status }),
};
export const hospitalsAPI = {
  getAll: () => api.get('/hospitals'),
  getNearby: (params) => api.get('/hospitals/nearby', { params, timeout: 15000 }),
  rankLive: (incidentId, limit = 10) => api.post('/hospitals/rank-live', buildLiveHospitalRankingPayload(incidentId, limit), { timeout: 30000 }),
};
export const mapsAPI = {
  getRoute: (payload) => api.post('/maps/route', payload, { timeout: 15000 }),
  getRouteMatrix: (payload) => api.post('/maps/route-matrix', payload, { timeout: 20000 }),
};
export const complaintsAPI = { getAll: () => api.get('/complaints') };
export const riskAPI = {
  getSummary: () => api.get('/risk/summary'), getAreas: (params) => api.get('/risk/areas', { params }),
  getAreaById: (id) => api.get(`/risk/areas/${id}`), getIncidents: (params) => api.get('/risk/incidents', { params }),
  getIncidentById: (id) => api.get(`/risk/incidents/${id}`),
};
export const allocationAPI = { getPlan: (incidentId) => api.get(`/allocation/incidents/${incidentId}/plan`) };
export const dispatchAPI = {
  create: (payload) => api.post('/dispatches', payload), getAll: (params) => api.get('/dispatches', { params }),
  getSummary: () => api.get('/dispatches/summary'), getById: (id) => api.get(`/dispatches/${id}`),
  updateStatus: (id, status) => api.patch(`/dispatches/${id}/status`, { status }),
  cancel: (id) => api.post(`/dispatches/${id}/cancel`), complete: (id) => api.post(`/dispatches/${id}/complete`),
};
export const demoAPI = { reset: () => api.post('/demo/reset') };
export const aiAPI = {
  query: (payload) => api.post('/ai/query', payload, { timeout: 125000 }),
  status: () => api.get('/ai/status'),
};
export const analyticsAPI = { getBigQueryStatus: () => api.get('/analytics/bigquery/status') };
export const securityAPI = {
  getSummary: () => api.get('/security/summary'), getEvents: (params) => api.get('/security/events', { params }),
  getEvent: (eventId) => api.get(`/security/events/${eventId}`), getAuditIntegrity: () => api.get('/security/audit-integrity'),
  getAgentHealth: () => api.get('/security/agent-health'), getGroundingMetrics: () => api.get('/security/grounding-metrics'),
};
export default api;
