import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import AccessDenied from '../pages/AccessDenied';

const SessionLoading = () => (
  <div className="min-h-screen bg-navy-950 flex items-center justify-center" role="status" aria-live="polite">
    <div className="text-center">
      <div className="w-9 h-9 rounded-full border-2 border-blue-400 border-t-transparent animate-spin mx-auto" />
      <p className="mt-4 text-sm text-slate-400">Verifying CityMind session…</p>
    </div>
  </div>
);

export const ProtectedRoute = ({ children }) => {
  const { authenticated, loading } = useAuth();
  const location = useLocation();
  if (loading) return <SessionLoading />;
  if (!authenticated) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return children;
};

export const PermissionRoute = ({ permission, permissions, requireAll = true, children }) => {
  const auth = useAuth();
  if (auth.loading) return <SessionLoading />;
  if (!auth.authenticated) return <Navigate to="/login" replace />;
  const required = permissions || (permission ? [permission] : []);
  const allowed = requireAll
    ? required.every(auth.hasPermission)
    : required.some(auth.hasPermission);
  return allowed ? children : <AccessDenied />;
};