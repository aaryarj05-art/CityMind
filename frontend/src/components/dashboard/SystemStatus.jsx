import { Activity, AlertTriangle, CheckCircle2, MapPinned, RadioTower, XCircle } from 'lucide-react';

const FEED_COPY = {
  'Traffic Data Feed': { label: 'Traffic Data Feed', status: 'Online', detail: 'Live Google Routes', icon: RadioTower },
  'Incident Reporting': { label: 'Incident Reporting', status: 'Online', detail: 'Deterministic backend intake', icon: CheckCircle2 },
  'Hospital Locations': { label: 'Hospital Locations', status: 'Near-live', detail: 'Google Places facility data', icon: MapPinned },
  'Hospital Capacity': { label: 'Hospital Capacity', status: 'Prototype', detail: 'Simulated planning data', icon: Activity },
  'Emergency Resource Locations': { label: 'Emergency Resource Locations', status: 'Reference', detail: 'Seeded/public directory data', icon: MapPinned },
  'Emergency Unit Availability': { label: 'Emergency Unit Availability', status: 'Prototype', detail: 'Simulated planning data', icon: Activity },
};

const normalizeFeed = (feed, status) => {
  const configured = FEED_COPY[feed];
  if (configured) return configured;
  if (String(feed).toLowerCase().includes('traffic')) return FEED_COPY['Traffic Data Feed'];
  if (String(feed).toLowerCase().includes('hospital')) return FEED_COPY['Hospital Locations'];
  if (String(feed).toLowerCase().includes('resource')) return FEED_COPY['Emergency Unit Availability'];
  return { label: feed, status: status || 'Online', detail: 'Backend feed status', icon: Activity };
};

const getStatusTone = (status) => {
  switch (status) {
    case 'Online': return 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300';
    case 'Near-live': return 'border-cyan-400/20 bg-cyan-400/10 text-cyan-300';
    case 'Prototype': return 'border-amber-400/20 bg-amber-400/10 text-amber-300';
    case 'Reference': return 'border-blue-400/20 bg-blue-400/10 text-blue-300';
    case 'Delayed': return 'border-orange-400/20 bg-orange-400/10 text-orange-300';
    case 'Offline': return 'border-red-400/25 bg-red-400/10 text-red-300';
    default: return 'border-slate-400/15 bg-slate-400/10 text-slate-300';
  }
};

const SystemStatus = ({ statuses = {} }) => {
  const entries = Object.keys(statuses).length
    ? Object.entries(statuses).map(([feed, status]) => normalizeFeed(feed, status))
    : Object.values(FEED_COPY);

  return (
    <div className="glass-panel p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="cm-section-label">Data Feeds</p>
          <h3 className="mt-1 font-semibold text-white">Source status</h3>
        </div>
        <span className="cm-source-pill">Provenance labeled</span>
      </div>
      <div className="space-y-3">
        {entries.map((feed) => {
          const Icon = feed.icon || (feed.status === 'Offline' ? XCircle : feed.status === 'Delayed' ? AlertTriangle : Activity);
          return (
            <div key={feed.label} className="glass-panel-subtle flex items-center justify-between gap-3 p-3">
              <div className="flex min-w-0 items-center gap-3">
                <Icon className="h-4 w-4 shrink-0 text-cyan-300" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-200">{feed.label}</p>
                  <p className="truncate text-[11px] text-slate-500">{feed.detail}</p>
                </div>
              </div>
              <span className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${getStatusTone(feed.status)}`}>
                {feed.status}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SystemStatus;