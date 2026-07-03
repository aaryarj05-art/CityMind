import { ShieldCheck } from 'lucide-react';
import { useState } from 'react';

const GroundedBadge = ({ grounded }) => {
  const [showTooltip, setShowTooltip] = useState(false);

  if (!grounded) return null;

  return (
    <div className="relative inline-flex">
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 cursor-default"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        aria-label="Response verified with CityMind backend data"
      >
        <ShieldCheck className="w-3 h-3" />
        Verified CityMind Data
      </span>
      {showTooltip && (
        <div className="absolute bottom-full left-0 mb-1.5 w-64 p-2 bg-navy-900 border border-navy-600 rounded-lg shadow-xl text-[11px] text-slate-300 z-50 leading-relaxed">
          This response was generated using verified CityMind backend data and Google ADK agent orchestration.
        </div>
      )}
    </div>
  );
};

export default GroundedBadge;
