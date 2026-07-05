import { useState, useEffect, useMemo } from 'react';
import PageContainer from '../components/layout/PageContainer';
import EmptyState from '../components/common/EmptyState';
import LoadingState from '../components/common/LoadingState';
import ErrorState from '../components/common/ErrorState';
import StatusBadge from '../components/common/StatusBadge';
import Modal from '../components/common/Modal';
import DispatchDetailsDrawer from '../components/common/DispatchDetailsDrawer';
import { resourcesAPI, dispatchAPI } from '../services/api';
import { formatDate } from '../utils/formatters';
import { Search, Filter, X, Shield, Truck, Siren, Settings, Eye } from 'lucide-react';

const Resources = () => {
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedResource, setSelectedResource] = useState(null);
  const [selectedDispatchId, setSelectedDispatchId] = useState(null);

  // Filters
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [areaFilter, setAreaFilter] = useState('');

  const fetchResources = async () => {
    setLoading(true);
    setError(null);
    try {
      const [resRes, dispRes] = await Promise.all([
        resourcesAPI.getAll(),
        dispatchAPI.getAll({ active_only: true })
      ]);
      
      const resourcesData = resRes.data;
      const activeDispatches = dispRes.data;
      
      const mapping = {};
      activeDispatches.forEach(disp => {
        disp.assignments.forEach(asg => {
          mapping[asg.resource_id] = {
            dispatch_code: disp.dispatch_code,
            dispatch_id: disp.id,
            role: asg.role,
            status: asg.status
          };
        });
      });
      
      const enrichedResources = resourcesData.map(res => ({
        ...res,
        active_dispatch: mapping[res.id] || null
      }));
      
      setResources(enrichedResources);
    } catch (err) {
      setError(err.message || 'Failed to load resources');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResources();
  }, []);

  const filteredResources = useMemo(() => {
    return resources.filter(res => {
      const matchesSearch = res.resource_code.toLowerCase().includes(search.toLowerCase());
      const matchesType = typeFilter ? res.resource_type === typeFilter : true;
      const matchesStatus = statusFilter ? res.status === statusFilter : true;
      const matchesArea = areaFilter ? (res.area_id && res.area_id.toString() === areaFilter) : true;
      return matchesSearch && matchesType && matchesStatus && matchesArea;
    });
  }, [resources, search, typeFilter, statusFilter, areaFilter]);

  const clearFilters = () => {
    setSearch('');
    setTypeFilter('');
    setStatusFilter('');
    setAreaFilter('');
  };

  const types = [...new Set(resources.map(r => r.resource_type))];
  const statuses = [...new Set(resources.map(r => r.status))];
  const areas = [...new Set(resources.map(r => r.area_id))].filter(Boolean);

  // Summary counts
  const total = resources.length;
  const available = resources.filter(r => r.status === 'Available').length;
  const dispatched = resources.filter(r => r.status === 'Dispatched').length;
  const onScene = resources.filter(r => r.status === 'On Scene').length;
  const returning = resources.filter(r => r.status === 'Returning').length;
  const maintenance = resources.filter(r => ['Maintenance', 'Offline'].includes(r.status)).length;

  const getIcon = (type) => {
    if (type === 'Ambulance') return <Siren className="w-5 h-5 text-red-400" />;
    if (type === 'Police Vehicle') return <Shield className="w-5 h-5 text-blue-400" />;
    if (type === 'Fire Engine') return <Truck className="w-5 h-5 text-orange-400" />;
    return <Settings className="w-5 h-5 text-slate-400" />;
  };

  return (
    <PageContainer title="Emergency Resources">
      
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        {[
          { label: 'Total', count: total, color: 'text-slate-200' },
          { label: 'Available', count: available, color: 'text-emerald-400' },
          { label: 'Dispatched', count: dispatched, color: 'text-orange-400' },
          { label: 'On Scene', count: onScene, color: 'text-red-400' },
          { label: 'Returning', count: returning, color: 'text-blue-400' },
          { label: 'Maintenance', count: maintenance, color: 'text-slate-500' },
        ].map(stat => (
          <div key={stat.label} className="bg-navy-800 border border-navy-700 rounded-xl p-4 flex flex-col items-center justify-center">
            <span className={`text-2xl font-bold ${stat.color}`}>{stat.count}</span>
            <span className="text-xs text-slate-400 uppercase tracking-wider mt-1">{stat.label}</span>
          </div>
        ))}
      </div>

      <div className="bg-navy-800 border border-navy-700 rounded-xl overflow-hidden flex flex-col h-[calc(100vh-270px)]">
        
        {/* Toolbar */}
        <div className="p-4 border-b border-navy-700 bg-navy-800/80 flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search code..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-navy-900 border border-navy-700 rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>
          
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            <div className="flex items-center space-x-2 bg-navy-900 border border-navy-700 rounded-lg px-3 py-1.5">
              <Filter className="w-4 h-4 text-slate-400" />
              <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="bg-transparent text-sm text-slate-200 outline-none w-28 appearance-none">
                <option value="">All Types</option>
                {types.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="flex items-center space-x-2 bg-navy-900 border border-navy-700 rounded-lg px-3 py-1.5">
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="bg-transparent text-sm text-slate-200 outline-none w-28 appearance-none">
                <option value="">All Statuses</option>
                {statuses.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="flex items-center space-x-2 bg-navy-900 border border-navy-700 rounded-lg px-3 py-1.5">
              <select value={areaFilter} onChange={e => setAreaFilter(e.target.value)} className="bg-transparent text-sm text-slate-200 outline-none w-24 appearance-none">
                <option value="">All Areas</option>
                {areas.map(a => <option key={a} value={a}>Area {a}</option>)}
              </select>
            </div>
            {(search || typeFilter || statusFilter || areaFilter) && (
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
            <div className="p-8"><ErrorState message={error} onRetry={fetchResources} /></div>
          ) : filteredResources.length === 0 ? (
            <div className="pt-20"><EmptyState message="No resources found matching your criteria" /></div>
          ) : (
            <div>
              <div className="px-6 py-3 bg-navy-900/50 text-xs font-medium text-slate-400 uppercase tracking-wider flex justify-between items-center border-b border-navy-700">
                <span>{filteredResources.length} Results</span>
              </div>
              <div className="divide-y divide-navy-700/50">
                {filteredResources.map(res => (
                  <div 
                    key={res.id} 
                    onClick={() => setSelectedResource(res)}
                    className="p-4 px-6 hover:bg-navy-700/30 cursor-pointer transition-colors flex items-center justify-between"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-navy-900 rounded-lg border border-navy-700">
                        {getIcon(res.resource_type)}
                      </div>
                      <div>
                        <h4 className="font-medium text-white mb-1 flex items-center gap-2">
                          {res.resource_code}
                          <span className="text-xs font-normal text-slate-400 px-2 py-0.5 rounded bg-navy-900 border border-navy-700">
                            {res.resource_type}
                          </span>
                        </h4>
                        <p className="text-xs text-slate-400">
                          {res.area_id ? `Area: ${res.area_id}` : 'No Area Assigned'} 
                          {res.assigned_incident_id && ` • Incident: #${res.assigned_incident_id}`}
                          {res.active_dispatch && ` • Dispatch: ${res.active_dispatch.dispatch_code} (${res.active_dispatch.role})`}
                        </p>
                        <p className="text-[10px] text-slate-500 mt-1 font-mono">
                          Last change: {formatDate(res.last_updated)}
                        </p>
                      </div>
                    </div>
                    <div>
                      <StatusBadge status={res.status} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Details Modal */}
      <Modal 
        isOpen={!!selectedResource} 
        onClose={() => setSelectedResource(null)}
        title="Resource Details"
      >
        {selectedResource && (
          <div className="space-y-6">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-navy-900 rounded-xl border border-navy-700">
                  {getIcon(selectedResource.resource_type)}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">{selectedResource.resource_code}</h3>
                  <p className="text-slate-400 text-sm">{selectedResource.resource_type}</p>
                </div>
              </div>
              <StatusBadge status={selectedResource.status} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-navy-900 p-4 rounded-lg border border-navy-700">
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Current Area</p>
                <p className="text-slate-200 font-medium">{selectedResource.area_id ? `Area ${selectedResource.area_id}` : 'N/A'}</p>
              </div>
              <div className="bg-navy-900 p-4 rounded-lg border border-navy-700">
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Coordinates</p>
                <p className="text-slate-200 font-medium">
                  {selectedResource.latitude?.toFixed(4) || 'N/A'}, {selectedResource.longitude?.toFixed(4) || 'N/A'}
                </p>
              </div>
              <div className="bg-navy-900 p-4 rounded-lg border border-navy-700">
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Assigned Incident</p>
                <p className="text-blue-300 font-medium">{selectedResource.assigned_incident_id ? `#${selectedResource.assigned_incident_id}` : 'None'}</p>
              </div>
              <div className="bg-navy-900 p-4 rounded-lg border border-navy-700">
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Capacity</p>
                <p className="text-slate-200 font-medium">{selectedResource.capacity || 'N/A'}</p>
              </div>

              {/* Phase 3 Active Dispatch Details */}
              {selectedResource.active_dispatch ? (
                <>
                  <div className="bg-navy-900 p-4 rounded-lg border border-navy-700 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Active Dispatch</p>
                      <p className="text-blue-300 font-medium font-mono">{selectedResource.active_dispatch.dispatch_code}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedDispatchId(selectedResource.active_dispatch.dispatch_id);
                        setSelectedResource(null);
                      }}
                      className="p-1 bg-navy-800 hover:bg-navy-750 border border-navy-700 rounded text-slate-300 hover:text-white"
                      title="View Dispatch details"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="bg-navy-900 p-4 rounded-lg border border-navy-700">
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Dispatch Role</p>
                    <p className="text-slate-200 font-medium font-mono">{selectedResource.active_dispatch.role}</p>
                  </div>
                </>
              ) : null}

              <div className="bg-navy-900 p-4 rounded-lg border border-navy-700 col-span-2">
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Last Status Change</p>
                <p className="text-slate-200 font-medium">{formatDate(selectedResource.last_updated)}</p>
              </div>
            </div>
            
            <div className="flex justify-end pt-4 border-t border-navy-700/50 mt-6">
              <button 
                onClick={() => setSelectedResource(null)}
                className="px-4 py-2 bg-navy-700 hover:bg-navy-600 rounded-lg text-sm font-medium text-white transition-colors border border-navy-600"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Dispatch Details Drawer */}
      <DispatchDetailsDrawer
        isOpen={!!selectedDispatchId}
        onClose={() => setSelectedDispatchId(null)}
        dispatchId={selectedDispatchId}
        onTransitionSuccess={fetchResources}
      />
    </PageContainer>
  );
};

export default Resources;
