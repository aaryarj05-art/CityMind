import React from 'react';
import RiskLevelBadge from './RiskLevelBadge';
import RiskScoreBadge from './RiskScoreBadge';

const RiskExplanationPanel = ({ areaRisk }) => {
  if (!areaRisk) return null;

  const {
    risk_score,
    risk_level,
    explanation,
    recommended_priority_level,
    top_contributing_factors = []
  } = areaRisk;

  return (
    <div className="bg-navy-900 border border-navy-700/60 rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between border-b border-navy-700/60 pb-3">
        <h4 className="text-white font-semibold text-sm">Calculation Analysis</h4>
        <div className="flex items-center gap-2">
          <RiskLevelBadge level={risk_level} />
          <RiskScoreBadge score={risk_score} />
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">System Explanation</span>
          <p className="text-slate-300 text-sm mt-0.5 leading-relaxed">{explanation}</p>
        </div>

        <div>
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Priority Recommendation</span>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-xs px-2.5 py-0.5 rounded font-medium ${
              recommended_priority_level === 'Immediate' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
              recommended_priority_level === 'Urgent' ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20' :
              recommended_priority_level === 'Elevated' ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' :
              'bg-blue-500/10 text-blue-400 border border-blue-500/20'
            }`}>
              {recommended_priority_level} Dispatch Priority
            </span>
          </div>
        </div>

        <div>
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Top Drivers</span>
          <div className="mt-2 space-y-1.5">
            {top_contributing_factors.slice(0, 3).map((f, idx) => (
              <div key={f.factor} className="flex justify-between items-center text-xs">
                <span className="text-slate-400">
                  {idx + 1}. {f.factor.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                </span>
                <span className="text-slate-200 font-medium">{f.contribution.toFixed(1)} pts ({Math.round(f.weight * 100)}% wt)</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RiskExplanationPanel;
