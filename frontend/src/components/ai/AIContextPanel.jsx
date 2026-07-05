import { useEffect, useState } from 'react';
import { AlertTriangle, Activity, Send, Users, Siren, TrendingUp } from 'lucide-react';
import { riskAPI, dispatchAPI } from '../../services/api';

const AIContextPanel = () => {
  const [data, setData] = useState(null);

  useEffect(() => {
    const fetch = async () => {
      try {
        const [summaryRes, areasRes, incidentsRes, dispSummaryRes] = await Promise.allSettled([
          riskAPI.getSummary(),
          riskAPI.getAreas(),
          riskAPI.getIncidents(),
          dispatchAPI.getSummary(),
        ]);

        const ctx = {};

        if (summaryRes.status === 'fulfilled') {
          const s = summaryRes.value.data;
          ctx.avgRisk = s.average_city_risk_score?.toFixed(1) || '—';
        }

        if (areasRes.status === 'fulfilled') {
          const areas = areasRes.value.data;
          const sorted = [...areas].sort((a, b) => b.risk_score - a.risk_score);
          ctx.highestArea = sorted[0]?.area_name || '—';
        }

        if (incidentsRes.status === 'fulfilled') {
          const incs = incidentsRes.value.data;
          ctx.immediateCount = incs.filter(i => i.priority_level === 'Immediate').length;
        }

        if (dispSummaryRes.status === 'fulfilled') {
          const d = dispSummaryRes.value.data;
          ctx.activeDispatches = d.active_dispatches ?? 0;
          ctx.assignedResources = d.assigned_resources ?? 0;
          ctx.shortages = d.active_shortages ?? 0;
        }

        setData(ctx);
      } catch {
        // Non-critical panel
      }
    };
    fetch();
  }, []);

  if (!data) return null;

  const items = [
    { label: 'Avg City Risk', value: data.avgRisk || '—', icon: TrendingUp, color: 'text-red-400' },
    { label: 'Highest Risk', value: data.highestArea || '—', icon: AlertTriangle, color: 'text-orange-400' },
    { label: 'Active Dispatches', value: data.activeDispatches ?? '—', icon: Send, color: 'text-blue-400' },
    { label: 'Assigned Resources', value: data.assignedResources ?? '—', icon: Users, color: 'text-cyan-400' },
    { label: 'Immediate Incidents', value: data.immediateCount ?? '—', icon: Activity, color: 'text-yellow-400' },
    { label: 'Shortages', value: data.shortages ?? '—', icon: Siren, color: 'text-pink-400' },
  ];

  return (
    <div className="space-y-2">
      <p className="text-[11px] text-slate-500 uppercase tracking-wider font-medium">Operational Context</p>
      <div className="grid grid-cols-2 gap-1.5">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="flex items-center gap-2 px-2.5 py-1.5 bg-navy-900/50 border border-navy-700 rounded-lg">
              <Icon className={`w-3 h-3 ${item.color} flex-shrink-0`} />
              <div className="min-w-0">
                <p className="text-[10px] text-slate-500 truncate">{item.label}</p>
                <p className="text-xs text-slate-200 font-semibold truncate">{item.value}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AIContextPanel;
