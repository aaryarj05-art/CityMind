import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import StatusBadge from '../common/StatusBadge';

// Fix for default marker icons in React Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Create custom icons based on type/color
const createIcon = (color) => {
  return new L.Icon({
    iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${color}.png`,
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });
};

const icons = {
  incident: createIcon('red'),
  hospital: createIcon('violet'),
  resource: createIcon('blue'),
  
  // Risk levels
  low: createIcon('green'),
  moderate: createIcon('yellow'),
  high: createIcon('orange'),
  critical: createIcon('red')
};

const MapController = ({ markers }) => {
  const map = useMap();
  useEffect(() => {
    if (markers && markers.length > 0) {
      // Filter out markers with invalid coordinates
      const validMarkers = markers.filter(m => typeof m.latitude === 'number' && typeof m.longitude === 'number');
      if (validMarkers.length > 0) {
        const bounds = L.latLngBounds(validMarkers.map(m => [m.latitude, m.longitude]));
        map.fitBounds(bounds, { padding: [50, 50] });
      }
    }
  }, [markers, map]);
  return null;
};

const CityMap = ({ markers = [] }) => {
  const MYSURU_CENTER = [12.3051, 76.6413];

  const getMarkerIcon = (marker) => {
    if (marker.type === 'area') {
      const level = marker.status; // Low, Moderate, High, Critical
      if (level === 'Critical') return icons.critical;
      if (level === 'High') return icons.high;
      if (level === 'Moderate') return icons.moderate;
      return icons.low;
    }
    return icons[marker.type] || icons.incident;
  };

  return (
    <div className="h-[400px] w-full rounded-xl overflow-hidden border border-navy-700 bg-navy-800 relative">
      <MapContainer 
        center={MYSURU_CENTER} 
        zoom={13} 
        style={{ height: '100%', width: '100%' }}
        className="z-0"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />
        <MapController markers={markers} />
        {markers.map((marker) => (
          <Marker 
            key={marker.id} 
            position={[marker.latitude, marker.longitude]}
            icon={getMarkerIcon(marker)}
          >
            <Popup className="citymind-popup">
              <div className="font-sans text-gray-900">
                <h4 className="font-bold text-sm mb-1">{marker.title}</h4>
                <div className="mb-2">
                  <StatusBadge status={marker.status} />
                </div>
                
                <div className="text-xs space-y-1">
                  {marker.type === 'area' ? (
                    <>
                      <div><span className="font-semibold">Risk Score:</span> {marker.details.risk_score?.toFixed(1)}/100</div>
                      {marker.details.top_factor && (
                        <div className="capitalize"><span className="font-semibold">Top Driver:</span> {marker.details.top_factor.replace('_', ' ')}</div>
                      )}
                      <div><span className="font-semibold">Active Incidents:</span> {marker.details.active_incidents}</div>
                      <div className="text-[11px] text-gray-600 border-t border-gray-200 pt-1 mt-1 font-medium">
                        {marker.details.explanation}
                      </div>
                    </>
                  ) : (
                    Object.entries(marker.details || {}).map(([k, v]) => (
                      <div key={k} className="mb-0.5">
                        <span className="capitalize font-semibold">{k.replace('_', ' ')}:</span> {v}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Compact Map Legend */}
      <div className="absolute bottom-3 left-3 z-[1000] bg-navy-900/90 backdrop-blur-sm border border-navy-700 rounded-lg px-3 py-2 shadow-lg">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Map Legend</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          {[
            { color: 'bg-red-500', label: 'Critical Risk' },
            { color: 'bg-orange-500', label: 'High Risk' },
            { color: 'bg-yellow-400', label: 'Moderate Risk' },
            { color: 'bg-emerald-500', label: 'Low Risk' },
            { color: 'bg-violet-500', label: 'Hospital' },
            { color: 'bg-red-400', label: 'Incident', shape: 'triangle' },
          ].map(item => (
            <div key={item.label} className="flex items-center gap-1.5">
              <span className={`w-2.5 h-2.5 ${item.color} rounded-full flex-shrink-0`} />
              <span className="text-[10px] text-slate-300">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CityMap;
