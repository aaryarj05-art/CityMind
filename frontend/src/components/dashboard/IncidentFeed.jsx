import StatusBadge from '../common/StatusBadge';
import { formatDate } from '../../utils/formatters';
import { AlertCircle, Flame, Droplets, Car, Users, Activity } from 'lucide-react';

const getCategoryIcon = (category) => {
  switch (category) {
    case 'Fire': return <Flame className="w-4 h-4 text-orange-400" />;
    case 'Waterlogging': return <Droplets className="w-4 h-4 text-blue-400" />;
    case 'Flood': return <Droplets className="w-4 h-4 text-cyan-400" />;
    case 'Road Accident': 
    case 'Traffic Congestion': return <Car className="w-4 h-4 text-yellow-400" />;
    case 'Public Disturbance': return <Users className="w-4 h-4 text-purple-400" />;
    case 'Medical Emergency': return <Activity className="w-4 h-4 text-red-400" />;
    default: return <AlertCircle className="w-4 h-4 text-slate-400" />;
  }
};

const IncidentFeed = ({ incidents = [] }) => {
  return (
    <div className="bg-navy-800 border border-navy-700 rounded-xl overflow-hidden h-full flex flex-col">
      <div className="p-5 border-b border-navy-700 bg-navy-800/80 sticky top-0">
        <h3 className="font-semibold text-white">Live Incident Feed</h3>
      </div>
      <div className="p-5 overflow-y-auto flex-1 space-y-4">
        {incidents.map((incident) => (
          <div key={incident.id} className="flex items-start space-x-3 p-3 rounded-lg hover:bg-navy-700/50 transition-colors border border-transparent hover:border-navy-600">
            <div className="mt-1 bg-navy-900 p-2 rounded-full border border-navy-700">
              {getCategoryIcon(incident.category)}
            </div>
            <div className="flex-1">
              <div className="flex justify-between items-start">
                <h4 className="text-sm font-medium text-white">{incident.title}</h4>
                <StatusBadge status={incident.status} />
              </div>
              <p className="text-xs text-slate-400 mt-1 mb-2">
                Dept: <span className="text-slate-300">{incident.responding_department}</span> • {formatDate(incident.reported_at)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default IncidentFeed;
