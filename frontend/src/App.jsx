import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import RiskZones from './pages/RiskZones';
import Incidents from './pages/Incidents';
import Dispatches from './pages/Dispatches';
import Resources from './pages/Resources';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';
import AICommandCenter from './pages/AICommandCenter';

const LiveResponseIntelligence = lazy(() => import('./pages/LiveResponseIntelligence'));

function App() {
  return (
    <Router>
      <Suspense fallback={<div className="min-h-screen bg-navy-900 flex items-center justify-center text-slate-400">Loading Live Response…</div>}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/ai-command-center" element={<AICommandCenter />} />
          <Route path="/risk-zones" element={<RiskZones />} />
          <Route path="/incidents" element={<Incidents />} />
          <Route path="/live-response" element={<LiveResponseIntelligence />} />
          <Route path="/dispatches" element={<Dispatches />} />
          <Route path="/resources" element={<Resources />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </Suspense>
    </Router>
  );
}

export default App;