import React from 'react';

const PriorityBadge = ({ level }) => {
  const getBadgeStyle = (lvl) => {
    switch (lvl) {
      case 'Immediate':
        return 'bg-red-500/20 text-red-400 border-red-500/30 font-bold animate-pulse';
      case 'Urgent':
        return 'bg-orange-500/20 text-orange-400 border-orange-500/30 font-semibold';
      case 'Elevated':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'Routine':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      default:
        return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    }
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium border ${getBadgeStyle(level)}`}>
      {level}
    </span>
  );
};

export default PriorityBadge;
