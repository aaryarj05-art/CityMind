import { useCallback, useMemo, useState } from 'react';
import { GoogleMap, MarkerF, useJsApiLoader } from '@react-google-maps/api';
import { AlertTriangle, Crosshair, Loader2, MapPin, MousePointer2 } from 'lucide-react';

const DEFAULT_CENTER = { lat: 12.2958, lng: 76.6394 };
const LIBRARIES = ['geometry'];
const MAP_OPTIONS = {
  clickableIcons: false,
  fullscreenControl: false,
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

const fallbackAddress = (source) => (
  source === 'current'
    ? 'Current location shared from this device'
    : 'Selected location, Mysuru, Karnataka, India'
);

const MapSelectionCanvas = ({ apiKey, selectedPosition, selecting, onMapSelect }) => {
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'citymind-google-maps-script',
    googleMapsApiKey: apiKey,
    libraries: LIBRARIES,
  });

  if (loadError) {
    return (
      <div className="rounded-xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-200" role="alert">
        Google Maps failed to load. Please retry or share current location.
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="flex h-56 items-center justify-center rounded-xl border border-navy-700 bg-navy-950/60 text-sm text-slate-400" role="status">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading Google map...
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-navy-700 bg-navy-950/60">
      <GoogleMap
        mapContainerStyle={{ width: '100%', height: '224px' }}
        center={selectedPosition || DEFAULT_CENTER}
        zoom={selectedPosition ? 15 : 12}
        options={MAP_OPTIONS}
        onClick={(event) => {
          const lat = event.latLng?.lat();
          const lng = event.latLng?.lng();
          if (Number.isFinite(lat) && Number.isFinite(lng)) {
            onMapSelect({ lat, lng });
          }
        }}
      >
        {selectedPosition && <MarkerF position={selectedPosition} title="Selected evidence location" />}
      </GoogleMap>
      <div className="border-t border-navy-700 px-3 py-2 text-xs text-slate-400">
        {selecting ? 'Click a point on the map to attach the incident location.' : 'Use Share Current Location or Select on Map to attach location metadata.'}
      </div>
    </div>
  );
};

const EvidenceLocationPicker = ({ location, onLocationChange, disabled = false }) => {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  const [selecting, setSelecting] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [locationError, setLocationError] = useState('');

  const selectedPosition = useMemo(() => {
    if (!location) return null;
    return { lat: Number(location.latitude), lng: Number(location.longitude) };
  }, [location]);

  const resolveAddress = useCallback((position, source) => new Promise((resolve) => {
    if (!window.google?.maps?.Geocoder) {
      resolve(fallbackAddress(source));
      return;
    }
    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ location: position }, (results, status) => {
      if (status === 'OK' && results?.[0]?.formatted_address) {
        resolve(results[0].formatted_address);
        return;
      }
      resolve(fallbackAddress(source));
    });
  }), []);

  const applyLocation = useCallback(async (position, source) => {
    setResolving(true);
    setLocationError('');
    try {
      const readableAddress = await resolveAddress(position, source);
      onLocationChange({
        latitude: position.lat,
        longitude: position.lng,
        readableAddress,
        source,
      });
    } finally {
      setResolving(false);
      setSelecting(false);
    }
  }, [onLocationChange, resolveAddress]);

  const shareCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('Current location sharing is not available in this browser.');
      return;
    }
    setResolving(true);
    setLocationError('');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        applyLocation({ lat: position.coords.latitude, lng: position.coords.longitude }, 'current');
      },
      () => {
        setResolving(false);
        setLocationError('Current location could not be shared. Please select the location on the map.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  };

  const selectOnMap = () => {
    setSelecting(true);
    setLocationError('');
  };

  return (
    <section className="space-y-3" aria-label="Incident location">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={shareCurrentLocation}
          disabled={disabled || resolving}
          className="inline-flex items-center gap-2 rounded-lg border border-cyan-300/25 bg-cyan-400/10 px-3 py-2 text-xs font-bold text-cyan-100 transition hover:border-cyan-300/45 hover:bg-cyan-400/15 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60"
        >
          {resolving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crosshair className="h-4 w-4" />}
          Share Current Location
        </button>
        <button
          type="button"
          onClick={selectOnMap}
          disabled={disabled || !apiKey || resolving}
          className="inline-flex items-center gap-2 rounded-lg border border-blue-300/20 bg-blue-400/10 px-3 py-2 text-xs font-bold text-blue-100 transition hover:border-blue-300/40 hover:bg-blue-400/15 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300/60"
        >
          <MousePointer2 className="h-4 w-4" />
          Select on Map
        </button>
      </div>

      {location && (
        <div className="rounded-lg border border-emerald-400/20 bg-emerald-400/10 p-3 text-sm text-emerald-50" role="status">
          <div className="flex items-start gap-2">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-emerald-300">{location.source === 'current' ? 'Current Location' : 'Selected Location'}</p>
              <p className="mt-1 leading-5 text-emerald-50/90">{location.readableAddress}</p>
            </div>
          </div>
        </div>
      )}

      {locationError && (
        <div className="flex gap-2 rounded-lg border border-amber-400/20 bg-amber-500/10 p-3 text-xs text-amber-100" role="alert">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {locationError}
        </div>
      )}

      {!apiKey ? (
        <div className="rounded-xl border border-amber-400/20 bg-navy-950/60 p-4 text-sm text-amber-100" role="alert">
          Google Maps browser key is missing. Current location sharing can still attach location metadata when your browser allows it.
        </div>
      ) : (
        <MapSelectionCanvas
          apiKey={apiKey}
          selectedPosition={selectedPosition}
          selecting={selecting}
          onMapSelect={(position) => applyLocation(position, 'map')}
        />
      )}
    </section>
  );
};

export default EvidenceLocationPicker;
