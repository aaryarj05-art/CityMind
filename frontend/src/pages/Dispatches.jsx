import React, { useState, useEffect, useCallback } from 'react';
import PageContainer from '../components/layout/PageContainer';
import EmptyState from '../components/common/EmptyState';
import LoadingState from '../components/common/LoadingState';
import ErrorState from '../components/common/ErrorState';
import DispatchStatusBadge from '../components/common/DispatchStatusBadge';
import DispatchSummaryCard from '../components/common/DispatchSummaryCard';
import DispatchDetailsDrawer from '../components/common/DispatchDetailsDrawer';
import PlanCompletenessBadge from '../components/common/PlanCompletenessBadge';
import { dispatchAPI, incidentsAPI, resourcesAPI } from '../services/api';
import { formatDate } from '../utils/formatters';
import { 
  Search, Filter, X, Send, Activity, Clock, AlertTriangle, Shield, CheckCircle2 
} from 'lucide-react';

const Dispatches = () => {
  const [dispatches, setDispatches] = useState([]);
  const [summary, setSummary] = useState(null);
  const [incidents, setIncidents] = useState([]);
  const [resources, setResources] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Selected dispatch for details drawer
  const [selectedDispatchId, setSelectedDispatchId] = useState(null);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [incidentFilter, setIncidentFilter] = useState('');
  const [resourceFilter, setResourceFilter] = useState('');
  const [activeOnly, setActiveOnly] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (statusFilter) params.status = statusFilter;
      if (incidentFilter) params.incident_id = parseInt(incidentFilter, 10);
      if (resourceFilter) params.resource_id = parseInt(resourceFilter, 10);
      if (activeOnly) params.active_only = true;

      const [dispRes, sumRes, incRes, resRes] = await Promise.all([
        dispatchAPI.getAll(params),
        dispatchAPI.getSummary(),
        incidentsAPI.getAll(),
        resourcesAPI.getAll()
      ]);

      setDispatches(dispRes.data);
      setSummary(sumRes.data);
      setIncidents(incRes.data);
      setResources(resRes.data);
    } catch (err) {
      setError(err.message || 'Failed to fetch dispatch list or summary data.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, incidentFilter, resourceFilter, activeOnly]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Client-side text search by dispatch code
  const filteredDispatches = React.useMemo(() => {
    return dispatches.filter(disp => {
      if (!search.trim()) return true;
      const term = search.toLowerCase();
      return (
        disp.dispatch_code.toLowerCase().includes(term) ||
        (disp.notes && disp.notes.toLowerCase().includes(term))
      );
    });
  }, [dispatches, search]);

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('');
    setIncidentFilter('');
    setResourceFilter('');
    setActiveOnly(false);
  };

  const statuses = ["Planned", "Dispatched", "En Route", "On Scene", "Transporting", "Completed", "Cancelled"];

  return (
    <PageContainer title="Simulated Dispatches">
      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <DispatchSummaryCard 
            title="Active Dispatches" 
            value={summary.active_dispatch_count} 
            icon={Send} 
            color="blue" 
          />
          <DispatchSummaryCard 
            title="Assigned Resources" 
            value={summary.resources_currently_assigned} 
            icon={Shield} 
            color="orange" 
          />
          <DispatchSummaryCard 
            title="Average ETA" 
            value={`${summary.average_eta.toFixed(1)} m`} 
            icon={Clock} 
            color="yellow" 
          />
          <DispatchSummaryCard 
            title="Incomplete Plans" 
            value={summary.incomplete_response_plan_count} 
            icon={AlertTriangle} 
            color="red" 
          />
        </div>
      )}

      {/* Main Container */}
      <div className="bg-navy-800 border border-navy-700 rounded-xl overflow-hidden flex flex-col h-[calc(100vh-270px)]">
        
        {/* Toolbar */}
        <div className="p-4 border-b border-navy-700 bg-navy-800/80 flex flex-col lg:flex-row gap-4 items-center justify-between">
          <div className="relative w-full lg:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search dispatch code or notes..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-navy-900 border border-navy-700 rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>
          
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            {/* Active Only Filter */}
            <label className="flex items-center gap-2 text-xs text-slate-300 font-semibold cursor-pointer select-none bg-navy-900 border border-navy-700 px-3 py-2 rounded-lg hover:bg-navy-750 transition-colors">
              <input
                type="checkbox"
                checked={activeOnly}
                onChange={e => setActiveOnly(e.target.checked)}
                className="rounded border-navy-700 text-blue-600 focus:ring-0 focus:ring-offset-0 bg-navy-850"
              />
              Active Only
            </label>

            {/* Status Filter */}
            <div className="flex items-center space-x-2 bg-navy-900 border border-navy-700 rounded-lg px-3 py-1.5">
              <Filter className="w-4 h-4 text-slate-400" />
              <select 
                value={statusFilter} 
                onChange={e => setStatusFilter(e.target.value)} 
                className="bg-transparent text-sm text-slate-200 outline-none w-28 appearance-none"
              >
                <option value="">All Statuses</option>
                {statuses.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {/* Incident Filter */}
            <div className="flex items-center space-x-2 bg-navy-900 border border-navy-700 rounded-lg px-3 py-1.5">
              <select 
                value={incidentFilter} 
                onChange={e => setIncidentFilter(e.target.value)} 
                className="bg-transparent text-sm text-slate-200 outline-none w-32 appearance-none"
              >
                <option value="">All Incidents</option>
                {incidents.map(i => <option key={i.id} value={i.id}>Incident #{i.id}</option>)}
              </select>
            </div>

            {/* Resource Filter */}
            <div className="flex items-center space-x-2 bg-navy-900 border border-navy-700 rounded-lg px-3 py-1.5">
              <select 
                value={resourceFilter} 
                onChange={e => setResourceFilter(e.target.value)} 
                className="bg-transparent text-sm text-slate-200 outline-none w-32 appearance-none"
              >
                <option value="">All Resources</option>
                {resources.map(r => <option key={r.id} value={r.id}>{r.resource_code}</option>)}
              </select>
            </div>

            {(search || statusFilter || incidentFilter || resourceFilter || activeOnly) && (
              <button 
                onClick={clearFilters} 
                className="text-xs text-slate-400 hover:text-white flex items-center bg-navy-700 px-2 py-1.5 rounded-lg transition-colors"
              >
                <X className="w-3 h-3 mr-1" /> Clear
              </button>
            )}
          </div>
        </div>

        {/* List Content */}
        <div className="flex-1 overflow-auto p-0">
          {loading ? (
            <div className="pt-20"><LoadingState message="Fetching dispatch workflows..." /></div>
          ) : error ? (
            <div className="p-8">
              <ErrorState 
                message="Simulated dispatch data is currently offline." 
                details={error}
                onRetry={fetchData} 
              />
            </div>
          ) : filteredDispatches.length === 0 ? (
            <div className="pt-20"><EmptyState message="No dispatch records found matching your filters" /></div>
          ) : (
            <div>
              <div className="px-6 py-3 bg-navy-900/50 text-xs font-medium text-slate-400 uppercase tracking-wider flex justify-between items-center border-b border-navy-700">
                <span>{filteredDispatches.length} Dispatch Records</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-navy-900/50 text-slate-400 uppercase text-xs">
                    <tr>
                      <th className="px-6 py-4 font-medium">Dispatch Code</th>
                      <th className="px-6 py-4 font-medium">Status</th>
                      <th className="px-6 py-4 font-medium">Incident ID</th>
                      <th className="px-6 py-4 font-medium">Plan Completeness</th>
                      <th className="px-6 py-4 font-medium">Assigned Resources</th>
                      <th className="px-6 py-4 font-medium">Selected Hospital</th>
                      <th className="px-6 py-4 font-medium">ETA</th>
                      <th className="px-6 py-4 font-medium">Created At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-navy-700/50">
                    {filteredDispatches.map(disp => (
                      <tr 
                        key={disp.id}
                        onClick={() => setSelectedDispatchId(disp.id)}
                        className="hover:bg-navy-700/35 transition-colors cursor-pointer"
                      >
                        <td className="px-6 py-4 font-semibold text-white font-mono">
                          {disp.dispatch_code}
                        </td>
                        <td className="px-6 py-4">
                          <DispatchStatusBadge status={disp.status} />
                        </td>
                        <td className="px-6 py-4 font-medium text-slate-300">
                          Incident #{disp.incident_id}
                        </td>
                        <td className="px-6 py-4">
                          <PlanCompletenessBadge complete={disp.plan_complete} shortages={disp.shortages} />
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-300 max-w-xs truncate">
                          {disp.assignments.map(a => a.resource_code).join(', ') || 'None'}
                        </td>
                        <td className="px-6 py-4 text-slate-400 font-medium">
                          {disp.selected_hospital_id ? `Hospital #${disp.selected_hospital_id}` : '—'}
                        </td>
                        <td className="px-6 py-4 text-slate-200 font-semibold font-mono">
                          {disp.estimated_arrival_minutes ? `${disp.estimated_arrival_minutes.toFixed(1)} min` : '—'}
                        </td>
                        <td className="px-6 py-4 text-slate-400 font-mono text-xs">
                          {formatDate(disp.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Details Drawer */}
      <DispatchDetailsDrawer
        isOpen={!!selectedDispatchId}
        onClose={() => setSelectedDispatchId(null)}
        dispatchId={selectedDispatchId}
        onTransitionSuccess={fetchData}
      />
    </PageContainer>
  );
};

export default Dispatches;
