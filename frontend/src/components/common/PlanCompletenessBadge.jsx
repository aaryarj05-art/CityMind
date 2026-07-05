import React from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle } from 'lucide-react';

const PlanCompletenessBadge = ({ complete, shortages = {} }) => {
  const shortageCount = Object.values(shortages).reduce((a, b) => a + b, 0);

  if (complete && shortageCount === 0) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
        <CheckCircle2 className="w-3.5 h-3.5" />
        Complete
      </span>
    );
  }

  if (shortageCount > 0) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
        <AlertTriangle className="w-3.5 h-3.5" />
        Partial Plan
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20">
      <AlertCircle className="w-3.5 h-3.5" />
      Incomplete
    </span>
  );
};

export default PlanCompletenessBadge;
