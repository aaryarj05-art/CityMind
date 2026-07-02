import React from 'react';

const RiskScoreBadge = ({ score }) => {
  const getScoreColor = (val) => {
    if (val >= 85) return 'text-red-400 border-red-500/30 bg-red-500/10';
    if (val >= 70) return 'text-orange-400 border-orange-500/30 bg-orange-500/10';
    if (val >= 50) return 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10';
    return 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10';
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-sm font-bold border ${getScoreColor(score)}`}>
      {score.toFixed(1)}
    </span>
  );
};

export default RiskScoreBadge;
