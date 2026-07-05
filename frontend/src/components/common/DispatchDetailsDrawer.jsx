import React, { useState, useEffect } from 'react';
import { X, Calendar, User, FileText, ShieldAlert, CheckCircle2, MapPin, Hospital, Activity } from 'lucide-react';
import { dispatchAPI, riskAPI, hospitalsAPI } from '../../services/api';
import DispatchStatusBadge from './DispatchStatusBadge';
import DispatchTimeline from './DispatchTimeline';
import LifecycleActionBar from './LifecycleActionBar';
import LoadingState from './LoadingState';
import ErrorState from './ErrorState';
import { formatDate } from '../../utils/formatters';

const DispatchDetailsDrawer = ({ isOpen, onClose, dispatchId, onTransitionSuccess }) => {
  const [dispatch, setDispatch] = useState(null);
  const [incident, setIncident] = useState(null);
  const [hospitals, setHospitals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [transitioning, setTransitioning] = useState(false);
  const [transitionError, setTransitionError] = useState(null);

  const fetchDetails = async () => {
    if (!dispatchId) return;
    setLoading(true);
    setError(null);
    setTransitionError(null);
    try {
      const [dispRes, hospRes] = await Promise.all([
        dispatchAPI.getById(dispatchId),
        hospitalsAPI.getAll()
      ]);
      setDispatch(dispRes.data);
      setHospitals(hospRes.data);

      // Fetch corresponding incident details
      const incRes = await riskAPI.getIncidentById(dispRes.data.incident_id);
      setIncident(incRes.data);
    } catch (err) {
      setError(err.message || 'Failed to load dispatch details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && dispatchId) {
      fetchDetails();
    } else {
      setDispatch(null);
      setIncident(null);
    }
  }, [isOpen, dispatchId]);

  // Handle Escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && !transitioning) onClose();
    };
    if (isOpen) document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose, transitioning]);

  if (!isOpen) return null;

  const handleTransition = async (status) => {
    setTransitioning(true);
    setTransitionError(null);
    try {
      await dispatchAPI.updateStatus(dispatchId, status);
      await fetchDetails();
      if (onTransitionSuccess) onTransitionSuccess();
    } catch (err) {
      setTransitionError(err.response?.data?.detail || err.message || 'Failed to transition status');
    } finally {
      setTransitioning(false);
    }
  };

  const handleCancel = async () => {
    setTransitioning(true);
    setTransitionError(null);
    try {
      await dispatchAPI.cancel(dispatchId);
      await fetchDetails();
      if (onTransitionSuccess) onTransitionSuccess();
    } catch (err) {
      setTransitionError(err.response?.data?.detail || err.message || 'Failed to cancel dispatch');
    } finally {
      setTransitioning(false);
    }
  };

  const handleComplete = async () => {
    setTransitioning(true);
    setTransitionError(null);
    try {
      await dispatchAPI.complete(dispatchId);
      await fetchDetails();
      if (onTransitionSuccess) onTransitionSuccess();
    } catch (err) {
      setTransitionError(err.response?.data?.detail || err.message || 'Failed to complete dispatch');
    } finally {
      setTransitioning(false);
    }
  };

  const selectedHospital = dispatch && hospitals.find(h => h.id === dispatch.selected_hospital_id);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-navy-950/80 backdrop-blur-sm">
      {/* Click outside to close */}
      <div className="flex-1" onClick={() => !transitioning && onClose()} />
      
      {/* Drawer Container */}
      <div className="max-w-xl w-full bg-navy-800 border-l border-navy-700 h-full flex flex-col shadow-2xl relative animate-in slide-in-from-right duration-300">
        
        {/* Header */}
        <div className="p-5 border-b border-navy-700 bg-navy-850 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-400 font-mono font-bold uppercase tracking-wider">
                Simulated Dispatch
              </span>
              {dispatch && <DispatchStatusBadge status={dispatch.status} />}
            </div>
            <h3 className="text-lg font-bold text-white mt-1">
              {dispatch ? dispatch.dispatch_code : 'Loading...'}
            </h3>
          </div>
          <button
            onClick={onClose}
            disabled={transitioning}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-navy-700 rounded-lg transition-colors disabled:opacity-50"
            aria-label="Close drawer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="py-24"><LoadingState message="Retrieving dispatch assignments..." /></div>
          ) : error ? (
            <ErrorState message="Could not fetch details" details={error} onRetry={fetchDetails} />
          ) : (
            <div className="space-y-6">
              
              {/* Dispatch Timeline */}
              <DispatchTimeline status={dispatch.status} />

              {/* Lifecycle Action Bar */}
              <LifecycleActionBar
                currentStatus={dispatch.status}
                onTransition={handleTransition}
                onCancel={handleCancel}
                onComplete={handleComplete}
                isLoading={transitioning}
              />

              {transitionError && (
                <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex items-center gap-3">
                  <ShieldAlert className="w-5 h-5 text-red-400 flex-shrink-0" />
                  <span className="text-xs text-red-400 font-semibold">{transitionError}</span>
                </div>
              )}

              {/* Incident Details Summary */}
              {incident && (
                <div className="bg-navy-900 border border-navy-700 rounded-xl p-4 space-y-3">
                  <h4 className="text-xs text-slate-400 uppercase font-bold tracking-wider flex items-center gap-1.5">
                    <Activity className="w-4 h-4 text-blue-400" />
                    Target Incident Summary
                  </h4>
                  <div>
                    <h5 className="text-sm font-bold text-white">{incident.title}</h5>
                    <p className="text-xs text-slate-400 mt-1">
                      Area Location: <strong className="text-slate-300">{incident.area_name} (#{incident.area_id})</strong>
                    </p>
                    <p className="text-[10px] text-slate-500 mt-1 flex gap-2">
                      <span>Severity: <strong className="text-red-400">{incident.severity}</strong></span>
                      <span>•</span>
                      <span>Priority Level: <strong className="text-amber-400">{incident.priority_level}</strong></span>
                    </p>
                  </div>
                </div>
              )}

              {/* Assignments / Resources Details */}
              <div className="space-y-3">
                <h4 className="text-xs text-slate-400 uppercase font-bold tracking-wider">Assigned Resources</h4>
                <div className="space-y-3">
                  {dispatch.assignments.map((asg) => (
                    <div key={asg.id} className="bg-navy-900 border border-navy-700 rounded-xl p-4 space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <h5 className="text-sm font-bold text-white font-mono">{asg.resource_code}</h5>
                          <span className="text-[10px] text-slate-400 font-mono font-semibold uppercase">{asg.role}</span>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          asg.status === 'Dispatched' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                          asg.status === 'On Scene' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                          asg.status === 'Released' ? 'bg-slate-500/10 text-slate-400 border border-slate-500/20' :
                          'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        }`}>
                          {asg.status}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 border-t border-navy-800 pt-2.5 text-[11px] text-slate-400">
                        <div>
                          <span className="text-[9px] text-slate-500 uppercase tracking-wider block">Distance</span>
                          <span className="font-bold text-slate-200 font-mono">{asg.distance_km.toFixed(2)} km</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-slate-500 uppercase tracking-wider block">Estimated ETA</span>
                          <span className="font-bold text-slate-200 font-mono">{asg.estimated_arrival_minutes.toFixed(1)} min</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-slate-500 uppercase tracking-wider block">Suitability</span>
                          <span className="font-bold text-slate-200 font-mono">{asg.suitability_score.toFixed(1)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Selected Hospital details (if any) */}
              {selectedHospital && (
                <div className="bg-navy-900 border border-navy-700 rounded-xl p-4 space-y-3">
                  <h4 className="text-xs text-slate-400 uppercase font-bold tracking-wider flex items-center gap-1.5">
                    <Hospital className="w-4 h-4 text-violet-400" />
                    Target Medical Facility
                  </h4>
                  <div className="flex justify-between items-start">
                    <div>
                      <h5 className="text-sm font-bold text-white">{selectedHospital.name}</h5>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        Beds Headroom: {selectedHospital.available_beds} available
                      </p>
                    </div>
                    <span className="text-[10px] bg-violet-500/10 text-violet-400 border border-violet-500/20 px-2 py-0.5 rounded font-semibold font-mono">
                      Reserved
                    </span>
                  </div>
                </div>
              )}

              {/* Dispatch Metadata & Notes */}
              <div className="bg-navy-900/40 border border-navy-750 rounded-xl p-4 space-y-4">
                <h4 className="text-xs text-slate-400 uppercase font-bold tracking-wider flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-slate-400" />
                  Dispatch Logs & Metadata
                </h4>

                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-slate-500 font-medium uppercase text-[9px] block">Created At</span>
                    <span className="text-slate-300 font-medium font-mono">{formatDate(dispatch.created_at)}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-medium uppercase text-[9px] block">Last Update</span>
                    <span className="text-slate-300 font-medium font-mono">{formatDate(dispatch.updated_at)}</span>
                  </div>
                </div>

                {dispatch.notes && (
                  <div className="border-t border-navy-750 pt-3">
                    <span className="text-slate-500 font-medium uppercase text-[9px] block">Officer Dispatch Notes</span>
                    <p className="text-slate-300 text-xs italic mt-1 font-sans leading-relaxed">
                      "{dispatch.notes}"
                    </p>
                  </div>
                )}
              </div>

            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-navy-700 bg-navy-850 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={transitioning}
            className="px-4 py-2 bg-navy-700 hover:bg-navy-600 rounded-lg text-xs font-bold text-white transition-colors border border-navy-600 disabled:opacity-50"
          >
            Close Details
          </button>
        </div>

      </div>
    </div>
  );
};

export default DispatchDetailsDrawer;
