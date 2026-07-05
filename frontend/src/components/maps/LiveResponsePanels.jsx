import { Ambulance, Building2, Gauge } from 'lucide-react';
import ProvenanceBadge from './ProvenanceBadge';
import { formatDistance, formatDuration } from '../../utils/liveResponse';

export const ImpactPanel = ({ impact, durationMs }) => (
  <section className="bg-navy-800 border border-navy-700 rounded-xl p-5" aria-labelledby="impact-title">
    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between mb-4">
      <div>
        <h2 id="impact-title" className="text-base font-semibold text-white flex items-center gap-2"><Gauge className="w-5 h-5 text-emerald-400" />Nearest vs fastest impact</h2>
        <p className="text-xs text-slate-400 mt-1">Calculated only from verified route-matrix distance and duration fields.</p>
      </div>
      {durationMs !== null && <span className="text-[11px] text-slate-500">Decision computed in {durationMs} ms</span>}
    </div>
    {!impact ? <p className="text-sm text-slate-400 py-5">Impact could not be calculated from the available verified route data.</p> : (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded-xl bg-navy-900/60 border border-navy-700 p-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-500">Nearest by routed distance</p>
          <p className="text-lg font-bold text-white mt-2">{impact.nearest.resource_id}</p>
          <p className="text-xs text-slate-300 mt-2">{formatDistance(impact.nearest.distance_meters)} ? {formatDuration(impact.nearest.traffic_duration_seconds)} traffic ETA</p>
        </div>
        <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/20 p-4">
          <p className="text-[10px] uppercase tracking-wider text-emerald-400">Fastest by traffic</p>
          <p className="text-lg font-bold text-white mt-2">{impact.fastest.resource_id}</p>
          <p className="text-xs text-slate-300 mt-2">{formatDuration(impact.fastest.traffic_duration_seconds)} ? {formatDistance(impact.fastest.distance_meters)}</p>
        </div>
        <div className="rounded-xl bg-blue-500/5 border border-blue-500/20 p-4">
          <p className="text-[10px] uppercase tracking-wider text-blue-400">Measured impact</p>
          <p className="text-sm font-semibold text-white mt-2">Traffic changed decision: {impact.changed ? 'Yes' : 'No'}</p>
          <p className="text-xs text-slate-300 mt-2">Estimated time saved: {formatDuration(impact.timeSaved)}</p>
          <p className="text-xs text-slate-300">Traffic delay avoided: {formatDuration(impact.avoidedDelay)}</p>
          {!impact.changed && <p className="text-[11px] text-slate-500 mt-2">Traffic did not change the recommended resource for this scenario.</p>}
        </div>
      </div>
    )}
  </section>
);

export const ResourceRanking = ({ matrix, loading, selectedCode, onSelect, route, routeStatus }) => (
  <section className="bg-navy-800 border border-navy-700 rounded-xl overflow-hidden" aria-labelledby="resource-ranking-title">
    <div className="p-5 border-b border-navy-700 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
      <div><h2 id="resource-ranking-title" className="text-base font-semibold text-white flex items-center gap-2"><Ambulance className="w-5 h-5 text-sky-400" />Eligible ambulance ranking</h2><p className="text-xs text-slate-400 mt-1">Select a ranked ambulance to draw its backend-provided route.</p></div>
      <div>{matrix?.fallback_used ? <ProvenanceBadge type="fallback" /> : matrix?.rankings?.some((item) => item.live_data) && <ProvenanceBadge type="liveTraffic" />}</div>
    </div>
    {loading ? <div className="p-8 text-sm text-slate-400">Comparing eligible routes?</div> : !matrix?.rankings?.length ? (
      <div className="p-8 text-sm text-slate-400">{matrix?.warning?.message || 'No eligible ambulances were returned.'}</div>
    ) : (
      <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead className="bg-navy-900/60 text-slate-500 uppercase"><tr><th className="px-4 py-3">Rank</th><th className="px-4 py-3">Ambulance</th><th className="px-4 py-3">Distance</th><th className="px-4 py-3">Traffic ETA</th><th className="px-4 py-3">Static ETA</th><th className="px-4 py-3">Delay</th><th className="px-4 py-3">Source</th></tr></thead><tbody className="divide-y divide-navy-700/60">
        {matrix.rankings.map((item) => (
          <tr key={item.resource_id} className={`${item.rank === 1 ? 'bg-emerald-500/5' : ''} ${selectedCode === item.resource_id ? 'ring-1 ring-inset ring-blue-500/40' : ''}`}>
            <td className="px-4 py-3"><button type="button" onClick={() => onSelect(item.resource_id)} className="w-7 h-7 rounded-full bg-navy-700 text-white font-bold" aria-label={`Select ambulance ${item.resource_id}, rank ${item.rank}`}>{item.rank}</button></td>
            <td className="px-4 py-3 font-semibold text-white">{item.resource_id}{item.rank === 1 && <span className="ml-2 text-[10px] text-emerald-400">FASTEST</span>}</td>
            <td className="px-4 py-3 text-slate-300">{formatDistance(item.distance_meters)}</td>
            <td className="px-4 py-3 text-slate-100 font-mono">{formatDuration(item.traffic_duration_seconds)}</td>
            <td className="px-4 py-3 text-slate-400">{formatDuration(item.static_duration_seconds)}</td>
            <td className="px-4 py-3 text-amber-300">{formatDuration(item.traffic_delay_seconds)}</td>
            <td className="px-4 py-3">{item.live_data ? <ProvenanceBadge type="liveTraffic" /> : <ProvenanceBadge type="fallback" />}</td>
          </tr>
        ))}
      </tbody></table></div>
    )}
    {routeStatus && <div className="px-5 py-3 border-t border-navy-700 text-xs text-slate-400">{routeStatus}</div>}
    {route && <div className="px-5 py-3 border-t border-navy-700 flex flex-wrap gap-3 text-xs text-slate-300"><span>Selected route: {formatDuration(route.traffic_duration_seconds)}</span><span>Congestion: {route.congestion_level}</span>{route.fallback_used ? <ProvenanceBadge type="fallback" /> : <ProvenanceBadge type="liveTraffic" />}</div>}
  </section>
);

const CapacityBadge = ({ hospital }) => {
  if (hospital.capacity_is_simulated === true) return <ProvenanceBadge type="simulatedCapacity" />;
  if (hospital.capacity_source === 'unknown') return <ProvenanceBadge type="unknownCapacity" />;
  if (hospital.data_provenance?.mapping_verified) return <ProvenanceBadge type="verifiedCapacity" />;
  return <ProvenanceBadge type="unknownCapacity" />;
};

export const HospitalRanking = ({ ranking, error, loading, selectedId, onSelect, route, routeStatus }) => (
  <section className="bg-navy-800 border border-navy-700 rounded-xl overflow-hidden" aria-labelledby="hospital-ranking-title">
    <div className="p-5 border-b border-navy-700 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
      <div><h2 id="hospital-ranking-title" className="text-base font-semibold text-white flex items-center gap-2"><Building2 className="w-5 h-5 text-purple-400" />Hospital intelligence</h2><p className="text-xs text-slate-400 mt-1">Default limit 10. Google identity is separate from CityMind capacity.</p></div>
      <span className="text-xs text-slate-400">{ranking?.hospitals?.length || 0} hospitals evaluated</span>
    </div>
    {error ? <div className="p-8 text-sm text-amber-300">{error}</div> : loading && !ranking ? <div className="p-8 text-sm text-slate-400">Ranking hospitals?</div> : !ranking?.hospitals?.length ? <div className="p-8 text-sm text-slate-400">No hospitals were found for this incident.</div> : (
      <div className="divide-y divide-navy-700/60">{ranking.hospitals.map((hospital) => {
        const stale = hospital.stale_data_warnings?.some((warning) => /older|stale/i.test(warning));
        return (
          <article key={hospital.google_place_id} className={`p-5 ${selectedId === hospital.google_place_id ? 'bg-purple-500/5' : ''}`}>
            <div className="flex flex-col gap-4 lg:flex-row lg:justify-between">
              <div className="min-w-0"><div className="flex items-center gap-2"><button type="button" onClick={() => onSelect(hospital.google_place_id)} className="w-7 h-7 shrink-0 rounded-full bg-navy-700 text-white text-xs font-bold" aria-label={`Select hospital ${hospital.name}, rank ${hospital.rank}`}>{hospital.rank}</button><h3 className="font-semibold text-white truncate">{hospital.name}</h3></div><p className="text-xs text-slate-400 mt-2 ml-9">{hospital.address || 'Address unavailable'}</p><p className="text-xs text-slate-300 mt-2 ml-9">{hospital.recommendation_reason}</p></div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs shrink-0"><div><span className="text-slate-500 block">Traffic ETA</span><span className="text-white font-semibold">{formatDuration(hospital.traffic_duration_seconds)}</span></div><div><span className="text-slate-500 block">Distance</span><span className="text-white font-semibold">{formatDistance(hospital.distance_meters)}</span></div><div><span className="text-slate-500 block">Beds</span><span className="text-white font-semibold">{hospital.available_beds ?? 'Unknown'}</span></div><div><span className="text-slate-500 block">ICU</span><span className="text-white font-semibold">{hospital.icu_available === null ? 'Unknown' : hospital.icu_available ? 'Available' : 'Unavailable'}</span></div></div>
            </div>
            <div className="mt-3 ml-9 flex flex-wrap gap-1.5"><ProvenanceBadge type="googlePlaces" /><CapacityBadge hospital={hospital} />{stale && <ProvenanceBadge type="stale" />}{hospital.data_provenance?.routing_source === 'CityMind estimated fallback' ? <ProvenanceBadge type="fallback" /> : hospital.data_provenance?.routing_source === 'Google Routes API' && <ProvenanceBadge type="liveTraffic" />}</div>
            {hospital.stale_data_warnings?.length > 0 && <ul className="mt-3 ml-9 text-[11px] text-amber-300 space-y-1">{hospital.stale_data_warnings.map((warning) => <li key={warning}>? {warning}</li>)}</ul>}
          </article>
        );
      })}</div>
    )}
    {routeStatus && <div className="px-5 py-3 border-t border-navy-700 text-xs text-slate-400">{routeStatus}</div>}
    {route && <div className="px-5 py-3 border-t border-navy-700 flex flex-wrap gap-3 text-xs text-slate-300"><span>Selected route: {formatDuration(route.traffic_duration_seconds)}</span><span>Congestion: {route.congestion_level}</span>{route.fallback_used ? <ProvenanceBadge type="fallback" /> : <ProvenanceBadge type="liveTraffic" />}</div>}
  </section>
);
