export const validCoordinates = (item) => item
  && Number.isFinite(Number(item.latitude))
  && Number.isFinite(Number(item.longitude))
  && Number(item.latitude) >= -90 && Number(item.latitude) <= 90
  && Number(item.longitude) >= -180 && Number(item.longitude) <= 180;

export const formatDuration = (seconds) => {
  if (!Number.isFinite(Number(seconds))) return 'Unavailable';
  const value = Number(seconds);
  const minutes = Math.floor(value / 60);
  const remainder = Math.round(value % 60);
  return minutes ? `${minutes}m ${remainder}s` : `${remainder}s`;
};

export const formatDistance = (meters) => {
  if (!Number.isFinite(Number(meters))) return 'Unavailable';
  return Number(meters) >= 1000
    ? `${(Number(meters) / 1000).toFixed(2)} km`
    : `${Math.round(Number(meters))} m`;
};

export const apiMessage = (error, fallback) => {
  if (error?.code === 'ECONNABORTED' || error?.message?.toLowerCase().includes('timeout')) {
    return 'The route request timed out. Verified data was not replaced with a browser estimate.';
  }
  if (!error?.response) return 'CityMind backend is offline or unreachable.';
  const detail = error.response?.data?.detail;
  return typeof detail === 'string' ? detail : detail?.message || fallback;
};
