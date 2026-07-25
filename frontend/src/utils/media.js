const apiBase = () => (
  import.meta.env?.VITE_API_BASE_URL || 'http://localhost:8000/api'
).replace(/\/+$/, '');

export const resolveMediaUrl = (url) => {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  const base = apiBase();
  const origin = base.endsWith('/api') ? base.slice(0, -4) : base;
  const path = url.startsWith('/') ? url : `/${url}`;
  return `${origin}${path}`;
};
