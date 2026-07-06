import { useCallback, useEffect, useRef, useState } from 'react';
import { dashboardAPI } from '../services/api';
import { DASHBOARD_POLL_MS, shouldPollDashboard } from '../utils/operations';

export const useDashboardData = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  const fetchData = useCallback(async ({ background = false } = {}) => {
    if (inFlight.current) return false;
    inFlight.current = true;
    if (background) setRefreshing(true); else setLoading(true);
    try {
      const response = await dashboardAPI.getDashboardData();
      if (!mounted.current) return false;
      setData(response.data); setError(null);
      window.dispatchEvent(new CustomEvent('citymind-dashboard-refreshed'));
      return true;
    } catch (err) {
      if (mounted.current) setError(err.response?.data?.detail || err.message || 'Failed to fetch dashboard data');
      return false;
    } finally {
      inFlight.current = false;
      if (mounted.current) { setLoading(false); setRefreshing(false); }
    }
  }, []);
  useEffect(() => {
    mounted.current = true; fetchData();
    const poll = () => { if (shouldPollDashboard(document.visibilityState)) fetchData({ background: true }); };
    const timer = window.setInterval(poll, DASHBOARD_POLL_MS);
    const onVisibility = () => { if (shouldPollDashboard(document.visibilityState)) fetchData({ background: true }); };
    const onMutation = () => fetchData({ background: true });
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('citymind-data-mutated', onMutation);
    return () => { mounted.current = false; window.clearInterval(timer); document.removeEventListener('visibilitychange', onVisibility); window.removeEventListener('citymind-data-mutated', onMutation); };
  }, [fetchData]);
  const age = data?.summary?.data_freshness_seconds ?? null;
  return { data, loading, refreshing, error, stale: age !== null && age > 60,
    degraded: data?.summary?.system_status === 'degraded', refetch: () => fetchData() };
};
