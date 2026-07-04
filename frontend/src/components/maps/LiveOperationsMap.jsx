import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  GoogleMap,
  MarkerF,
  PolylineF,
  TrafficLayer,
  useJsApiLoader,
} from '@react-google-maps/api';
import { AlertTriangle, Layers3, Loader2, MapPinned } from 'lucide-react';
import ProvenanceBadge from './ProvenanceBadge';

const DEFAULT_CENTER = { lat: 12.2958, lng: 76.6394 };
const LIBRARIES = ['geometry'];
const MAP_OPTIONS = {
  clickableIcons: false,
  fullscreenControl: true,
  mapTypeControl: false,
  streetViewControl: false,
  styles: [
    { elementType: 'geometry', stylers: [{ color: '#182332' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#cbd5e1' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#182332' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#314863' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0b111b' }] },
  ],
};

const validPoint = (latitude, longitude) => (
  Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude))
  && Number(latitude) >= -90 && Number(latitude) <= 90
  && Number(longitude) >= -180 && Number(longitude) <= 180
);

const decodePolyline = (encoded, isLoaded) => {
  if (!encoded || !isLoaded || !window.google?.maps?.geometry?.encoding) return [];
  return window.google.maps.geometry.encoding.decodePath(encoded);
};

const MapCanvas = ({
  apiKey,
  incident,
  resources,
  hospitals,
  ambulanceRoute,
  hospitalRoute,
  selectedResourceCode,
  selectedHospitalId,
  onSelectResource,
  onSelectHospital,
}) => {
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'citymind-google-maps-script',
    googleMapsApiKey: apiKey,
    libraries: LIBRARIES,
  });
  const [map, setMap] = useState(null);
  const [trafficEnabled, setTrafficEnabled] = useState(true);

  const ambulancePath = useMemo(
    () => decodePolyline(ambulanceRoute?.encoded_polyline, isLoaded),
    [ambulanceRoute?.encoded_polyline, isLoaded],
  );
  const hospitalPath = useMemo(
    () => decodePolyline(hospitalRoute?.encoded_polyline, isLoaded),
    [hospitalRoute?.encoded_polyline, isLoaded],
  );

  const onLoad = useCallback((instance) => setMap(instance), []);
  const onUnmount = useCallback(() => setMap(null), []);

  useEffect(() => {
    if (!map || !window.google) return;
    const bounds = new window.google.maps.LatLngBounds();
    let points = 0;
    const extend = (latitude, longitude) => {
      if (!validPoint(latitude, longitude)) return;
      bounds.extend({ lat: Number(latitude), lng: Number(longitude) });
      points += 1;
    };
    if (incident) extend(incident.latitude, incident.longitude);
    resources.forEach((item) => extend(item.latitude, item.longitude));
    hospitals.forEach((item) => extend(item.latitude, item.longitude));
    ambulancePath.forEach((point) => { bounds.extend(point); points += 1; });
    hospitalPath.forEach((point) => { bounds.extend(point); points += 1; });
    if (points > 1) map.fitBounds(bounds, 56);
    else if (points === 1 && incident) {
      map.setCenter({ lat: Number(incident.latitude), lng: Number(incident.longitude) });
      map.setZoom(13);
    }
  }, [map, incident, resources, hospitals, ambulancePath, hospitalPath]);

  if (loadError) {
    return (
      <div className="h-[520px] rounded-xl border border-red-500/20 bg-navy-900/70 flex items-center justify-center text-center p-8" role="alert">
        <div><AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-3" /><p className="text-sm text-red-300">Google Maps failed to load.</p><p className="text-xs text-slate-500 mt-1">Route and ranking data remain available below.</p></div>
      </div>
    );
  }

  if (!isLoaded) {
    return <div className="h-[520px] rounded-xl border border-navy-700 bg-navy-900/70 flex items-center justify-center text-slate-400" role="status"><Loader2 className="w-5 h-5 animate-spin mr-2" />Loading Google map?</div>;
  }

  return (
    <div className="relative h-[520px] rounded-xl overflow-hidden border border-navy-700" aria-label="Live operations map showing the selected incident, eligible ambulances, nearby hospitals, routes, and optional traffic overlay">
      <GoogleMap
        mapContainerStyle={{ width: '100%', height: '100%' }}
        center={DEFAULT_CENTER}
        zoom={12}
        options={MAP_OPTIONS}
        onLoad={onLoad}
        onUnmount={onUnmount}
      >
        {trafficEnabled && <TrafficLayer />}
        {incident && validPoint(incident.latitude, incident.longitude) && (
          <MarkerF
            position={{ lat: Number(incident.latitude), lng: Number(incident.longitude) }}
            title={`Incident ${incident.id}: ${incident.title}`}
            label={{ text: '!', color: '#ffffff', fontWeight: '700' }}
            zIndex={100}
          />
        )}
        {resources.map((resource) => validPoint(resource.latitude, resource.longitude) && (
          <MarkerF
            key={resource.resource_id}
            position={{ lat: Number(resource.latitude), lng: Number(resource.longitude) }}
            title={`Eligible ambulance ${resource.resource_id}, rank ${resource.rank}`}
            label={{ text: String(resource.rank), color: '#ffffff', fontWeight: '700' }}
            opacity={selectedResourceCode && selectedResourceCode !== resource.resource_id ? 0.62 : 1}
            onClick={() => onSelectResource?.(resource)}
          />
        ))}
        {hospitals.map((hospital) => validPoint(hospital.latitude, hospital.longitude) && (
          <MarkerF
            key={hospital.google_place_id}
            position={{ lat: Number(hospital.latitude), lng: Number(hospital.longitude) }}
            title={`Hospital ${hospital.name}, rank ${hospital.rank}`}
            label={{ text: 'H', color: '#ffffff', fontWeight: '700' }}
            opacity={selectedHospitalId && selectedHospitalId !== hospital.google_place_id ? 0.58 : 1}
            onClick={() => onSelectHospital?.(hospital)}
          />
        ))}
        {ambulancePath.length > 0 && <PolylineF path={ambulancePath} options={{ strokeColor: '#38bdf8', strokeOpacity: 0.95, strokeWeight: 5 }} />}
        {hospitalPath.length > 0 && <PolylineF path={hospitalPath} options={{ strokeColor: '#c084fc', strokeOpacity: 0.95, strokeWeight: 5 }} />}
      </GoogleMap>

      <button
        type="button"
        onClick={() => setTrafficEnabled((enabled) => !enabled)}
        className="absolute top-3 right-3 z-20 flex items-center gap-2 rounded-lg border border-navy-600 bg-navy-900/95 px-3 py-2 text-xs font-semibold text-white shadow-lg"
        aria-label={`${trafficEnabled ? 'Hide' : 'Show'} live traffic layer`}
        aria-pressed={trafficEnabled}
      >
        <Layers3 className="w-4 h-4 text-emerald-400" />
        Traffic {trafficEnabled ? 'On' : 'Off'}
      </button>
    </div>
  );
};

const LiveOperationsMap = ({ matrix, hospitalRanking, ...props }) => {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  const latest = [matrix?.retrieved_at, hospitalRanking?.retrieved_at, props.ambulanceRoute?.retrieved_at, props.hospitalRoute?.retrieved_at].filter(Boolean).sort().at(-1);

  return (
    <section className="bg-navy-800 border border-navy-700 rounded-xl p-5" aria-labelledby="live-map-title">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
        <div>
          <h2 id="live-map-title" className="text-base font-semibold text-white flex items-center gap-2"><MapPinned className="w-5 h-5 text-blue-400" />Live operations map</h2>
          <p className="text-xs text-slate-400 mt-1">Google base map and TrafficLayer; operational facts and routes come from CityMind APIs.</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {matrix?.fallback_used ? <ProvenanceBadge type="fallback" /> : matrix?.rankings?.some((item) => item.live_data) && <ProvenanceBadge type="liveTraffic" />}
          {hospitalRanking?.hospitals?.length > 0 && <ProvenanceBadge type="googlePlaces" />}
          <ProvenanceBadge type="approval" />
        </div>
      </div>

      {!apiKey ? (
        <div className="h-[520px] rounded-xl border border-amber-500/20 bg-navy-900/70 flex items-center justify-center text-center p-8" role="alert">
          <div><AlertTriangle className="w-8 h-8 text-amber-400 mx-auto mb-3" /><p className="text-sm text-amber-300">Maps browser key is missing.</p><p className="text-xs text-slate-500 mt-1">Set VITE_GOOGLE_MAPS_API_KEY in frontend/.env. Rankings and tables remain usable.</p></div>
        </div>
      ) : <MapCanvas apiKey={apiKey} {...props} />}

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-slate-400">
        <span><span className="inline-block w-3 h-1 rounded bg-sky-400 mr-1.5" />Ambulance to incident</span>
        <span><span className="inline-block w-3 h-1 rounded bg-purple-400 mr-1.5" />Incident to hospital</span>
        <span><span className="inline-block w-2.5 h-2.5 rounded-full bg-red-400 mr-1.5" />Incident</span>
        <span><span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-400 mr-1.5" />Eligible ambulance</span>
        <span><span className="inline-block w-2.5 h-2.5 rounded-full bg-purple-400 mr-1.5" />Google hospital</span>
        <span className="ml-auto">Last updated: {latest ? new Date(latest).toLocaleString('en-IN') : 'Awaiting verified data'}</span>
      </div>
    </section>
  );
};

export default LiveOperationsMap;
