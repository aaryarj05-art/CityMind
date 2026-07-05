import React, { useState } from 'react';
import { Send, Navigation, MapPin, Ambulance, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';
import ConfirmActionModal from './ConfirmActionModal';

const LifecycleActionBar = ({ currentStatus, onTransition, onCancel, onComplete, isLoading }) => {
  const [showConfirm, setShowConfirm] = useState(null); // 'cancel' or 'complete'

  if (currentStatus === 'Completed' || currentStatus === 'Cancelled') {
    return (
      <div className="bg-navy-900/40 border border-navy-700/50 rounded-xl p-4 text-center text-xs text-slate-500 font-medium">
        This dispatch has reached a terminal state ({currentStatus}) and no further transitions are allowed.
      </div>
    );
  }

  const renderButtons = () => {
    switch (currentStatus) {
      case 'Planned':
        return (
          <div className="flex gap-3 w-full">
            <button
              onClick={() => onTransition('Dispatched')}
              disabled={isLoading}
              className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold border border-blue-500 disabled:opacity-50 transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
              Dispatch Resources
            </button>
            <button
              onClick={() => setShowConfirm('cancel')}
              disabled={isLoading}
              className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 bg-red-600/10 hover:bg-red-600/20 text-red-400 rounded-lg text-xs font-semibold border border-red-500/20 disabled:opacity-50 transition-colors"
            >
              <XCircle className="w-3.5 h-3.5" />
              Cancel Dispatch
            </button>
          </div>
        );
      case 'Dispatched':
        return (
          <div className="flex gap-3 w-full">
            <button
              onClick={() => onTransition('En Route')}
              disabled={isLoading}
              className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold border border-indigo-500 disabled:opacity-50 transition-colors"
            >
              <Navigation className="w-3.5 h-3.5" />
              Mark En Route
            </button>
            <button
              onClick={() => setShowConfirm('cancel')}
              disabled={isLoading}
              className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 bg-red-600/10 hover:bg-red-600/20 text-red-400 rounded-lg text-xs font-semibold border border-red-500/20 disabled:opacity-50 transition-colors"
            >
              <XCircle className="w-3.5 h-3.5" />
              Cancel Dispatch
            </button>
          </div>
        );
      case 'En Route':
        return (
          <button
            onClick={() => onTransition('On Scene')}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-semibold border border-amber-500 disabled:opacity-50 transition-colors"
          >
            <MapPin className="w-3.5 h-3.5" />
            Mark On Scene
          </button>
        );
      case 'On Scene':
        return (
          <div className="flex gap-3 w-full">
            <button
              onClick={() => onTransition('Transporting')}
              disabled={isLoading}
              className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-semibold border border-purple-500 disabled:opacity-50 transition-colors"
            >
              <Ambulance className="w-3.5 h-3.5" />
              Begin Transport
            </button>
            <button
              onClick={() => setShowConfirm('complete')}
              disabled={isLoading}
              className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold border border-emerald-500 disabled:opacity-50 transition-colors"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Complete Response
            </button>
          </div>
        );
      case 'Transporting':
        return (
          <button
            onClick={() => setShowConfirm('complete')}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold border border-emerald-500 disabled:opacity-50 transition-colors"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Complete Response
          </button>
        );
      default:
        return null;
    }
  };

  return (
    <div className="bg-navy-900 border border-navy-700/50 rounded-xl p-4 space-y-4">
      <div className="flex justify-between items-center">
        <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Simulated Dispatch Controls</span>
        {isLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-400" />}
      </div>
      
      {renderButtons()}

      {/* Confirmation Modals */}
      <ConfirmActionModal
        isOpen={showConfirm === 'cancel'}
        onClose={() => setShowConfirm(null)}
        onConfirm={() => {
          setShowConfirm(null);
          onCancel();
        }}
        title="Cancel Dispatch?"
        message="Are you sure you want to cancel this simulated dispatch? Assigned emergency resources will be released and returned to the pool immediately."
        confirmText="Yes, Cancel"
        isDestructive={true}
        isLoading={isLoading}
      />

      <ConfirmActionModal
        isOpen={showConfirm === 'complete'}
        onClose={() => setShowConfirm(null)}
        onConfirm={() => {
          setShowConfirm(null);
          onComplete();
        }}
        title="Complete Dispatch?"
        message="Are you sure you want to complete this simulated dispatch? Assigned resources will be released and the target incident status will be updated to Resolved."
        confirmText="Yes, Complete"
        isDestructive={false}
        isLoading={isLoading}
      />
    </div>
  );
};

export default LifecycleActionBar;
