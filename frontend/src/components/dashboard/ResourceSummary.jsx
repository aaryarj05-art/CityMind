import { Shield, Truck, Siren } from 'lucide-react';

const clampPercent = (available, total) => {
  if (!Number.isFinite(total) || total <= 0) return 0;
  const value = (Number(available || 0) / total) * 100;
  return Math.min(100, Math.max(0, Math.round(value)));
};

const ResourceSummary = ({ summary = {} }) => {
  const resources = [
    { key: 'ambulances', label: 'Ambulances', icon: Siren, color: 'from-red-500 to-orange-400', iconColor: 'text-red-300' },
    { key: 'police', label: 'Police Units', icon: Shield, color: 'from-blue-500 to-cyan-400', iconColor: 'text-blue-300' },
    { key: 'fire', label: 'Fire Engines', icon: Truck, color: 'from-orange-500 to-amber-300', iconColor: 'text-orange-300' },
  ];

  return (
    <div className="glass-panel p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="cm-section-label">Emergency Resources</p>
          <h3 className="mt-1 font-semibold text-white">Operational readiness</h3>
        </div>
        <span className="cm-source-pill">Simulated planning data</span>
      </div>
      <div className="space-y-4">
        {resources.map((res) => {
          const data = summary[res.key] || { total: 0, available: 0 };
          const total = Number(data.total || 0);
          const available = Number(data.available || 0);
          const percent = clampPercent(available, total);
          const Icon = res.icon;

          return (
            <div key={res.key} className="glass-panel-subtle p-3">
              <div className="mb-2 flex items-center justify-between gap-3 text-sm text-slate-300">
                <div className="flex min-w-0 items-center gap-2">
                  <div className="rounded-lg border border-blue-300/10 bg-navy-950/50 p-1.5">
                    <Icon className={`h-4 w-4 ${res.iconColor}`} />
                  </div>
                  <span className="truncate font-medium">{res.label}</span>
                </div>
                <span className="shrink-0 text-xs text-slate-400"><b className="text-white">{available}</b> / {total} available</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full border border-blue-300/10 bg-navy-950/80">
                <div
                  className={`h-full rounded-full bg-gradient-to-r ${res.color} shadow-sm transition-all duration-200`}
                  style={{ width: `${percent}%` }}
                  aria-label={`${res.label} availability ${percent}%`}
                />
              </div>
              <div className="mt-1.5 flex justify-between text-[10px] text-slate-500">
                <span>0%</span>
                <span>{percent}% ready</span>
                <span>100%</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ResourceSummary;