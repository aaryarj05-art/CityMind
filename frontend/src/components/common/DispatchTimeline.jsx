import React from 'react';
import { Check, XCircle } from 'lucide-react';

const DispatchTimeline = ({ status }) => {
  const steps = ['Planned', 'Dispatched', 'En Route', 'On Scene', 'Transporting', 'Completed'];
  
  if (status === 'Cancelled') {
    return (
      <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center gap-3">
        <XCircle className="w-6 h-6 text-red-500 flex-shrink-0" />
        <div>
          <h5 className="text-sm font-semibold text-red-400">Dispatch Cancelled</h5>
          <p className="text-xs text-slate-400">This dispatch workflow was cancelled. Assigned resources have been released.</p>
        </div>
      </div>
    );
  }

  const currentIdx = steps.indexOf(status);

  return (
    <div className="w-full bg-navy-900 border border-navy-700/50 rounded-xl p-5">
      <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-4">Lifecycle Status</p>
      
      {/* Horizontal timeline */}
      <div className="relative flex items-center justify-between">
        {/* Progress bar line */}
        <div className="absolute left-6 right-6 top-1/2 -translate-y-1/2 h-0.5 bg-navy-750 z-0">
          <div 
            className="h-full bg-blue-500 transition-all duration-300"
            style={{ 
              width: `${currentIdx >= 0 ? (currentIdx / (steps.length - 1)) * 100 : 0}%` 
            }}
          />
        </div>

        {/* Timeline Steps */}
        {steps.map((step, idx) => {
          const isCompleted = idx < currentIdx;
          const isActive = idx === currentIdx;
          
          return (
            <div key={step} className="relative z-10 flex flex-col items-center flex-1">
              <div 
                className={`w-6.5 h-6.5 rounded-full flex items-center justify-center border transition-all ${
                  isCompleted 
                    ? 'bg-blue-600 border-blue-500 text-white shadow shadow-blue-500/20' 
                    : isActive
                      ? 'bg-navy-800 border-blue-400 text-blue-400 font-bold scale-110 shadow-lg shadow-blue-500/10'
                      : 'bg-navy-900 border-navy-700 text-slate-500'
                }`}
              >
                {isCompleted ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <span className="text-[10px]">{idx + 1}</span>
                )}
              </div>
              
              <span className={`text-[10px] font-semibold mt-2 text-center truncate w-16 ${
                isActive ? 'text-blue-400 font-bold' : isCompleted ? 'text-slate-300' : 'text-slate-500'
              }`}>
                {step}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DispatchTimeline;
