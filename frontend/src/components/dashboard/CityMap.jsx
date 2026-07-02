import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import StatusBadge from '../common/StatusBadge';
import { useEffect } from 'react';

// Fix for default marker icons in React Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Create custom icons based on type
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
  hospital: createIcon('green'),
  resource: createIcon('blue'),
  area: createIcon('orange')
};

const MapController = ({ markers }) => {
  const map = useMap();
  useEffect(() => {
    if (markers && markers.length > 0) {
      const bounds = L.latLngBounds(markers.map(m => [m.latitude, m.longitude]));
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [markers, map]);
  return null;
};

const CityMap = ({ markers = [] }) => {
  const MYSURU_CENTER = [12.3051, 76.6413];

  return (
    <div className="h-[400px] w-full rounded-xl overflow-hidden border border-navy-700 bg-navy-800">
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
            icon={icons[marker.type] || icons.incident}
          >
            <Popup className="citymind-popup">
              <div className="font-sans">
                <h4 className="font-bold text-gray-900 text-sm mb-1">{marker.title}</h4>
                <div className="mb-2"><StatusBadge status={marker.status} /></div>
                <div className="text-xs text-gray-600">
                  {Object.entries(marker.details || {}).map(([k, v]) => (
                    <div key={k} className="mb-0.5">
                      <span className="capitalize font-medium">{k.replace('_', ' ')}:</span> {v}
                    </div>
                  ))}
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
};

export default CityMap;
