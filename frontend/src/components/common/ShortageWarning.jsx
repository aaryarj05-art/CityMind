import React from 'react';
import { AlertCircle } from 'lucide-react';

const ShortageWarning = ({ shortages }) => {
  if (!shortages || Object.keys(shortages).length === 0) return null;

  return (
    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-start gap-3">
      <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
      <div className="space-y-1">
        <h5 className="text-sm font-semibold text-red-400">Resource Shortages Detected</h5>
        <p className="text-xs text-slate-300">
          The requested allocation plan cannot be fully staffed. The following resource types are unavailable:
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {Object.entries(shortages).map(([type, count]) => (
            <span key={type} className="text-[10px] bg-red-950/50 text-red-400 border border-red-500/30 px-2 py-0.5 rounded font-mono font-semibold">
              {type}: Shortage of {count}
            </span>
          ))}
        </div>
        <p className="text-[10px] text-slate-400 mt-2 font-medium">
          ⚠️ Explicit confirmation is required to deploy a partial plan. Some assignments will remain unfilled.
        </p>
      </div>
    </div>
  );
};

export default ShortageWarning;
