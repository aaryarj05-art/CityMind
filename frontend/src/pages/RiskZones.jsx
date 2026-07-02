import { useState, useEffect, useMemo } from 'react';
import PageContainer from '../components/layout/PageContainer';
import EmptyState from '../components/common/EmptyState';
import LoadingState from '../components/common/LoadingState';
import ErrorState from '../components/common/ErrorState';
import StatusBadge from '../components/common/StatusBadge';
import Modal from '../components/common/Modal';
import { areasAPI } from '../services/api';
import { formatDate } from '../utils/formatters';
import { Search, Filter, X } from 'lucide-react';

const RiskZones = () => {
  const [areas, setAreas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedArea, setSelectedArea] = useState(null);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [minScoreFilter, setMinScoreFilter] = useState('');

  const fetchAreas = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await areasAPI.getAll();
      setAreas(res.data);
    } catch (err) {
      setError(err.message || 'Failed to load areas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAreas();
  }, []);

  const filteredAreas = useMemo(() => {
    return areas.filter(a => {
      const matchesSearch = a.name.toLowerCase().includes(search.toLowerCase()) || 
                            a.ward_number.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter ? a.status === statusFilter : true;
      const matchesScore = minScoreFilter ? a.operational_score >= parseInt(minScoreFilter, 10) : true;
      return matchesSearch && matchesStatus && matchesScore;
    });
  }, [areas, search, statusFilter, minScoreFilter]);

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('');
    setMinScoreFilter('');
  };

  const statuses = [...new Set(areas.map(a => a.status))];

  return (
    <PageContainer title="Risk Zones">
      <div className="bg-navy-800 border border-navy-700 rounded-xl overflow-hidden flex flex-col h-[calc(100vh-140px)]">
        
        {/* Toolbar */}
        <div className="p-4 border-b border-navy-700 bg-navy-800/80 flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search area or ward..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-navy-900 border border-navy-700 rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>
          
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            <div className="flex items-center space-x-2 bg-navy-900 border border-navy-700 rounded-lg px-3 py-1.5">
              <Filter className="w-4 h-4 text-slate-400" />
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="bg-transparent text-sm text-slate-200 outline-none w-28 appearance-none">
                <option value="">All Statuses</option>
                {statuses.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="flex items-center space-x-2 bg-navy-900 border border-navy-700 rounded-lg px-3 py-1.5">
              <select value={minScoreFilter} onChange={e => setMinScoreFilter(e.target.value)} className="bg-transparent text-sm text-slate-200 outline-none w-32 appearance-none">
                <option value="">Min Score: Any</option>
                <option value="50">Min Score: 50+</option>
                <option value="70">Min Score: 70+</option>
                <option value="85">Min Score: 85+</option>
              </select>
            </div>
            {(search || statusFilter || minScoreFilter) && (
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
            <div className="p-8"><ErrorState message={error} onRetry={fetchAreas} /></div>
          ) : filteredAreas.length === 0 ? (
            <div className="pt-20"><EmptyState message="No areas found matching your criteria" /></div>
          ) : (
            <div>
              <div className="px-6 py-3 bg-navy-900/50 text-xs font-medium text-slate-400 uppercase tracking-wider flex justify-between items-center border-b border-navy-700">
                <span>{filteredAreas.length} Results</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-navy-900/50 text-slate-400 uppercase text-xs">
                    <tr>
                      <th className="px-6 py-4 font-medium">Area</th>
                      <th className="px-6 py-4 font-medium">Score</th>
                      <th className="px-6 py-4 font-medium">Status</th>
                      <th className="px-6 py-4 font-medium">Main Issue</th>
                      <th className="px-6 py-4 font-medium">Traffic</th>
                      <th className="px-6 py-4 font-medium">Complaints</th>
                      <th className="px-6 py-4 font-medium">Incidents</th>
                      <th className="px-6 py-4 font-medium">Updated</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-navy-700/50">
                    {filteredAreas.map((zone) => (
                      <tr 
                        key={zone.id} 
                        onClick={() => setSelectedArea(zone)}
                        className="hover:bg-navy-700/30 transition-colors cursor-pointer"
                      >
                        <td className="px-6 py-4">
                          <div className="font-medium text-white">{zone.name}</div>
                          <div className="text-xs text-slate-500">{zone.ward_number}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            <span className={`font-bold ${zone.operational_score > 80 ? 'text-red-400' : zone.operational_score > 60 ? 'text-orange-400' : 'text-emerald-400'}`}>
                              {zone.operational_score}
                            </span>
                            <span className="text-slate-500 ml-1">/100</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <StatusBadge status={zone.status} />
                        </td>
                        <td className="px-6 py-4 text-slate-300">
                          {zone.main_issue}
                        </td>
                        <td className="px-6 py-4 text-slate-300">
                          {zone.traffic_level}
                        </td>
                        <td className="px-6 py-4 text-slate-300">
                          {zone.complaint_count}
                        </td>
                        <td className="px-6 py-4 text-slate-300">
                          {zone.active_incident_count}
                        </td>
                        <td className="px-6 py-4 text-slate-400 text-xs">
                          {formatDate(zone.last_updated)}
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

      {/* Details Modal */}
      <Modal 
        isOpen={!!selectedArea} 
        onClose={() => setSelectedArea(null)}
        title="Area Details"
      >
        {selectedArea && (
          <div className="space-y-6">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-xl font-bold text-white">{selectedArea.name}</h3>
                <p className="text-slate-400 text-sm mt-1">{selectedArea.ward_number}</p>
              </div>
              <StatusBadge status={selectedArea.status} />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="bg-navy-900 p-4 rounded-lg border border-navy-700">
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Operational Score</p>
                <p className={`text-2xl font-bold ${selectedArea.operational_score > 80 ? 'text-red-400' : selectedArea.operational_score > 60 ? 'text-orange-400' : 'text-emerald-400'}`}>
                  {selectedArea.operational_score}<span className="text-sm text-slate-500">/100</span>
                </p>
              </div>
              <div className="bg-navy-900 p-4 rounded-lg border border-navy-700">
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Main Issue</p>
                <p className="text-slate-200 font-medium">{selectedArea.main_issue}</p>
              </div>
              <div className="bg-navy-900 p-4 rounded-lg border border-navy-700">
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Active Incidents</p>
                <p className="text-slate-200 font-medium">{selectedArea.active_incident_count}</p>
              </div>
              <div className="bg-navy-900 p-4 rounded-lg border border-navy-700">
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Traffic Level</p>
                <p className="text-slate-200 font-medium">{selectedArea.traffic_level}</p>
              </div>
              <div className="bg-navy-900 p-4 rounded-lg border border-navy-700">
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Rainfall (mm)</p>
                <p className="text-slate-200 font-medium">{selectedArea.rainfall} mm</p>
              </div>
              <div className="bg-navy-900 p-4 rounded-lg border border-navy-700">
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Open Complaints</p>
                <p className="text-slate-200 font-medium">{selectedArea.complaint_count}</p>
              </div>
              <div className="bg-navy-900 p-4 rounded-lg border border-navy-700 col-span-2 md:col-span-3">
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Last Updated</p>
                <p className="text-slate-200 font-medium">{formatDate(selectedArea.last_updated)}</p>
              </div>
            </div>
            
            <div className="flex justify-end pt-4 border-t border-navy-700/50 mt-6">
              <button 
                onClick={() => setSelectedArea(null)}
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

export default RiskZones;
