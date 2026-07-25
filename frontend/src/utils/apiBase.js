const LOCAL_API_BASE_URL = 'http://localhost:8000/api';
const DEPLOYED_API_BASE_URL = 'https://citymind-api-440231657585.asia-south1.run.app/api';

const normalizeApiBaseUrl = (value) => (value || '').trim().replace(/\/+$/, '');

export const resolveApiBaseUrl = () => {
  const configured = normalizeApiBaseUrl(import.meta.env?.VITE_API_BASE_URL);
  if (configured) return configured;

  if (typeof window !== 'undefined') {
    const hostname = window.location?.hostname || '';
    if (hostname === 'localhost' || hostname === '127.0.0.1') return LOCAL_API_BASE_URL;
    if (hostname.includes('citymind-frontend') && hostname.endsWith('.run.app')) {
      return DEPLOYED_API_BASE_URL;
    }
  }

  return LOCAL_API_BASE_URL;
};

export const apiOriginFromBase = (baseUrl = resolveApiBaseUrl()) => (
  baseUrl.endsWith('/api') ? baseUrl.slice(0, -4) : baseUrl
);
