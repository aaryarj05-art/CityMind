import React from 'react';
import { 
  FileText, Send, Navigation, MapPin, Ambulance, CheckCircle2, XCircle 
} from 'lucide-react';

const DispatchStatusBadge = ({ status }) => {
  const getStatusStyles = () => {
    switch (status) {
      case 'Planned':
        return {
          bg: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
          icon: <FileText className="w-3.5 h-3.5" />
        };
      case 'Dispatched':
        return {
          bg: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
          icon: <Send className="w-3.5 h-3.5" />
        };
      case 'En Route':
        return {
          bg: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
          icon: <Navigation className="w-3.5 h-3.5" />
        };
      case 'On Scene':
        return {
          bg: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
          icon: <MapPin className="w-3.5 h-3.5" />
        };
      case 'Transporting':
        return {
          bg: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
          icon: <Ambulance className="w-3.5 h-3.5" />
        };
      case 'Completed':
        return {
          bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
          icon: <CheckCircle2 className="w-3.5 h-3.5" />
        };
      case 'Cancelled':
        return {
          bg: 'bg-red-500/10 text-red-400 border-red-500/20',
          icon: <XCircle className="w-3.5 h-3.5" />
        };
      default:
        return {
          bg: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
          icon: <FileText className="w-3.5 h-3.5" />
        };
    }
  };

  const { bg, icon } = getStatusStyles();

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${bg}`}>
      {icon}
      {status}
    </span>
  );
};

export default DispatchStatusBadge;
