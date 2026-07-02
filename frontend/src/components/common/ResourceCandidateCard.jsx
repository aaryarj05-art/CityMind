import React from 'react';
import { Check, Shield, Siren, Truck, AlertTriangle, AlertCircle } from 'lucide-react';

const ResourceCandidateCard = ({ candidate, isSelected, onSelect, isRecommended, selectionMode = false }) => {
  const {
    resource_id,
    resource_code,
    resource_type,
    eligible,
    rank,
    distance_km,
    eta,
    suitability_score,
    reasons
  } = candidate;

  const getIcon = (type) => {
    if (type.includes('Ambulance')) return <Siren className="w-4 h-4 text-red-400" />;
    if (type.includes('Police')) return <Shield className="w-4 h-4 text-blue-400" />;
    if (type.includes('Fire')) return <Truck className="w-4 h-4 text-orange-400" />;
    return <Siren className="w-4 h-4 text-slate-400" />;
  };

  const cardBorder = !eligible
    ? 'border-red-500/20 bg-red-500/5 opacity-60'
    : isSelected
      ? 'border-blue-500 bg-blue-500/5 shadow-md shadow-blue-500/10'
      : isRecommended
        ? 'border-emerald-500/40 bg-emerald-500/5 hover:border-emerald-500/60'
        : 'border-navy-700 hover:border-navy-600 bg-navy-900/50';

  return (
    <div 
      className={`border rounded-xl p-4 transition-all ${cardBorder} ${eligible && selectionMode ? 'cursor-pointer' : ''}`}
      onClick={() => eligible && selectionMode && onSelect(resource_id)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-navy-900 rounded border border-navy-700">
            {getIcon(resource_type)}
          </div>
          <div>
            <h5 className="text-sm font-bold text-white flex items-center gap-1.5">
              {resource_code}
              {rank !== null && (
                <span className="text-[9px] bg-blue-900/80 text-blue-300 px-1.5 py-0.5 rounded font-bold font-mono">
                  Rank {rank}
                </span>
              )}
            </h5>
            <p className="text-[10px] text-slate-400 mt-0.5">{resource_type}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="text-right">
            <span className="text-[10px] text-slate-500 uppercase font-bold block">Suitability</span>
            <span className={`text-xs font-bold font-mono ${
              suitability_score >= 80 ? 'text-emerald-400' :
              suitability_score >= 50 ? 'text-amber-400' : 'text-red-400'
            }`}>
              {suitability_score.toFixed(1)}
            </span>
          </div>

          {selectionMode && eligible && (
            <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${
              isSelected 
                ? 'bg-blue-600 border-blue-500 text-white' 
                : 'border-navy-700 bg-navy-800'
            }`}>
              {isSelected && <Check className="w-3.5 h-3.5" />}
            </div>
          )}
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-3 gap-2 mt-3.5 border-t border-b border-navy-800 py-2.5 text-[11px] text-slate-400">
        <div>
          <span className="text-[9px] text-slate-500 uppercase tracking-wider block">Distance</span>
          <span className="font-bold text-slate-200 font-mono">{distance_km.toFixed(2)} km</span>
        </div>
        <div>
          <span className="text-[9px] text-slate-500 uppercase tracking-wider block">Travel Time</span>
          <span className="font-bold text-slate-200 font-mono">{eta.base_travel_minutes.toFixed(1)} min</span>
        </div>
        <div>
          <span className="text-[9px] text-slate-500 uppercase tracking-wider block">Final ETA</span>
          <span className="font-bold text-slate-200 font-mono">{eta.estimated_arrival_minutes.toFixed(1)} min</span>
        </div>
      </div>

      {/* Rejection / Reasons */}
      <div className="mt-3">
        {!eligible ? (
          <div className="flex items-start gap-1 text-[10px] text-red-400 bg-red-950/20 border border-red-500/10 p-2 rounded">
            <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            <span>Not eligible: {reasons[0] || 'Unsuitable'}</span>
          </div>
        ) : (
          <div className="space-y-1">
            <span className="text-[9px] text-slate-500 uppercase font-bold block">Selection Rationale</span>
            <ul className="space-y-0.5">
              {reasons.slice(0, 2).map((reason, idx) => (
                <li key={idx} className="text-[10.5px] text-slate-300 flex items-start gap-1 leading-normal">
                  <span className="text-blue-500 mt-0.5">•</span>
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default ResourceCandidateCard;
