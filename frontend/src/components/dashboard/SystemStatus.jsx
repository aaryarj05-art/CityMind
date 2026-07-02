import { Activity, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';

const SystemStatus = ({ statuses = {} }) => {
  const getStatusIcon = (status) => {
    switch (status) {
      case 'Online': return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
      case 'Delayed': return <AlertTriangle className="w-4 h-4 text-orange-400" />;
      case 'Simulated': return <Activity className="w-4 h-4 text-purple-400" />;
      case 'Offline': return <XCircle className="w-4 h-4 text-red-400" />;
      default: return <Activity className="w-4 h-4 text-slate-400" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Online': return 'text-emerald-400';
      case 'Delayed': return 'text-orange-400';
      case 'Simulated': return 'text-purple-400';
      case 'Offline': return 'text-red-400';
      default: return 'text-slate-400';
    }
  };

  return (
    <div className="bg-navy-800 border border-navy-700 rounded-xl p-5">
      <h3 className="font-semibold text-white mb-4">Data Feeds</h3>
      <div className="space-y-3">
        {Object.entries(statuses).map(([feed, status]) => (
          <div key={feed} className="flex justify-between items-center py-2 border-b border-navy-700/50 last:border-0">
            <span className="text-sm text-slate-300">{feed}</span>
            <div className="flex items-center space-x-2">
              {getStatusIcon(status)}
              <span className={`text-xs font-medium uppercase tracking-wider ${getStatusColor(status)}`}>
                {status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SystemStatus;
