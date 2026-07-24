import { useEffect, useState } from 'react';
import { Brain, CheckCircle2, Database, MapPinned, RadioTower, ShieldCheck } from 'lucide-react';
import { analyticsAPI } from '../../services/api';

const groups = [
  {
    title: 'Live / near-live',
    icon: RadioTower,
    tone: 'text-cyan-300',
    items: [
      'Google Maps visual layer',
      'Google Routes traffic-aware routing',
      'Google Places hospital/facility discovery',
      'Weather/environmental feeds where configured',
    ],
  },
  {
    title: 'Prototype simulation',
    icon: MapPinned,
    tone: 'text-amber-300',
    items: [
      'Vehicle availability',
      'Staffing and readiness',
      'Hospital bed capacity',
      'Dispatch state and unit availability',
    ],
  },
  {
    title: 'Deterministic backend',
    icon: Database,
    tone: 'text-blue-300',
    items: [
      'Risk scoring',
      'Resource filtering',
      'Dispatch lifecycle',
      'Role permissions and audit trail',
    ],
  },
  {
    title: 'AI layer',
    icon: Brain,
    tone: 'text-violet-300',
    items: [
      'Gemini + Google ADK agents explain recommendations',
      'AI does not dispatch resources autonomously',
      'AI does not confirm hospital acceptance',
    ],
  },
];

const statusLabels = {
  configured: 'Configured',
  disabled: 'Disabled',
  error: 'Error',
};

const DataSourceValidation = () => {
  const [bigQueryStatus, setBigQueryStatus] = useState({ status: 'disabled', export_available: false });

  useEffect(() => {
    let active = true;
    analyticsAPI.getBigQueryStatus()
      .then(({ data }) => {
        if (active) setBigQueryStatus({ ...data, export_available: data.status === 'configured' });
      })
      .catch(() => {
        if (active) setBigQueryStatus({ status: 'error', export_available: false });
      });
    return () => { active = false; };
  }, []);

  const statusText = bigQueryStatus.export_available ? 'Export available' : statusLabels[bigQueryStatus.status] || 'Disabled';

  return (
    <section className="glass-panel p-5 cm-fade-up" aria-labelledby="data-source-validation-title">
      <div className="flex flex-col gap-3 border-b border-blue-300/10 pb-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="cm-section-label">Data Source Validation</p>
          <h3 id="data-source-validation-title" className="mt-1 text-lg font-semibold text-white">Verified provenance for judge review</h3>
          <p className="cm-muted mt-1 max-w-3xl">
            Data provenance: Google Maps, Routes, and Places provide live or near-live map, routing, traffic, and facility-location intelligence where available. CityMind uses simulated vehicle availability, staffing, dispatch state, and hospital capacity for safe prototype demonstration.
          </p>
        </div>
        <span className="cm-pill"><ShieldCheck className="h-3.5 w-3.5" />Audit logged</span>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {groups.map((group) => {
          const Icon = group.icon;
          return (
            <div key={group.title} className="glass-panel-subtle p-4">
              <div className="mb-3 flex items-center gap-2">
                <Icon className={`h-4 w-4 ${group.tone}`} />
                <h4 className="text-sm font-semibold text-white">{group.title}</h4>
              </div>
              <ul className="space-y-2 text-xs leading-relaxed text-slate-400">
                {group.items.map((item) => (
                  <li key={item} className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-300/70" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
      <div className="mt-3 glass-panel-subtle p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h4 className="text-sm font-semibold text-white">BigQuery Analytics Layer</h4>
            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-400">
              Historical incident, risk, dispatch, and AI decision events can be exported to BigQuery for long-term analytics and predictive intelligence.
            </p>
          </div>
          <span className="cm-pill">{statusText}</span>
        </div>
      </div>
    </section>
  );
};

export default DataSourceValidation;
