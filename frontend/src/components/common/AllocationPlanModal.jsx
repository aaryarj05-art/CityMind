import React, { useState, useEffect } from 'react';
import { X, Play, ShieldAlert, CheckCircle2, ChevronRight, AlertCircle, Info, Zap } from 'lucide-react';
import { allocationAPI, dispatchAPI } from '../../services/api';
import ResourceCandidateCard from './ResourceCandidateCard';
import HospitalRecommendationCard from './HospitalRecommendationCard';
import PlanCompletenessBadge from './PlanCompletenessBadge';
import ShortageWarning from './ShortageWarning';
import LoadingState from './LoadingState';
import ErrorState from './ErrorState';

const AllocationPlanModal = ({ isOpen, onClose, incidentId, onDispatchSuccess }) => {
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Workflow options
  const [useRecommended, setUseRecommended] = useState(true);
  const [selectedResourceIds, setSelectedResourceIds] = useState([]);
  const [selectedHospitalId, setSelectedHospitalId] = useState(null);
  const [notes, setNotes] = useState('');

  // Dispatch creation states
  const [dispatching, setDispatching] = useState(false);
  const [dispatchError, setDispatchError] = useState(null);
  const [dispatchSuccess, setDispatchSuccess] = useState(null);
  const [requirePartialConfirm, setRequirePartialConfirm] = useState(false);

  useEffect(() => {
    if (!isOpen || !incidentId) return;

    const fetchPlan = async () => {
      setLoading(true);
      setError(null);
      setDispatchError(null);
      setDispatchSuccess(null);
      setRequirePartialConfirm(false);
      try {
        const res = await allocationAPI.getPlan(incidentId);
        setPlan(res.data);
        
        // Pre-select recommended resources & hospital
        const recIds = res.data.recommended_resources.map(r => r.resource_id);
        setSelectedResourceIds(recIds);
        
        const recHospital = res.data.hospital_recommendations.find(h => h.rank === 1 && h.eligible);
        if (recHospital) {
          setSelectedHospitalId(recHospital.hospital_id);
        } else {
          setSelectedHospitalId(null);
        }
      } catch (err) {
        setError(err.message || 'Failed to load allocation plan');
      } finally {
        setLoading(false);
      }
    };

    fetchPlan();
  }, [isOpen, incidentId]);

  if (!isOpen) return null;

  const handleResourceToggle = (id) => {
    setSelectedResourceIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(rid => rid !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  const handleDispatchSubmit = async (forcePartial = false) => {
    setDispatchError(null);
    
    // Validate selections if custom mode is on
    if (!useRecommended && selectedResourceIds.length === 0) {
      setDispatchError('Please select at least one resource for custom dispatch.');
      return;
    }

    // Check if the plan is partial/has shortages and we need explicit confirmation
    const hasShortages = plan.shortages && Object.keys(plan.shortages).length > 0;
    if (hasShortages && !forcePartial) {
      setRequirePartialConfirm(true);
      return;
    }

    setDispatching(true);
    try {
      const payload = {
        incident_id: incidentId,
        notes: notes.trim() || null,
        use_recommended_resources: useRecommended,
        selected_resource_ids: useRecommended ? null : selectedResourceIds,
        selected_hospital_id: selectedHospitalId || null
      };

      const res = await dispatchAPI.create(payload);
      setDispatchSuccess(res.data);
      if (onDispatchSuccess) {
        onDispatchSuccess(res.data);
      }
    } catch (err) {
      if (err.response && err.response.data && err.response.data.detail) {
        setDispatchError(err.response.data.detail);
      } else {
        setDispatchError(err.message || 'Failed to create dispatch');
      }
    } finally {
      setDispatching(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/90 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-navy-800 border border-navy-700 rounded-2xl shadow-2xl max-w-6xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="flex justify-between items-center p-5 border-b border-navy-700 bg-navy-850">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded font-mono font-bold uppercase">
                Phase 3 Allocation Planner
              </span>
              {plan && <PlanCompletenessBadge complete={plan.plan_complete} shortages={plan.shortages} />}
            </div>
            <h2 className="text-xl font-bold text-white mt-1">Incident Response Allocation</h2>
          </div>
          <button 
            onClick={onClose} 
            disabled={dispatching}
            className="p-2 text-slate-400 hover:text-white hover:bg-navy-700 rounded-xl transition-colors disabled:opacity-50"
            aria-label="Close Allocation Planner"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="py-24"><LoadingState message="Running allocation engine calculations..." /></div>
          ) : error ? (
            <ErrorState message="Could not compile allocation plan" details={error} onRetry={() => {}} />
          ) : dispatchSuccess ? (
            /* SUCCESS STATE */
            <div className="max-w-2xl mx-auto py-8 text-center space-y-6">
              <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/5">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-bold text-white">Simulated Dispatch Initiated</h3>
                <p className="text-sm text-slate-400">
                  Dispatch record has been successfully compiled and sent to responders.
                </p>
              </div>

              <div className="bg-navy-900 border border-navy-700 rounded-xl p-5 text-left space-y-4">
                <div className="flex justify-between border-b border-navy-850 pb-2">
                  <span className="text-xs text-slate-400">Dispatch Code</span>
                  <span className="text-xs font-bold text-white font-mono">{dispatchSuccess.dispatch_code}</span>
                </div>
                <div className="flex justify-between border-b border-navy-850 pb-2">
                  <span className="text-xs text-slate-400">Status</span>
                  <span className="text-xs font-bold text-blue-400">{dispatchSuccess.status}</span>
                </div>
                {dispatchSuccess.estimated_arrival_minutes && (
                  <div className="flex justify-between border-b border-navy-850 pb-2">
                    <span className="text-xs text-slate-400">Estimated Arrival (ETA)</span>
                    <span className="text-xs font-bold text-white font-mono">{dispatchSuccess.estimated_arrival_minutes.toFixed(1)} min</span>
                  </div>
                )}
                <div className="space-y-1">
                  <span className="text-xs text-slate-500 font-semibold block">Dispatched Resources</span>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {dispatchSuccess.assignments.map(a => (
                      <span key={a.id} className="text-[10px] bg-navy-950 text-slate-300 border border-navy-850 px-2 py-0.5 rounded font-semibold font-mono">
                        {a.resource_code} ({a.role})
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-4">
                <button
                  onClick={onClose}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-semibold text-white transition-colors"
                >
                  Return to Incidents
                </button>
              </div>
            </div>
          ) : (
            /* ACTIVE WORKFLOW STATE */
            <div className="space-y-6">
              
              {/* Incident Summary Card */}
              <div className="bg-navy-900 border border-navy-700 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-500">Incident #{plan.incident.id}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                      plan.incident.severity === 'Critical' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                      plan.incident.severity === 'High' ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20' :
                      'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                    }`}>
                      {plan.incident.severity}
                    </span>
                  </div>
                  <h4 className="text-base font-bold text-white mt-1">{plan.incident.title}</h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Location: <strong className="text-slate-300">{plan.incident.area_name}</strong> • Response Urgency: <strong className="text-blue-300">{plan.incident.recommended_response_urgency}</strong>
                  </p>
                </div>
                <div className="bg-navy-850 border border-navy-750 px-4 py-2.5 rounded-lg flex items-center gap-2.5">
                  <span className="text-xs text-slate-400 uppercase font-bold tracking-wider">Required Resources</span>
                  <div className="flex gap-1.5">
                    {Object.entries(plan.required_resources).map(([type, count]) => (
                      <span key={type} className="text-[10px] bg-navy-900 text-slate-300 border border-navy-700 px-2 py-0.5 rounded font-mono font-bold">
                        {count}x {type}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Explanations and Warnings */}
              <div className="space-y-3">
                <div className="bg-navy-900/40 border border-navy-700/50 rounded-xl p-4 flex items-start gap-2.5 text-xs text-slate-300">
                  <Info className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="font-bold text-white uppercase text-[10px] tracking-wider block mb-1">Engine Allocation Rationale</span>
                    {plan.explanation}
                  </div>
                </div>
                <ShortageWarning shortages={plan.shortages} />
              </div>

              {/* Resource Candidates Grid */}
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-navy-700/50 pb-2 gap-2">
                  <h4 className="text-white font-bold text-sm uppercase tracking-wider flex items-center gap-2">
                    <Zap className="w-4 h-4 text-yellow-400" />
                    Resource Recommendations
                  </h4>
                  
                  {/* Selection Mode Toggles */}
                  <div className="flex bg-navy-900 border border-navy-700 rounded-lg p-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        setUseRecommended(true);
                        setSelectedResourceIds(plan.recommended_resources.map(r => r.resource_id));
                      }}
                      className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                        useRecommended 
                          ? 'bg-blue-600 text-white' 
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Recommended
                    </button>
                    <button
                      type="button"
                      onClick={() => setUseRecommended(false)}
                      className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                        !useRecommended 
                          ? 'bg-blue-600 text-white' 
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Custom Selection
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Recommended/Candidates list */}
                  {plan.candidates.map(candidate => {
                    const isRecommended = plan.recommended_resources.some(r => r.resource_id === candidate.resource_id);
                    const isSelected = selectedResourceIds.includes(candidate.resource_id);
                    return (
                      <ResourceCandidateCard
                        key={candidate.resource_id}
                        candidate={candidate}
                        isRecommended={isRecommended}
                        isSelected={useRecommended ? isRecommended : isSelected}
                        selectionMode={!useRecommended}
                        onSelect={handleResourceToggle}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Hospital Recommendations (If applicable) */}
              {plan.hospital_recommendations && plan.hospital_recommendations.length > 0 && (
                <div className="space-y-4">
                  <h4 className="text-white font-bold text-sm uppercase tracking-wider border-b border-navy-700/50 pb-2 flex items-center gap-2">
                    🏥 Hospital Routing
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {plan.hospital_recommendations.map(hospital => (
                      <HospitalRecommendationCard
                        key={hospital.hospital_id}
                        candidate={hospital}
                        isRecommended={hospital.rank === 1}
                        isSelected={selectedHospitalId === hospital.hospital_id}
                        selectionMode={true}
                        onSelect={setSelectedHospitalId}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Confirm Dispatch Form */}
              <div className="bg-navy-900/60 border border-navy-700 rounded-xl p-5 space-y-4">
                <h4 className="text-white font-bold text-sm uppercase tracking-wider">Confirm Simulated Dispatch</h4>
                
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Dispatcher Notes</label>
                  <textarea
                    rows={3}
                    placeholder="Enter dispatch notes, directives, or remarks here..."
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    className="w-full bg-navy-900 border border-navy-700 rounded-lg p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>

                {dispatchError && (
                  <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex items-center gap-3">
                    <ShieldAlert className="w-5 h-5 text-red-400 flex-shrink-0" />
                    <span className="text-xs text-red-400 font-semibold">{dispatchError}</span>
                  </div>
                )}

                {/* Partial confirm flow warnings */}
                {requirePartialConfirm && (
                  <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl space-y-3">
                    <div className="flex items-center gap-2.5">
                      <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0" />
                      <span className="text-xs text-amber-400 font-bold">Unresolved shortages. Proceed anyway?</span>
                    </div>
                    <p className="text-xs text-slate-300">
                      You are trying to initiate a dispatch with active resource shortages. Some required response roles will not be filled.
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleDispatchSubmit(true)}
                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 rounded text-xs font-semibold text-white"
                      >
                        Yes, Confirm Partial Dispatch
                      </button>
                      <button
                        type="button"
                        onClick={() => setRequirePartialConfirm(false)}
                        className="px-3 py-1.5 bg-navy-700 hover:bg-navy-600 rounded text-xs font-semibold text-slate-300"
                      >
                        Cancel & Review
                      </button>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={dispatching}
                    className="px-4 py-2 bg-navy-700 hover:bg-navy-600 rounded-lg text-xs font-bold text-white transition-colors border border-navy-600 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  
                  {!requirePartialConfirm && (
                    <button
                      type="button"
                      onClick={() => handleDispatchSubmit(false)}
                      disabled={dispatching}
                      className="px-5 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-xs font-bold text-white transition-colors border border-blue-500 flex items-center gap-2 shadow-lg shadow-blue-500/25 disabled:opacity-50"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      {dispatching ? 'Creating Dispatch...' : 'Execute Dispatch Plan'}
                    </button>
                  )}
                </div>
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AllocationPlanModal;
