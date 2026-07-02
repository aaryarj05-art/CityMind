import { STATUS_COLORS } from '../../utils/constants';

const StatusBadge = ({ status }) => {
  const colorClass = STATUS_COLORS[status] || 'bg-slate-500/20 text-slate-400';
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border border-current opacity-80 ${colorClass}`}>
      {status}
    </span>
  );
};

export default StatusBadge;
