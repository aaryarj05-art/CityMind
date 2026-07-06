import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Search, Settings, Shield, Siren, Truck, X } from 'lucide-react';
import PageContainer from '../components/layout/PageContainer';
import LoadingState from '../components/common/LoadingState';
import ErrorState from '../components/common/ErrorState';
import EmptyState from '../components/common/EmptyState';
import Modal from '../components/common/Modal';
import StatusBadge from '../components/common/StatusBadge';
import { dashboardAPI, dispatchAPI, resourcesAPI } from '../services/api';
import { formatDate } from '../utils/formatters';
import { buildResourceParams } from '../utils/operations';

const DISCLAIMER = 'Operational simulation seeded from public Mysuru facility directories. Vehicle availability, staffing and hospital capacity are simulated for prototype demonstration.';

const Resources = () => {
  const [result, setResult] = useState({ items: [], total: 0, total_pages: 0 });
  const [bases, setBases] = useState([]);
  const [summary, setSummary] = useState({});
  const [selectedResource, setSelectedResource] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [baseId, setBaseId] = useState('');
  const [capability, setCapability] = useState('');
  const [sortBy, setSortBy] = useState('code');
  const [sortOrder, setSortOrder] = useState('asc');
  const requestId = useRef(0);

  const fetchResources = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true); setError('');
    const filters = { page, search, category, type, status, baseId, capability, sortBy, sortOrder };
    try {
      const [resourceResponse, baseResponse, dashboardResponse, dispatchResponse] = await Promise.all([
        resourcesAPI.getPage(buildResourceParams(filters)), resourcesAPI.getBases(),
        dashboardAPI.getSummary(), dispatchAPI.getAll({ active_only: true }),
      ]);
      if (id !== requestId.current) return;
      const dispatchByResource = {};
      dispatchResponse.data.forEach((dispatch) => dispatch.assignments.forEach((assignment) => {
        dispatchByResource[assignment.resource_id] = { dispatch_id: dispatch.id, dispatch_code: dispatch.dispatch_code, role: assignment.role };
      }));
      setResult({ ...resourceResponse.data, items: resourceResponse.data.items.map((item) => ({ ...item, active_dispatch: dispatchByResource[item.id] })) });
      setBases(baseResponse.data); setSummary(dashboardResponse.data);
    } catch (err) {
      if (id === requestId.current) setError(err.response?.data?.detail || err.message || 'Failed to load resources');
    } finally { if (id === requestId.current) setLoading(false); }
  }, [page, search, category, type, status, baseId, capability, sortBy, sortOrder]);

  useEffect(() => { fetchResources(); }, [fetchResources]);
  useEffect(() => { setPage(1); }, [search, category, type, status, baseId, capability, sortBy, sortOrder]);

  const categoryCards = useMemo(() => Object.entries(summary.readiness_by_category || {}), [summary]);
  const clearFilters = () => { setSearch(''); setCategory(''); setType(''); setStatus(''); setBaseId(''); setCapability(''); setSortBy('code'); setSortOrder('asc'); };
  const icon = (item) => item.category === 'Ambulance' ? <Siren className="w-5 h-5 text-red-400" />
    : item.category === 'Police' ? <Shield className="w-5 h-5 text-blue-400" />
      : item.category === 'Fire/Rescue' ? <Truck className="w-5 h-5 text-orange-400" /> : <Settings className="w-5 h-5 text-slate-400" />;
  const changeStatus = async (nextStatus) => {
    if (!selectedResource || nextStatus === selectedResource.status) return;
    if (!window.confirm(`Change ${selectedResource.resource_code} to ${nextStatus}?`)) return;
    try {
      const response = await resourcesAPI.updateStatus(selectedResource.id, nextStatus);
      setSelectedResource(response.data); fetchResources();
    } catch (err) { setError(err.response?.data?.detail || 'Status update failed'); }
  };

  return (
    <PageContainer title="Emergency Resources">
      <div className="mb-5 rounded-xl border border-purple-500/20 bg-purple-500/5 p-4 text-xs text-purple-200">{DISCLAIMER}</div>
      <div className="grid grid-cols-2 gap-3 mb-5 md:grid-cols-4">
        {categoryCards.map(([name, values]) => <div key={name} className="rounded-xl border border-navy-700 bg-navy-800 p-4"><p className="text-xs text-slate-400">{name}</p><p className="mt-1 text-2xl font-bold text-white">{values.available}/{values.total}</p><p className="text-[11px] text-emerald-300">{values.readiness_percent.toFixed(1)}% ready</p></div>)}
      </div>
      <div className="rounded-xl border border-navy-700 bg-navy-800 overflow-hidden">
        <div className="p-4 border-b border-navy-700 grid grid-cols-1 gap-3 lg:grid-cols-4 xl:grid-cols-8">
          <label className="relative lg:col-span-2"><Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search callsign, type or base" className="w-full rounded-lg border border-navy-700 bg-navy-900 py-2 pl-9 pr-3 text-sm text-white" /></label>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-lg border border-navy-700 bg-navy-900 px-3 py-2 text-sm text-white"><option value="">All categories</option>{['Police','Ambulance','Fire/Rescue','Municipal/Utility'].map((v) => <option key={v}>{v}</option>)}</select>
          <input value={type} onChange={(e) => setType(e.target.value)} placeholder="Unit type" className="rounded-lg border border-navy-700 bg-navy-900 px-3 py-2 text-sm text-white" />
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-lg border border-navy-700 bg-navy-900 px-3 py-2 text-sm text-white"><option value="">All statuses</option>{['Available','Assigned','Dispatched','En Route','On Scene','Transporting','Maintenance','Reserve','Unavailable'].map((v) => <option key={v}>{v}</option>)}</select>
          <select value={baseId} onChange={(e) => setBaseId(e.target.value)} className="rounded-lg border border-navy-700 bg-navy-900 px-3 py-2 text-sm text-white"><option value="">All bases</option>{bases.map((base) => <option key={base.id} value={base.id}>{base.name}</option>)}</select>
          <input value={capability} onChange={(e) => setCapability(e.target.value)} placeholder="Capability" className="rounded-lg border border-navy-700 bg-navy-900 px-3 py-2 text-sm text-white" />
          <div className="flex gap-2"><select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="min-w-0 flex-1 rounded-lg border border-navy-700 bg-navy-900 px-2 py-2 text-sm text-white"><option value="code">Callsign</option><option value="status">Status</option><option value="type">Type</option><option value="last_updated">Updated</option></select><button onClick={() => setSortOrder((value) => value === 'asc' ? 'desc' : 'asc')} className="rounded-lg border border-navy-700 px-3 text-slate-300">{sortOrder === 'asc' ? '↑' : '↓'}</button></div>
          <button onClick={clearFilters} className="text-xs text-slate-400 hover:text-white"><X className="inline w-3 h-3" /> Clear</button>
        </div>
        {loading ? <div className="p-16"><LoadingState message="Loading paginated resources…" /></div>
          : error ? <div className="p-8"><ErrorState message={String(error)} onRetry={fetchResources} /></div>
            : !result.items.length ? <div className="p-16"><EmptyState message="No resources match these filters" /></div>
              : <div className="divide-y divide-navy-700/50">{result.items.map((item) => <button type="button" key={item.id} onClick={() => setSelectedResource(item)} className="w-full p-4 text-left hover:bg-navy-700/30 flex items-center justify-between gap-4"><div className="flex min-w-0 items-center gap-3"><div className="rounded-lg border border-navy-700 bg-navy-900 p-2">{icon(item)}</div><div className="min-w-0"><div className="flex flex-wrap gap-2"><span className="font-semibold text-white">{item.resource_code}</span><span className="text-xs text-slate-400">{item.unit_type}</span></div><p className="truncate text-xs text-slate-500">{item.base_name || 'Unassigned base'} · crew {item.crew_capacity} · {item.capabilities.join(', ')}</p></div></div><StatusBadge status={item.status} /></button>)}</div>}
        <div className="flex items-center justify-between border-t border-navy-700 p-4 text-sm text-slate-400"><span>{result.total} units · page {page} of {Math.max(result.total_pages, 1)}</span><div className="flex gap-2"><button disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="rounded border border-navy-700 p-2 disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button><button disabled={page >= result.total_pages} onClick={() => setPage((value) => value + 1)} className="rounded border border-navy-700 p-2 disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button></div></div>
      </div>
      <Modal isOpen={!!selectedResource} onClose={() => setSelectedResource(null)} title="Resource Details">{selectedResource && <div className="space-y-4 text-sm"><div className="flex justify-between"><div><h3 className="text-xl font-bold text-white">{selectedResource.resource_code}</h3><p className="text-slate-400">{selectedResource.unit_type} · {selectedResource.category}</p></div><StatusBadge status={selectedResource.status} /></div><dl className="grid grid-cols-2 gap-3">{[['Base',selectedResource.base_name],['Crew',selectedResource.crew_capacity],['Radius',`${selectedResource.response_radius_km} km`],['Capacity',selectedResource.capacity],['Updated',formatDate(selectedResource.last_updated)],['Dispatch',selectedResource.active_dispatch?.dispatch_code || 'None']].map(([label,value]) => <div key={label} className="rounded-lg bg-navy-900 p-3"><dt className="text-xs text-slate-500">{label}</dt><dd className="text-slate-200">{value || 'N/A'}</dd></div>)}</dl><div><p className="text-xs text-slate-500 mb-2">Capabilities</p><div className="flex flex-wrap gap-2">{selectedResource.capabilities.map((value) => <span key={value} className="rounded bg-blue-500/10 px-2 py-1 text-xs text-blue-300">{value}</span>)}</div></div><label className="block text-xs text-slate-400">Update simulated status<select value={selectedResource.status} onChange={(e) => changeStatus(e.target.value)} className="mt-2 w-full rounded-lg border border-navy-700 bg-navy-900 p-2 text-white">{['Available','Assigned','Dispatched','En Route','On Scene','Transporting','Maintenance','Reserve','Unavailable'].map((value) => <option key={value}>{value}</option>)}</select></label></div>}</Modal>
    </PageContainer>
  );
};

export default Resources;