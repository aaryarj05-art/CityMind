import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Ambulance, MapPinned, Route, ShieldCheck } from 'lucide-react';
import { allocationAPI, hospitalsAPI, mapsAPI, resourcesAPI } from '../../services/api';
import { validCoordinates } from '../../utils/liveResponse';
import ProvenanceBadge from '../maps/ProvenanceBadge';

const LiveResponseSummaryCard = ({ incident }) => {
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!incident || !validCoordinates(incident)) return undefined;
    let active = true;
    const load = async () => {
      setError('');
      try {
        const [planResponse, resourceResponse, hospitalResponse] = await Promise.all([
          allocationAPI.getPlan(incident.id),
          resourcesAPI.getAll(),
          hospitalsAPI.rankLive({ incident_id: incident.id, limit: 10 }),
        ]);
        const eligibleCodes = new Set((planResponse.data.candidates || [])
          .filter((item) => item.eligible && item.resource_type === 'Ambulance')
          .map((item) => item.resource_code));
        const eligible = resourceResponse.data.filter((item) => eligibleCodes.has(item.resource_code) && validCoordinates(item));
        const matrixResponse = eligible.length ? await mapsAPI.getRouteMatrix({
          origins: eligible.map((item) => ({ resource_id: item.resource_code, latitude: item.latitude, longitude: item.longitude })),
          destination: { latitude: incident.latitude, longitude: incident.longitude },
          incident_id: incident.id,
          required_resource_type: 'Ambulance',
        }) : { data: { rankings: [], fallback_used: false } };
        if (active) setSummary({
          fastest: matrixResponse.data.rankings?.[0] || null,
          fallback: matrixResponse.data.fallback_used,
          hospitals: hospitalResponse.data.hospitals?.length || 0,
        });
      } catch {
        if (active) setError('fallback');
      }
    };
    load();
    return () => { active = false; };
  }, [incident]);

  return (
    <section className="glass-panel mt-6 p-5" aria-labelledby="live-response-card-title">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-xl border border-cyan-300/15 bg-cyan-400/10 p-2"><MapPinned className="h-5 w-5 text-cyan-300" /></div>
          <div>
            <p className="cm-section-label">Live Response Intelligence</p>
            <h3 id="live-response-card-title" className="mt-1 text-sm font-semibold text-white">Traffic-aware response summary</h3>
            <p className="mt-1 text-xs text-slate-400">
              {incident ? `Latest medical incident #${incident.id}: ${incident.category}` : 'No medical incident with valid coordinates.'}
            </p>
          </div>
        </div>
        {summary && (
          <div className="grid grid-cols-3 gap-4 text-xs">
            <div><span className="block text-slate-500">Fastest ambulance</span><span className="font-semibold text-white"><Ambulance className="mr-1 inline h-3.5 w-3.5" />{summary.fastest?.resource_id || 'None eligible'}</span></div>
            <div><span className="block text-slate-500">Traffic</span>{summary.fallback ? <ProvenanceBadge type="fallback" /> : summary.fastest?.live_data ? <ProvenanceBadge type="liveTraffic" /> : <span className="text-slate-400">Unavailable</span>}</div>
            <div><span className="block text-slate-500">Hospitals</span><span className="font-semibold text-white">{summary.hospitals} evaluated</span></div>
          </div>
        )}
        <Link to="/live-response" className="cm-button cm-button-primary"><Route className="h-3.5 w-3.5" />Open Live Response</Link>
      </div>
      {error && (
        <div className="mt-4 rounded-xl border border-blue-300/10 bg-navy-950/45 p-4 text-xs text-slate-300" role="status">
          <div className="flex gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" /><div><p className="font-semibold text-white">Current focus: Lashkar Mohalla is the highest-risk area.</p><p className="mt-1">Recommended next step: Review active incidents and open Live Response Intelligence.</p><p className="mt-1 text-slate-500">Data note: Traffic and hospital location intelligence use live Google services where available; capacity and unit availability are prototype planning data.</p></div></div>
        </div>
      )}
    </section>
  );
};

export default LiveResponseSummaryCard;