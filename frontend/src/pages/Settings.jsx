import { useState, useEffect } from 'react';
import PageContainer from '../components/layout/PageContainer';
import { MapPin, Server, RefreshCw, Rss, Bell, Globe, CheckCircle2, XCircle } from 'lucide-react';
import api from '../services/api';

const Settings = () => {
  const [backendStatus, setBackendStatus] = useState('checking');
  const [notifPrefs, setNotifPrefs] = useState({
    criticalZones: true,
    highSeverityIncidents: true,
    resourceShortages: true,
    feedDelays: false,
  });

  useEffect(() => {
    const checkBackend = async () => {
      try {
        await api.get('/health');
        setBackendStatus('connected');
      } catch {
        setBackendStatus('disconnected');
      }
    };
    checkBackend();
  }, []);

  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';
  const maskedUrl = apiBaseUrl.replace(/\/\/(.+?)@/, '//***@');

  return (
    <PageContainer title="System Settings">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-4xl">
        
        {/* City Configuration */}
        <div className="bg-navy-800 border border-navy-700 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2 bg-blue-500/10 rounded-lg"><MapPin className="w-5 h-5 text-blue-400" /></div>
            <h3 className="text-white font-medium">City Configuration</h3>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">Selected City</label>
              <p className="text-slate-200 font-medium bg-navy-900 border border-navy-700 rounded-lg px-4 py-2.5">Mysuru, Karnataka</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">Region</label>
              <p className="text-slate-200 font-medium bg-navy-900 border border-navy-700 rounded-lg px-4 py-2.5">South India</p>
            </div>
          </div>
        </div>

        {/* Application Environment */}
        <div className="bg-navy-800 border border-navy-700 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2 bg-purple-500/10 rounded-lg"><Server className="w-5 h-5 text-purple-400" /></div>
            <h3 className="text-white font-medium">Application Environment</h3>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">Environment</label>
              <p className="text-slate-200 font-medium bg-navy-900 border border-navy-700 rounded-lg px-4 py-2.5">Development ({import.meta.env.VITE_APP_PHASE || 'Phase 2'})</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">Backend Status</label>
              <div className={`flex items-center gap-2 bg-navy-900 border border-navy-700 rounded-lg px-4 py-2.5 ${
                backendStatus === 'connected' ? 'text-emerald-400' : 
                backendStatus === 'disconnected' ? 'text-red-400' : 'text-slate-400'
              }`}>
                {backendStatus === 'connected' ? <CheckCircle2 className="w-4 h-4" /> : 
                 backendStatus === 'disconnected' ? <XCircle className="w-4 h-4" /> :
                 <RefreshCw className="w-4 h-4 animate-spin" />}
                <span className="font-medium capitalize">{backendStatus}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Refresh & Data Feeds */}
        <div className="bg-navy-800 border border-navy-700 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2 bg-emerald-500/10 rounded-lg"><Rss className="w-5 h-5 text-emerald-400" /></div>
            <h3 className="text-white font-medium">Data Feeds</h3>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">Frontend Refresh Interval</label>
              <p className="text-slate-200 font-medium bg-navy-900 border border-navy-700 rounded-lg px-4 py-2.5">60 Seconds</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">Simulated Feed Status</label>
              <div className="bg-navy-900 border border-navy-700 rounded-lg px-4 py-2.5 space-y-2">
                {[
                  { name: 'Traffic Data Feed', status: 'Online' },
                  { name: 'Weather Feed', status: 'Online' },
                  { name: 'Incident Reporting', status: 'Online' },
                  { name: 'Hospital Capacity', status: 'Simulated' },
                  { name: 'Emergency Resources', status: 'Simulated' },
                ].map(feed => (
                  <div key={feed.name} className="flex justify-between text-sm">
                    <span className="text-slate-300">{feed.name}</span>
                    <span className={`font-medium ${feed.status === 'Online' ? 'text-emerald-400' : 'text-purple-400'}`}>{feed.status}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Notification Preferences */}
        <div className="bg-navy-800 border border-navy-700 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2 bg-orange-500/10 rounded-lg"><Bell className="w-5 h-5 text-orange-400" /></div>
            <h3 className="text-white font-medium">Notification Preferences</h3>
          </div>
          <div className="space-y-3">
            {[
              { key: 'criticalZones', label: 'Critical Zone Alerts' },
              { key: 'highSeverityIncidents', label: 'High Severity Incidents' },
              { key: 'resourceShortages', label: 'Resource Shortages' },
              { key: 'feedDelays', label: 'Feed Delay Warnings' },
            ].map(pref => (
              <div key={pref.key} className="flex items-center justify-between bg-navy-900 border border-navy-700 rounded-lg px-4 py-3">
                <span className="text-sm text-slate-300">{pref.label}</span>
                <button
                  onClick={() => setNotifPrefs(p => ({ ...p, [pref.key]: !p[pref.key] }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    notifPrefs[pref.key] ? 'bg-blue-600' : 'bg-navy-600'
                  }`}
                  role="switch"
                  aria-checked={notifPrefs[pref.key]}
                  aria-label={`Toggle ${pref.label}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    notifPrefs[pref.key] ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* API Configuration */}
        <div className="bg-navy-800 border border-navy-700 rounded-xl p-6 lg:col-span-2">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2 bg-slate-500/10 rounded-lg"><Globe className="w-5 h-5 text-slate-400" /></div>
            <h3 className="text-white font-medium">API Configuration</h3>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">API Base URL</label>
            <p className="text-slate-200 font-mono text-sm bg-navy-900 border border-navy-700 rounded-lg px-4 py-2.5">{maskedUrl}</p>
          </div>
        </div>
      </div>
    </PageContainer>
  );
};

export default Settings;
