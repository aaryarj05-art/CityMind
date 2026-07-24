import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { PermissionRoute, ProtectedRoute } from './auth/RouteGuards';
import AccessDenied from './pages/AccessDenied';
import AICommandCenter from './pages/AICommandCenter';
import Analytics from './pages/Analytics';
import Dashboard from './pages/Dashboard';
import Dispatches from './pages/Dispatches';
import Incidents from './pages/Incidents';
import Login from './pages/Login';
import Resources from './pages/Resources';
import RiskZones from './pages/RiskZones';
import Settings from './pages/Settings';
import SecurityOperations from './pages/SecurityOperations';
import UserPortal from './pages/UserPortal';

const LiveResponseIntelligence = lazy(() => import('./pages/LiveResponseIntelligence'));

const secured = (permission, page) => (
  <ProtectedRoute><PermissionRoute permission={permission}>{page}</PermissionRoute></ProtectedRoute>
);

function App() {
  return (
    <Router>
      <AuthProvider>
        <Suspense fallback={<div className="min-h-screen bg-navy-900 flex items-center justify-center text-slate-400">Loading CityMind…</div>}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={secured('dashboard.read', <Dashboard />)} />
            <Route path="/ai-command-center" element={secured('ai.query', <AICommandCenter />)} />
            <Route path="/risk-zones" element={secured('risk.read', <RiskZones />)} />
            <Route path="/incidents" element={secured('incidents.read', <Incidents />)} />
            <Route path="/live-response" element={secured('traffic.read', <LiveResponseIntelligence />)} />
            <Route path="/dispatches" element={secured('dispatch.read', <Dispatches />)} />
            <Route path="/resources" element={secured('resources.read', <Resources />)} />
            <Route path="/user" element={secured('dashboard.read', <UserPortal />)} />
            <Route path="/analytics" element={secured('analytics.read', <Analytics />)} />
            <Route path="/settings" element={secured('settings.manage', <Settings />)} />
            <Route path="/security-operations" element={secured('audit.read', <SecurityOperations />)} />
            <Route path="/access-denied" element={<ProtectedRoute><AccessDenied /></ProtectedRoute>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </Router>
  );
}

export default App;