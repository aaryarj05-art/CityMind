import React, { useState, useEffect, useCallback } from 'react';
import PageContainer from '../components/layout/PageContainer';
import EmptyState from '../components/common/EmptyState';
import LoadingState from '../components/common/LoadingState';
import ErrorState from '../components/common/ErrorState';
import StatusBadge from '../components/common/StatusBadge';
import PriorityBadge from '../components/common/PriorityBadge';
import Modal from '../components/common/Modal';
import { riskAPI } from '../services/api';
import { formatDate } from '../utils/formatters';
import { Search, Filter, X, Zap, Brain, Shield, Info, AlertTriangle } from 'lucide-react';

const Incidents = () => {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Selected incident details
  const [selectedIncidentId, setSelectedIncidentId] = useState(null);
  const [incidentDetails, setIncidentDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState(null);

  // Filters
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [areaFilter, setAreaFilter] = useState('');

  const fetchIncidents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (priorityFilter) params.priority_level = priorityFilter;
      if (statusFilter) params.status = statusFilter;
      if (areaFilter) params.area_id = parseInt(areaFilter, 10);

      const res = await riskAPI.getIncidents(params);
      setIncidents(res.data);
    } catch (err) {
      setError(err.message || 'Failed to load priority incidents from backend');
    } finally {
      setLoading(false);
    }
  }, [priorityFilter, statusFilter, areaFilter]);

  useEffect(() => {
    fetchIncidents();
  }, [fetchIncidents]);

  // Fetch individual priority incident details
  useEffect(() => {
    if (!selectedIncidentId) {
      setIncidentDetails(null);
      return;
    }

    const fetchIncidentDetails = async () => {
      setDetailsLoading(true);
      setDetailsError(null);
      try {
        const res = await riskAPI.getIncidentById(selectedIncidentId);
        setIncidentDetails(res.data);
      } catch (err) {
        setDetailsError(err.message || 'Failed to load incident priority details');
      } finally {
        setDetailsLoading(false);
      }
    };

    fetchIncidentDetails();
  }, [selectedIncidentId]);

  // Client-side text search (matches title, area name, or responding department)
  const filteredIncidents = React.useMemo(() => {
    return incidents.filter(inc => {
      if (!search.trim()) return true;
      const term = search.toLowerCase();
      return (
        inc.title.toLowerCase().includes(term) ||
        inc.area_name.toLowerCase().includes(term) ||
        inc.severity.toLowerCase().includes(term) ||
        (inc.incident_id && inc.incident_id.toString().includes(term))
      );
    });
  }, [incidents, search]);

  const clearFilters = () => {
    setSearch('');
    setPriorityFilter('');
    setStatusFilter('');
    setAreaFilter('');
  };

  const statuses = [...new Set(incidents.map(i => i.status))];
  const areas = [...new Set(incidents.map(i => i.area_id))].sort((a, b) => a - b);

  return (
    <PageContainer title="Incidents">
      <div className="bg-navy-800 border border-navy-700 rounded-xl overflow-hidden flex flex-col h-[calc(100vh-140px)]">
        
        {/* Toolbar */}
        <div className="p-4 border-b border-navy-700 bg-navy-800/80 flex flex-col lg:flex-row gap-4 items-center justify-between">
          <div className="relative w-full lg:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search title, ID, or area..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-navy-900 border border-navy-700 rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>
          
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            {/* Priority Filter */}
            <div className="flex items-center space-x-2 bg-navy-900 border border-navy-700 rounded-lg px-3 py-1.5">
              <Zap className="w-4 h-4 text-slate-400" />
              <select 
                value={priorityFilter} 
                onChange={e => setPriorityFilter(e.target.value)} 
                className="bg-transparent text-sm text-slate-200 outline-none w-32 appearance-none"
              >
                <option value="">All Priorities</option>
                <option value="Routine">Routine</option>
                <option value="Elevated">Elevated</option>
                <option value="Urgent">Urgent</option>
                <option value="Immediate">Immediate</option>
              </select>
            </div>

            {/* Status Filter */}
            <div className="flex items-center space-x-2 bg-navy-900 border border-navy-700 rounded-lg px-3 py-1.5">
              <select 
                value={statusFilter} 
                onChange={e => setStatusFilter(e.target.value)} 
                className="bg-transparent text-sm text-slate-200 outline-none w-28 appearance-none"
              >
                <option value="">All Statuses</option>
                {statuses.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {/* Area Filter */}
            <div className="flex items-center space-x-2 bg-navy-900 border border-navy-700 rounded-lg px-3 py-1.5">
              <select 
                value={areaFilter} 
                onChange={e => setAreaFilter(e.target.value)} 
                className="bg-transparent text-sm text-slate-200 outline-none w-24 appearance-none"
              >
                <option value="">All Areas</option>
                {areas.map(a => <option key={a} value={a}>Area {a}</option>)}
              </select>
            </div>

            {(search || priorityFilter || statusFilter || areaFilter) && (
              <button 
                onClick={clearFilters} 
                className="text-xs text-slate-400 hover:text-white flex items-center bg-navy-700 px-2 py-1.5 rounded-lg transition-colors"
              >
                <X className="w-3 h-3 mr-1" /> Clear
              </button>
            )}
          </div>
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-auto p-0">
          {loading ? (
            <div className="pt-20"><LoadingState message="Calculating dispatch priorities..." /></div>
          ) : error ? (
            <div className="p-8">
              <ErrorState 
                message="Dynamic priority intelligence is unavailable. Ensure connection is active." 
                details={error}
                onRetry={fetchIncidents} 
              />
            </div>
          ) : filteredIncidents.length === 0 ? (
            <div className="pt-20"><EmptyState message="No incidents found matching criteria" /></div>
          ) : (
            <div>
              <div className="px-6 py-3 bg-navy-900/50 text-xs font-medium text-slate-400 uppercase tracking-wider flex justify-between items-center border-b border-navy-700">
                <span>{filteredIncidents.length} Prioritized Incidents</span>
                <span className="flex items-center gap-1">
                  <Brain className="w-3 h-3 text-blue-400" /> Deterministic Sorting Active
                </span>
              </div>
              <div className="divide-y divide-navy-700/50">
                {filteredIncidents.map((inc, index) => (
                  <div 
                    key={inc.incident_id} 
                    onClick={() => setSelectedIncidentId(inc.incident_id)}
                    className="p-4 px-6 hover:bg-navy-700/30 cursor-pointer transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-xs font-bold text-slate-500">#{index + 1}</span>
                        <h4 className="font-semibold text-white truncate text-base">{inc.title}</h4>
                      </div>
                      <p className="text-xs text-slate-400 flex flex-wrap gap-x-2 gap-y-1">
                        <span>Area: <strong className="text-slate-300">{inc.area_name} (#{inc.area_id})</strong></span>
                        <span>•</span>
                        <span>Urgency: <strong className="text-blue-300">{inc.recommended_response_urgency}</strong></span>
                        <span>•</span>
                        <span>Calculated: {formatDate(inc.last_calculated)}</span>
                      </p>
                      
                      {/* Priority Reasons Preview */}
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        {inc.reasons.slice(0, 2).map((reason, idx) => (
                          <span key={idx} className="text-[10px] bg-navy-900 text-slate-400 px-2 py-0.5 rounded border border-navy-700/50">
                            {reason}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 self-start md:self-center flex-shrink-0">
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-[10px] text-slate-500 font-semibold uppercase">Priority Score</span>
                        <span className="text-sm font-bold text-white bg-navy-900 border border-navy-700 px-2 py-0.5 rounded">
                          {inc.priority_score.toFixed(1)}
                        </span>
                      </div>
                      <div className="flex flex-col items-start gap-1">
                        <span className="text-[10px] text-slate-500 font-semibold uppercase">Level</span>
                        <PriorityBadge level={inc.priority_level} />
                      </div>
                      <div className="flex flex-col items-start gap-1">
                        <span className="text-[10px] text-slate-500 font-semibold uppercase">Status</span>
                        <StatusBadge status={inc.status} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Incident Details Modal */}
      <Modal 
        isOpen={!!selectedIncidentId} 
        onClose={() => setSelectedIncidentId(null)}
        title="Incident Prioritization Details"
      >
        {detailsLoading ? (
          <div className="py-12"><LoadingState message="Fetching prioritization analysis..." /></div>
        ) : detailsError ? (
          <div className="p-6">
            <ErrorState message="Could not fetch priority analysis details" details={detailsError} />
          </div>
        ) : incidentDetails ? (
          <div className="space-y-6">
            {/* Header info */}
            <div className="flex justify-between items-start border-b border-navy-700 pb-3">
              <div>
                <h3 className="text-xl font-bold text-white">{incidentDetails.title}</h3>
                <p className="text-xs text-slate-400 mt-1">Area Location: {incidentDetails.area_name} (Area ID: {incidentDetails.area_id})</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <StatusBadge status={incidentDetails.status} />
                <span className="text-[9px] text-slate-500 font-mono mt-1">
                  Updated: {formatDate(incidentDetails.last_calculated)}
                </span>
              </div>
            </div>

            {/* Phase 2 priority scorecard */}
            <div className="bg-navy-900 border border-navy-700 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-navy-750 pb-3">
                <h4 className="text-white font-semibold text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-yellow-400" /> Priority Intelligence (Phase 2)
                </h4>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">Score:</span>
                  <span className="text-sm font-extrabold text-white bg-navy-950 px-2 py-0.5 rounded border border-navy-700">
                    {incidentDetails.priority_score.toFixed(1)}
                  </span>
                  <PriorityBadge level={incidentDetails.priority_level} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500">Urgency recommendation</span>
                  <p className="text-slate-300 font-medium mt-0.5">{incidentDetails.recommended_response_urgency}</p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500">Resource Scarcity Level</span>
                  <p className="text-slate-300 font-medium mt-0.5">
                    {incidentDetails.component_scores?.resource_scarcity?.toFixed(1) || '0.0'}/100 
                    <span className="text-[10px] text-slate-500 ml-1">
                      (Target: 5 available nearby)
                    </span>
                  </p>
                </div>
              </div>

              {/* Reasons */}
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500">Primary Dispatch Reasons</span>
                <ul className="mt-1.5 space-y-1">
                  {incidentDetails.reasons.map((reason, idx) => (
                    <li key={idx} className="text-slate-300 text-xs flex items-start gap-1.5">
                      <span className="text-yellow-400 mt-0.5">•</span>
                      <span>{reason}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Score Component Breakdown bars */}
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500">Formula Component Scores</span>
                <div className="mt-2.5 space-y-2">
                  {[
                    { label: 'Severity Score', key: 'severity', color: 'bg-red-500' },
                    { label: 'Recency Score', key: 'recency', color: 'bg-orange-500' },
                    { label: 'Area Risk Score', key: 'area_risk', color: 'bg-purple-500' },
                    { label: 'Status Weight', key: 'status', color: 'bg-yellow-500' },
                    { label: 'Resource Scarcity', key: 'resource_scarcity', color: 'bg-blue-500' }
                  ].map(comp => {
                    const value = incidentDetails.component_scores?.[comp.key] || 0;
                    return (
                      <div key={comp.key} className="flex items-center justify-between text-[11px] text-slate-400">
                        <span className="w-28">{comp.label}</span>
                        <div className="flex-1 bg-navy-950 h-1.5 rounded-full mx-3 overflow-hidden">
                          <div className={`h-full ${comp.color}`} style={{ width: `${value}%` }} />
                        </div>
                        <span className="w-10 text-right text-slate-200 font-semibold">{value.toFixed(1)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Phase 1 core details preservation */}
            <div className="bg-navy-900/40 border border-navy-700/50 rounded-xl p-5">
              <h4 className="text-slate-400 font-semibold text-xs uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-slate-400" /> Core Incident Data (Phase 1)
              </h4>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-slate-500 font-medium">Severity Classification</span>
                  <p className="text-slate-300 mt-0.5">{incidentDetails.severity}</p>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">Status</span>
                  <p className="text-slate-300 mt-0.5">{incidentDetails.status}</p>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-navy-700/50">
              <button 
                onClick={() => setSelectedIncidentId(null)}
                className="px-4 py-2 bg-navy-700 hover:bg-navy-600 rounded-lg text-sm font-medium text-white transition-colors border border-navy-600"
              >
                Close Details
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </PageContainer>
  );
};

export default Incidents;
