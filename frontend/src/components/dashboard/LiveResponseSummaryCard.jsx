import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Ambulance, MapPinned, Route } from 'lucide-react';
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
        if (active) setError('Live response summary is temporarily unavailable.');
      }
    };
    load();
    return () => { active = false; };
  }, [incident]);

  return (
    <section className="mt-6 bg-navy-800 border border-blue-500/20 rounded-xl p-5" aria-labelledby="live-response-card-title">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-blue-500/10 rounded-lg"><MapPinned className="w-5 h-5 text-blue-400" /></div>
          <div><h3 id="live-response-card-title" className="text-sm font-semibold text-white">Live Response Intelligence</h3><p className="text-xs text-slate-400 mt-1">{incident ? `Latest medical incident #${incident.id}: ${incident.category}` : 'No medical incident with valid coordinates.'}</p></div>
        </div>
        {summary && <div className="grid grid-cols-3 gap-4 text-xs"><div><span className="block text-slate-500">Fastest ambulance</span><span className="font-semibold text-white"><Ambulance className="w-3.5 h-3.5 inline mr-1" />{summary.fastest?.resource_id || 'None eligible'}</span></div><div><span className="block text-slate-500">Traffic</span>{summary.fallback ? <ProvenanceBadge type="fallback" /> : summary.fastest?.live_data ? <ProvenanceBadge type="liveTraffic" /> : <span className="text-slate-400">Unavailable</span>}</div><div><span className="block text-slate-500">Hospitals</span><span className="font-semibold text-white">{summary.hospitals} evaluated</span></div></div>}
        <Link to="/live-response" className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5"><Route className="w-3.5 h-3.5" />Open Live Response</Link>
      </div>
      {error && <p className="text-xs text-amber-300 mt-3" role="status">{error}</p>}
    </section>
  );
};

export default LiveResponseSummaryCard;
