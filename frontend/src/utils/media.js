import { apiOriginFromBase } from './apiBase.js';

export const resolveMediaUrl = (url) => {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  const origin = apiOriginFromBase();
  const path = url.startsWith('/') ? url : `/${url}`;
  return `${origin}${path}`;
};
