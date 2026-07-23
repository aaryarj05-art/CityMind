import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Brain, Clock3, MapPinned, Navigation, RefreshCw, Route, Search, ShieldCheck } from 'lucide-react';
import PageContainer from '../components/layout/PageContainer';
import LiveOperationsMap from '../components/maps/LiveOperationsMap';
import { HospitalRanking, ImpactPanel, ResourceRanking } from '../components/maps/LiveResponsePanels';
import { allocationAPI, areasAPI, hospitalsAPI, incidentsAPI, mapsAPI, resourcesAPI } from '../services/api';
import { apiMessage, validCoordinates } from '../utils/liveResponse';

const LiveResponseIntelligence = () => {
  const navigate = useNavigate();
  const [incidents, setIncidents] = useState([]);
  const [areas, setAreas] = useState([]);
  const [selectedIncidentId, setSelectedIncidentId] = useState('');
  const [incidentLoading, setIncidentLoading] = useState(true);
  const [incidentError, setIncidentError] = useState('');
  const [decisionLoading, setDecisionLoading] = useState(false);
  const [decisionError, setDecisionError] = useState('');
  const [hospitalError, setHospitalError] = useState('');
  const [matrix, setMatrix] = useState(null);
  const [hospitalRanking, setHospitalRanking] = useState(null);
  const [decisionDurationMs, setDecisionDurationMs] = useState(null);
  const [selectedResourceCode, setSelectedResourceCode] = useState('');
  const [selectedHospitalId, setSelectedHospitalId] = useState('');
  const [ambulanceRoute, setAmbulanceRoute] = useState(null);
  const [hospitalRoute, setHospitalRoute] = useState(null);
  const [routeStatus, setRouteStatus] = useState({ ambulance: '', hospital: '' });
  const [incidentSearch, setIncidentSearch] = useState('');
  const [contextSearch, setContextSearch] = useState('');
  const routeCache = useRef(new Map());

  const selectedIncident = useMemo(
    () => incidents.find((item) => String(item.id) === String(selectedIncidentId)) || null,
    [incidents, selectedIncidentId],
  );
  const areaById = useMemo(() => Object.fromEntries(areas.map((area) => [area.id, area])), [areas]);
  const filteredIncidents = useMemo(() => {
    const query = incidentSearch.trim().toLowerCase();
    if (!query) return incidents;
    return incidents.filter((incident) => {
      const areaName = areaById[incident.area_id]?.name || '';
      return [incident.id, incident.title, incident.category, incident.severity, areaName]
        .some((value) => String(value || '').toLowerCase().includes(query));
    });
  }, [areaById, incidents, incidentSearch]);

  useEffect(() => {
    let active = true;
    Promise.all([incidentsAPI.getAll(), areasAPI.getAll()])
      .then(([incidentResponse, areaResponse]) => {
        if (!active) return;
        const valid = incidentResponse.data.filter(validCoordinates)
          .sort((a, b) => new Date(b.reported_at) - new Date(a.reported_at));
        setIncidents(valid);
        setAreas(areaResponse.data);
        const preferred = valid.find((item) => ['Medical Emergency', 'Road Accident'].includes(item.category)) || valid[0];
        setSelectedIncidentId(preferred ? String(preferred.id) : '');
        if (!valid.length) setIncidentError('No incidents with valid coordinates are available.');
      })
      .catch((error) => active && setIncidentError(apiMessage(error, 'Failed to load incidents.')))
      .finally(() => active && setIncidentLoading(false));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!selectedIncident) return undefined;
    let active = true;
    const loadDecision = async () => {
      const started = performance.now();
      setDecisionLoading(true);
      setDecisionError('');
      setHospitalError('');
      setMatrix(null);
      setHospitalRanking(null);
      setAmbulanceRoute(null);
      setHospitalRoute(null);
      setSelectedResourceCode('');
      setSelectedHospitalId('');
      const supportsHospitalRanking = ['Medical Emergency', 'Road Accident'].includes(selectedIncident.category);
      const [planResult, resourcesResult, hospitalResult] = await Promise.allSettled([
        allocationAPI.getPlan(selectedIncident.id),
        resourcesAPI.getPage({ category: 'Ambulance', status: 'Available', page_size: 100 }),
        supportsHospitalRanking ? hospitalsAPI.rankLive(selectedIncident.id, 10) : Promise.resolve(null),
      ]);
      if (!active) return;

      if (!supportsHospitalRanking) {
        setHospitalError('Live hospital ranking applies only to Medical Emergency and Road Accident incidents. No ranking request was sent.');
      } else if (hospitalResult.status === 'fulfilled') {
        setHospitalRanking(hospitalResult.value.data);
        setSelectedHospitalId(hospitalResult.value.data.hospitals?.[0]?.google_place_id || '');
      } else {
        setHospitalError(hospitalResult.reason?.response?.status === 422
          ? 'The hospital ranking request was rejected as invalid. Select a valid medical incident and retry.'
          : apiMessage(hospitalResult.reason, 'Hospital ranking is unavailable.'));
      }

      if (planResult.status !== 'fulfilled' || resourcesResult.status !== 'fulfilled') {
        setDecisionError(apiMessage(
          planResult.status === 'rejected' ? planResult.reason : resourcesResult.reason,
          'Resource eligibility data is unavailable.',
        ));
        setDecisionDurationMs(Math.round(performance.now() - started));
        setDecisionLoading(false);
        return;
      }

      const eligibleCodes = new Set((planResult.value.data.candidates || [])
        .filter((item) => item.eligible && item.resource_type === 'Ambulance')
        .slice(0, 8)
        .map((item) => item.resource_code));
      const eligible = resourcesResult.value.data.items.filter((resource) => eligibleCodes.has(resource.resource_code) && validCoordinates(resource));
      if (!eligible.length) {
        setMatrix({ rankings: [], fallback_used: false, retrieved_at: new Date().toISOString(), warning: { code: 'no_eligible_resources', message: 'No eligible ambulances were confirmed by CityMind allocation rules.' } });
      } else {
        try {
          const response = await mapsAPI.getRouteMatrix({
            origins: eligible.map((resource) => ({ resource_id: resource.resource_code, latitude: resource.latitude, longitude: resource.longitude })),
            destination: { latitude: selectedIncident.latitude, longitude: selectedIncident.longitude },
            incident_id: selectedIncident.id,
            required_resource_type: 'Ambulance',
          });
          if (!active) return;
          const resourcesByCode = Object.fromEntries(eligible.map((resource) => [resource.resource_code, resource]));
          const rankings = response.data.rankings.map((item) => ({ ...item, latitude: resourcesByCode[item.resource_id]?.latitude, longitude: resourcesByCode[item.resource_id]?.longitude }));
          setMatrix({ ...response.data, rankings });
          setSelectedResourceCode(rankings[0]?.resource_id || '');
        } catch (error) {
          setDecisionError(apiMessage(error, 'Route comparison failed.'));
        }
      }
      if (active) {
        setDecisionDurationMs(Math.round(performance.now() - started));
        setDecisionLoading(false);
      }
    };
    loadDecision();
    return () => { active = false; };
  }, [selectedIncident]);

  const selectedResource = useMemo(
    () => matrix?.rankings?.find((item) => item.resource_id === selectedResourceCode) || null,
    [matrix, selectedResourceCode],
  );
  const selectedHospital = useMemo(
    () => hospitalRanking?.hospitals?.find((item) => item.google_place_id === selectedHospitalId) || null,
    [hospitalRanking, selectedHospitalId],
  );
  const visibleMatrix = useMemo(() => {
    const query = contextSearch.trim().toLowerCase();
    if (!query || !matrix?.rankings) return matrix;
    return {
      ...matrix,
      rankings: matrix.rankings.filter((item) => [item.resource_id, item.source, item.congestion_level]
        .some((value) => String(value || '').toLowerCase().includes(query))),
    };
  }, [contextSearch, matrix]);
  const visibleHospitalRanking = useMemo(() => {
    const query = contextSearch.trim().toLowerCase();
    if (!query || !hospitalRanking?.hospitals) return hospitalRanking;
    return {
      ...hospitalRanking,
      hospitals: hospitalRanking.hospitals.filter((item) => [item.name, item.vicinity, item.address, item.capacity_source, item.google_place_id]
        .some((value) => String(value || '').toLowerCase().includes(query))),
    };
  }, [contextSearch, hospitalRanking]);

  useEffect(() => {
    if (!selectedIncident || !validCoordinates(selectedResource)) return undefined;
    let active = true;
    const key = `ambulance:${selectedIncident.id}:${selectedResource.resource_id}`;
    const load = async () => {
      setRouteStatus((current) => ({ ...current, ambulance: 'Loading selected ambulance route?' }));
      try {
        const cached = routeCache.current.get(key);
        const data = cached || (await mapsAPI.getRoute({
          origin: { latitude: selectedResource.latitude, longitude: selectedResource.longitude },
          destination: { latitude: selectedIncident.latitude, longitude: selectedIncident.longitude },
        })).data;
        routeCache.current.set(key, data);
        if (active) { setAmbulanceRoute(data); setRouteStatus((current) => ({ ...current, ambulance: '' })); }
      } catch (error) {
        if (active) { setAmbulanceRoute(null); setRouteStatus((current) => ({ ...current, ambulance: apiMessage(error, 'Ambulance route unavailable.') })); }
      }
    };
    load();
    return () => { active = false; };
  }, [selectedIncident, selectedResource]);

  useEffect(() => {
    if (!selectedIncident || !validCoordinates(selectedHospital)) return undefined;
    let active = true;
    const key = `hospital:${selectedIncident.id}:${selectedHospital.google_place_id}`;
    const load = async () => {
      setRouteStatus((current) => ({ ...current, hospital: 'Loading selected hospital route?' }));
      try {
        const cached = routeCache.current.get(key);
        const data = cached || (await mapsAPI.getRoute({
          origin: { latitude: selectedIncident.latitude, longitude: selectedIncident.longitude },
          destination: { latitude: selectedHospital.latitude, longitude: selectedHospital.longitude },
        })).data;
        routeCache.current.set(key, data);
        if (active) { setHospitalRoute(data); setRouteStatus((current) => ({ ...current, hospital: '' })); }
      } catch (error) {
        if (active) { setHospitalRoute(null); setRouteStatus((current) => ({ ...current, hospital: apiMessage(error, 'Hospital route unavailable.') })); }
      }
    };
    load();
    return () => { active = false; };
  }, [selectedIncident, selectedHospital]);

  const impact = useMemo(() => {
    if (!matrix?.rankings?.length) return null;
    const nearest = [...matrix.rankings].sort((a, b) => a.distance_meters - b.distance_meters || a.rank - b.rank)[0];
    const fastest = [...matrix.rankings].sort((a, b) => a.traffic_duration_seconds - b.traffic_duration_seconds || a.rank - b.rank)[0];
    return {
      nearest,
      fastest,
      changed: nearest.resource_id !== fastest.resource_id,
      timeSaved: Math.max(nearest.traffic_duration_seconds - fastest.traffic_duration_seconds, 0),
      avoidedDelay: Math.max((nearest.traffic_delay_seconds || 0) - (fastest.traffic_delay_seconds || 0), 0),
    };
  }, [matrix]);

  const explainWithAI = () => selectedIncident && navigate('/ai-command-center', {
    state: { preparedPrompt: `For incident ${selectedIncident.id}, compare eligible ambulances using live traffic, rank nearby hospitals, explain which data is live, simulated or unknown, and do not claim dispatch occurred.` },
  });

  return (
    <PageContainer title="Live Response Intelligence">
      <div className="space-y-6">
        <div className="rounded-xl border border-cyan-400/15 bg-cyan-400/5 p-4 text-xs leading-relaxed text-cyan-100">Data provenance: Google Maps, Routes, and Places provide live or near-live map, routing, traffic, and facility-location intelligence where available. CityMind uses simulated vehicle availability, staffing, dispatch state, and hospital capacity for safe prototype demonstration.</div>
        <section className="glass-panel p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl"><p className="flex items-center gap-2 text-blue-300 text-xs font-semibold uppercase tracking-wider"><Navigation className="w-4 h-4" />Phase 5C decision surface</p><h1 className="text-2xl font-bold text-white mt-2">Traffic-aware response and hospital intelligence</h1><p className="text-sm text-slate-400 mt-2">Compare eligible ambulances, inspect real hospital identities, and review provenance before human approval.</p></div>
            <div className="flex gap-2"><button type="button" onClick={() => window.location.reload()} className="cm-button" aria-label="Refresh verified response intelligence"><RefreshCw className="w-4 h-4 inline mr-1.5" />Refresh</button><button type="button" onClick={explainWithAI} disabled={!selectedIncident} className="cm-button cm-button-primary" aria-label="Explain selected incident with CityMind AI"><Brain className="w-4 h-4 inline mr-1.5" />Explain with CityMind AI</button></div>
          </div>
        </section>

        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-xs text-amber-100 flex gap-2" role="note"><ShieldCheck className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" /><span>Live Google traffic and hospital identity are combined with CityMind operational records. Bed availability may be simulated or unknown. All dispatch decisions require human confirmation.</span></div>

        <section className="glass-panel p-5">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)]">
            <div>
              <label htmlFor="incident-search" className="cm-section-label">Search incident</label>
              <div className="relative mt-2">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input id="incident-search" value={incidentSearch} onChange={(event) => setIncidentSearch(event.target.value)} placeholder="Search by ID, area, category, or severity" className="cm-input w-full pl-9" />
              </div>
              <p id="incident-help" className="mt-2 text-[11px] text-slate-500">Only incidents with valid coordinates are shown. The latest medical incident is selected when available.</p>
            </div>
            <div>
              <label htmlFor="incident-selector" className="cm-section-label">Selected incident</label>
              <select id="incident-selector" value={selectedIncidentId} onChange={(event) => setSelectedIncidentId(event.target.value)} disabled={incidentLoading || !incidents.length} className="cm-input mt-2 w-full" aria-describedby="incident-help">
                {!incidents.length && <option value="">No valid incidents available</option>}
                {filteredIncidents.map((incident) => <option key={incident.id} value={incident.id}>#{incident.id} · {incident.category} · {incident.severity} · {areaById[incident.area_id]?.name || `Area ${incident.area_id ?? 'unknown'}`}</option>)}
              </select>
            </div>
          </div>
          <div className="mt-4">
            <label htmlFor="context-search" className="cm-section-label">Map and context search</label>
            <div className="relative mt-2">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input id="context-search" value={contextSearch} onChange={(event) => setContextSearch(event.target.value)} placeholder="Search area, incident, hospital, or resource..." className="cm-input w-full pl-9" />
            </div>
          </div>
          {incidentError && <p className="mt-2 text-xs text-red-300" role="alert">{incidentError}</p>}
          {selectedIncident && <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-300"><span className="cm-source-pill font-semibold text-white">#{selectedIncident.id} {selectedIncident.title}</span><span className="cm-source-pill">{selectedIncident.category}</span><span className="cm-source-pill">{selectedIncident.severity}</span><span className="cm-source-pill">{Number(selectedIncident.latitude).toFixed(4)}, {Number(selectedIncident.longitude).toFixed(4)}</span></div>}
        </section>
        <div aria-live="polite" className="sr-only">{decisionLoading ? 'Computing verified response intelligence' : decisionError || hospitalError || 'Verified response intelligence updated'}</div>
        {decisionError && <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-300" role="alert"><AlertTriangle className="w-4 h-4 inline mr-2" />{decisionError}</div>}

        <LiveOperationsMap incident={selectedIncident} resources={visibleMatrix?.rankings || []} hospitals={visibleHospitalRanking?.hospitals || []} matrix={visibleMatrix} hospitalRanking={visibleHospitalRanking} ambulanceRoute={ambulanceRoute} hospitalRoute={hospitalRoute} selectedResourceCode={selectedResourceCode} selectedHospitalId={selectedHospitalId} onSelectResource={(item) => setSelectedResourceCode(item.resource_id)} onSelectHospital={(item) => setSelectedHospitalId(item.google_place_id)} />
        <ImpactPanel impact={impact} durationMs={decisionDurationMs} />
        <ResourceRanking matrix={visibleMatrix} loading={decisionLoading} selectedCode={selectedResourceCode} onSelect={setSelectedResourceCode} route={ambulanceRoute} routeStatus={routeStatus.ambulance} />
        <HospitalRanking ranking={visibleHospitalRanking} error={hospitalError} loading={decisionLoading} selectedId={selectedHospitalId} onSelect={setSelectedHospitalId} route={hospitalRoute} routeStatus={routeStatus.hospital} />

        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-navy-800 border border-navy-700 rounded-xl p-4"><Clock3 className="w-5 h-5 text-blue-400" /><p className="text-[10px] text-slate-500 uppercase mt-3">Decision computation</p><p className="text-xl font-bold text-white mt-1">{decisionDurationMs === null ? '?' : `${decisionDurationMs} ms`}</p></div>
          <div className="bg-navy-800 border border-navy-700 rounded-xl p-4"><Route className="w-5 h-5 text-emerald-400" /><p className="text-[10px] text-slate-500 uppercase mt-3">Traffic status</p><p className="text-sm font-bold text-white mt-1">{matrix?.fallback_used ? 'Fallback estimate used' : matrix?.rankings?.some((item) => item.live_data) ? 'Live Google traffic' : 'Unavailable'}</p></div>
          <div className="bg-navy-800 border border-navy-700 rounded-xl p-4"><MapPinned className="w-5 h-5 text-purple-400" /><p className="text-[10px] text-slate-500 uppercase mt-3">Hospitals evaluated</p><p className="text-xl font-bold text-white mt-1">{hospitalRanking?.hospitals?.length || 0}</p></div>
        </section>
      </div>
    </PageContainer>
  );
};

export default LiveResponseIntelligence;
