import React from 'react';

const DispatchSummaryCard = ({ title, value, icon: Icon, color = 'blue' }) => {
  const getColors = () => {
    switch (color) {
      case 'red': return 'text-red-400 border-red-500/20 bg-red-500/5';
      case 'orange': return 'text-orange-400 border-orange-500/20 bg-orange-500/5';
      case 'yellow': return 'text-amber-400 border-amber-500/20 bg-amber-500/5';
      case 'green': return 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5';
      case 'blue': return 'text-blue-400 border-blue-500/20 bg-blue-500/5';
      default: return 'text-slate-400 border-navy-700 bg-navy-800/50';
    }
  };

  return (
    <div className="bg-navy-800 border border-navy-700 rounded-xl p-5 flex items-center justify-between shadow-sm">
      <div className="space-y-1.5">
        <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold block">{title}</span>
        <h4 className="text-3xl font-extrabold text-white">{value}</h4>
      </div>
      <div className={`p-3 rounded-xl border ${getColors()}`}>
        <Icon className="w-5 h-5" />
      </div>
    </div>
  );
};

export default DispatchSummaryCard;
