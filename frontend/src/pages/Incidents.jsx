import { useState, useEffect, useMemo } from 'react';
import PageContainer from '../components/layout/PageContainer';
import EmptyState from '../components/common/EmptyState';
import LoadingState from '../components/common/LoadingState';
import ErrorState from '../components/common/ErrorState';
import StatusBadge from '../components/common/StatusBadge';
import Modal from '../components/common/Modal';
import { incidentsAPI } from '../services/api';
import { formatDate } from '../utils/formatters';
import { Search, Filter, X } from 'lucide-react';

const Incidents = () => {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedIncident, setSelectedIncident] = useState(null);

  // Filters
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const fetchIncidents = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await incidentsAPI.getAll();
      setIncidents(res.data);
    } catch (err) {
      setError(err.message || 'Failed to load incidents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIncidents();
  }, []);

  const filteredIncidents = useMemo(() => {
    return incidents.filter(inc => {
      const matchesSearch = inc.title.toLowerCase().includes(search.toLowerCase()) || 
                            (inc.area_id && inc.area_id.toString().includes(search));
      const matchesCategory = categoryFilter ? inc.category === categoryFilter : true;
      const matchesSeverity = severityFilter ? inc.severity === severityFilter : true;
      const matchesStatus = statusFilter ? inc.status === statusFilter : true;
      return matchesSearch && matchesCategory && matchesSeverity && matchesStatus;
    });
  }, [incidents, search, categoryFilter, severityFilter, statusFilter]);

  const clearFilters = () => {
    setSearch('');
    setCategoryFilter('');
    setSeverityFilter('');
    setStatusFilter('');
  };

  const categories = [...new Set(incidents.map(i => i.category))];
  const severities = [...new Set(incidents.map(i => i.severity))];
  const statuses = [...new Set(incidents.map(i => i.status))];

  return (
    <PageContainer title="Incidents">
      <div className="bg-navy-800 border border-navy-700 rounded-xl overflow-hidden flex flex-col h-[calc(100vh-140px)]">
        
        {/* Toolbar */}
        <div className="p-4 border-b border-navy-700 bg-navy-800/80 flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search incidents..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-navy-900 border border-navy-700 rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>
          
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            <div className="flex items-center space-x-2 bg-navy-900 border border-navy-700 rounded-lg px-3 py-1.5">
              <Filter className="w-4 h-4 text-slate-400" />
              <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="bg-transparent text-sm text-slate-200 outline-none w-28 appearance-none">
                <option value="">All Categories</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="flex items-center space-x-2 bg-navy-900 border border-navy-700 rounded-lg px-3 py-1.5">
              <select value={severityFilter} onChange={e => setSeverityFilter(e.target.value)} className="bg-transparent text-sm text-slate-200 outline-none w-24 appearance-none">
                <option value="">All Severities</option>
                {severities.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="flex items-center space-x-2 bg-navy-900 border border-navy-700 rounded-lg px-3 py-1.5">
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="bg-transparent text-sm text-slate-200 outline-none w-24 appearance-none">
                <option value="">All Statuses</option>
                {statuses.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            {(search || categoryFilter || severityFilter || statusFilter) && (
              <button onClick={clearFilters} className="text-xs text-slate-400 hover:text-white flex items-center bg-navy-700 px-2 py-1.5 rounded-lg transition-colors">
                <X className="w-3 h-3 mr-1" /> Clear
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-0">
          {loading ? (
            <div className="pt-20"><LoadingState /></div>
          ) : error ? (
            <div className="p-8"><ErrorState message={error} onRetry={fetchIncidents} /></div>
          ) : filteredIncidents.length === 0 ? (
            <div className="pt-20"><EmptyState message="No incidents found matching your criteria" /></div>
          ) : (
            <div>
              <div className="px-6 py-3 bg-navy-900/50 text-xs font-medium text-slate-400 uppercase tracking-wider flex justify-between items-center border-b border-navy-700">
                <span>{filteredIncidents.length} Results</span>
              </div>
              <div className="divide-y divide-navy-700/50">
                {filteredIncidents.map(inc => (
                  <div 
                    key={inc.id} 
                    onClick={() => setSelectedIncident(inc)}
                    className="p-4 px-6 hover:bg-navy-700/30 cursor-pointer transition-colors flex items-center justify-between"
                  >
                    <div>
                      <h4 className="font-medium text-white mb-1">{inc.title}</h4>
                      <p className="text-xs text-slate-400">Area ID: {inc.area_id} • Reported: {formatDate(inc.reported_at)}</p>
                      <div className="flex gap-2 mt-2">
                        <span className="text-xs px-2 py-0.5 rounded bg-navy-900 text-slate-300 border border-navy-700">{inc.category}</span>
                        <span className={`text-xs px-2 py-0.5 rounded border ${
                          inc.severity === 'Critical' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                          inc.severity === 'High' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
                          'bg-navy-900 text-slate-300 border-navy-700'
                        }`}>
                          Severity: {inc.severity}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded bg-navy-900 text-slate-300 border border-navy-700 text-blue-300">Resp: {inc.responding_department}</span>
                      </div>
                    </div>
                    <div>
                      <StatusBadge status={inc.status} />
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
        isOpen={!!selectedIncident} 
        onClose={() => setSelectedIncident(null)}
        title="Incident Details"
      >
        {selectedIncident && (
          <div className="space-y-6">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-semibold text-white">{selectedIncident.title}</h3>
                <p className="text-slate-400 mt-1">{selectedIncident.description}</p>
              </div>
              <StatusBadge status={selectedIncident.status} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-navy-900 p-4 rounded-lg border border-navy-700">
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Category</p>
                <p className="text-slate-200 font-medium">{selectedIncident.category}</p>
              </div>
              <div className="bg-navy-900 p-4 rounded-lg border border-navy-700">
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Severity</p>
                <p className={`font-medium ${
                  selectedIncident.severity === 'Critical' ? 'text-red-400' :
                  selectedIncident.severity === 'High' ? 'text-orange-400' : 'text-slate-200'
                }`}>{selectedIncident.severity}</p>
              </div>
              <div className="bg-navy-900 p-4 rounded-lg border border-navy-700">
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Responding Dept</p>
                <p className="text-blue-300 font-medium">{selectedIncident.responding_department}</p>
              </div>
              <div className="bg-navy-900 p-4 rounded-lg border border-navy-700">
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Location</p>
                <p className="text-slate-200 font-medium">Area {selectedIncident.area_id} <br/><span className="text-xs text-slate-400">Lat: {selectedIncident.latitude.toFixed(4)}, Lng: {selectedIncident.longitude.toFixed(4)}</span></p>
              </div>
              <div className="bg-navy-900 p-4 rounded-lg border border-navy-700">
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Reported At</p>
                <p className="text-slate-200 font-medium">{formatDate(selectedIncident.reported_at)}</p>
              </div>
              <div className="bg-navy-900 p-4 rounded-lg border border-navy-700">
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Last Updated</p>
                <p className="text-slate-200 font-medium">{formatDate(selectedIncident.updated_at)}</p>
              </div>
            </div>
            
            <div className="flex justify-end pt-4">
              <button 
                onClick={() => setSelectedIncident(null)}
                className="px-4 py-2 bg-navy-700 hover:bg-navy-600 rounded-lg text-sm font-medium text-white transition-colors border border-navy-600"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
    </PageContainer>
  );
};

export default Incidents;
