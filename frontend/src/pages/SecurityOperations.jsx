import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, RefreshCw, ShieldCheck, XCircle } from 'lucide-react';
import PageContainer from '../components/layout/PageContainer';
import { securityAPI } from '../services/api';

const Metric = ({ label, value, tone = 'text-white' }) => <div className="rounded-xl border border-navy-700 bg-navy-800 p-4"><p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p><p className={`mt-2 text-2xl font-semibold ${tone}`}>{value ?? 'Unavailable'}</p></div>;
const when = value => value ? new Date(value).toLocaleString('en-IN') : 'Not recorded';

const SecurityOperations = () => {
  const [summary, setSummary] = useState(null);
  const [events, setEvents] = useState([]);
  const [total, setTotal] = useState(0);
  const [health, setHealth] = useState([]);
  const [grounding, setGrounding] = useState(null);
  const [selected, setSelected] = useState(null);
  const [filters, setFilters] = useState({ event_type: '', threat_level: '', blocked: '', date_from: '', date_to: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const params = Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== ''));
      if (params.date_from) params.date_from = new Date(`${params.date_from}T00:00:00`).toISOString();
      if (params.date_to) params.date_to = new Date(`${params.date_to}T23:59:59`).toISOString();
      if (params.blocked) params.blocked = params.blocked === 'true';
      const [summaryRes, eventsRes, healthRes, groundingRes] = await Promise.all([
        securityAPI.getSummary(), securityAPI.getEvents(params), securityAPI.getAgentHealth(), securityAPI.getGroundingMetrics(),
      ]);
      setSummary(summaryRes.data); setEvents(eventsRes.data.events || []); setTotal(eventsRes.data.total || 0);
      setHealth(healthRes.data.agents || []); setGrounding(groundingRes.data);
    } catch (err) { setError(err.response?.data?.detail || 'Security telemetry is unavailable.'); }
    finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { load(); }, [load]);
  const threatTotal = useMemo(() => Object.values(summary?.threat_levels || {}).reduce((a, b) => a + b, 0), [summary]);
  const policyViolations = events.filter(event => event.categories?.includes('role_policy'));

  return <PageContainer title="Security Operations">
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold text-white">AI Security & Trust</h2><p className="text-xs text-slate-400">Real append-only, tamper-evident prototype audit telemetry.</p></div><button onClick={load} disabled={loading} className="flex items-center gap-2 rounded-lg border border-navy-600 px-3 py-2 text-xs text-slate-300 hover:bg-navy-700 disabled:opacity-50"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />Refresh</button></div>
      {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{String(error)}</div>}
      <div className={`rounded-xl border p-4 flex items-center gap-3 ${summary?.audit_integrity?.valid ? 'border-emerald-500/25 bg-emerald-500/5' : 'border-red-500/30 bg-red-500/10'}`}>
        {summary?.audit_integrity?.valid ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <XCircle className="w-5 h-5 text-red-400" />}
        <div><p className="text-sm font-medium text-white">Audit chain {summary?.audit_integrity?.valid ? 'verified' : 'verification failed'}</p><p className="text-xs text-slate-400">{summary?.audit_integrity?.records_checked ?? 0} records checked{summary?.audit_integrity?.broken_record_id ? ` · break at ${summary.audit_integrity.broken_record_id}` : ''}</p></div>
      </div>
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3"><Metric label="Blocked prompts today" value={summary?.blocked_prompts_today} tone="text-amber-300" /><Metric label="Unauthorized requests" value={summary?.unauthorized_requests_today} tone="text-red-300" /><Metric label="Failed logins" value={summary?.failed_logins_today} /><Metric label="Permission denials" value={summary?.permission_denials_today} /><Metric label="AI requests today" value={summary?.ai_requests_today} /><Metric label="Grounding" value={summary?.grounding_percentage == null ? 'Unavailable' : `${summary.grounding_percentage}%`} tone="text-blue-300" /><Metric label="Fallback / low assurance" value={summary?.fallback_count} /><Metric label="Active sessions" value={summary?.active_sessions} /></div>
      <div className="grid xl:grid-cols-2 gap-4">
        <section className="rounded-xl border border-navy-700 bg-navy-800 p-4"><h3 className="text-sm font-semibold text-white mb-4">Threat-level distribution</h3><div className="space-y-3">{['safe','warning','critical'].map(level => { const count=summary?.threat_levels?.[level] || 0; const pct=threatTotal ? count/threatTotal*100 : 0; return <div key={level}><div className="flex justify-between text-xs text-slate-400 capitalize"><span>{level}</span><span>{count}</span></div><div className="mt-1 h-2 rounded bg-navy-900 overflow-hidden"><div className={`${level==='safe'?'bg-emerald-500':level==='warning'?'bg-amber-500':'bg-red-500'} h-full`} style={{width:`${pct}%`}} /></div></div>; })}</div></section>
        <section className="rounded-xl border border-navy-700 bg-navy-800 p-4"><h3 className="text-sm font-semibold text-white mb-3">Observed agent health</h3>{health.length ? <div className="space-y-2">{health.map(agent => <div key={agent.agent} className="flex justify-between gap-3 rounded-lg bg-navy-900 p-2 text-xs"><span className="text-slate-200 truncate">{agent.agent}</span><span className="text-slate-500">{agent.observed_requests} observed · {when(agent.last_seen)}</span></div>)}</div> : <p className="text-xs text-slate-500">No agent activity has been recorded.</p>}<p className="mt-3 text-[11px] text-slate-500">Grounded responses: {grounding?.grounded_responses ?? 0} of {grounding?.responses_measured ?? 0}</p></section>
      </div>
      <section className="rounded-xl border border-navy-700 bg-navy-800 p-4 space-y-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="text-sm font-semibold text-white">Security events</h3><p className="text-[11px] text-slate-500">{total} matching records · {policyViolations.length} visible policy violations</p></div><ShieldCheck className="w-5 h-5 text-blue-400" /></div>
        <div className="grid sm:grid-cols-2 xl:grid-cols-5 gap-2"><input value={filters.event_type} onChange={e=>setFilters({...filters,event_type:e.target.value})} placeholder="Event type" className="rounded-lg border border-navy-600 bg-navy-900 px-3 py-2 text-xs text-slate-200" /><select value={filters.threat_level} onChange={e=>setFilters({...filters,threat_level:e.target.value})} className="rounded-lg border border-navy-600 bg-navy-900 px-3 py-2 text-xs text-slate-200"><option value="">All threats</option><option value="safe">Safe</option><option value="warning">Warning</option><option value="critical">Critical</option></select><select value={filters.blocked} onChange={e=>setFilters({...filters,blocked:e.target.value})} className="rounded-lg border border-navy-600 bg-navy-900 px-3 py-2 text-xs text-slate-200"><option value="">Blocked & allowed</option><option value="true">Blocked</option><option value="false">Allowed</option></select><input type="date" value={filters.date_from} onChange={e=>setFilters({...filters,date_from:e.target.value})} className="rounded-lg border border-navy-600 bg-navy-900 px-3 py-2 text-xs text-slate-300" /><input type="date" value={filters.date_to} onChange={e=>setFilters({...filters,date_to:e.target.value})} className="rounded-lg border border-navy-600 bg-navy-900 px-3 py-2 text-xs text-slate-300" /></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-xs"><thead className="text-slate-500 border-b border-navy-700"><tr><th className="py-2">Time</th><th>Event</th><th>Threat</th><th>Decision</th><th>Actor</th><th>Action</th></tr></thead><tbody>{events.map(event=><tr key={event.event_id} onClick={()=>setSelected(event)} className="border-b border-navy-700/60 text-slate-300 hover:bg-navy-700/40 cursor-pointer"><td className="py-3">{when(event.created_at)}</td><td>{event.event_type}</td><td className="capitalize">{event.threat_level}</td><td className="font-mono">{event.decision_id || '—'}</td><td>{event.role || 'System'}</td><td>{event.blocked ? 'Blocked' : event.action}</td></tr>)}</tbody></table>{!events.length && !loading && <p className="py-8 text-center text-xs text-slate-500">No matching security events.</p>}</div>
      </section>
    </div>
    {selected && <div className="fixed inset-0 z-50 bg-black/60 flex justify-end" onClick={()=>setSelected(null)}><aside className="h-full w-full max-w-lg overflow-y-auto border-l border-navy-700 bg-navy-800 p-6 space-y-4" onClick={e=>e.stopPropagation()}><div className="flex justify-between"><div><h3 className="font-semibold text-white">Event details</h3><p className="font-mono text-xs text-blue-300">{selected.event_id}</p></div><button onClick={()=>setSelected(null)} className="text-slate-400">Close</button></div><div className="grid grid-cols-2 gap-3 text-xs">{[['Type',selected.event_type],['Threat',selected.threat_level],['Risk score',selected.risk_score],['Blocked',selected.blocked?'Yes':'No'],['Decision',selected.decision_id||'—'],['Timestamp',when(selected.created_at)]].map(([k,v])=><div key={k} className="rounded-lg bg-navy-900 p-3"><p className="text-slate-500">{k}</p><p className="mt-1 text-slate-200 break-words">{v}</p></div>)}</div><div><p className="text-xs text-slate-500">Redacted prompt excerpt</p><p className="mt-1 rounded-lg bg-navy-900 p-3 text-sm text-slate-300 break-words">{selected.prompt_excerpt || 'Not retained'}</p></div><div className="space-y-2 font-mono text-[11px] text-slate-400 break-all"><p>Prompt SHA-256: {selected.prompt_hash || 'Not applicable'}</p><p>Previous hash: {selected.previous_hash}</p><p>Integrity hash: {selected.integrity_hash}</p></div>{selected.categories?.length>0&&<div className="flex flex-wrap gap-2">{selected.categories.map(c=><span key={c} className="rounded bg-amber-500/10 px-2 py-1 text-xs text-amber-300">{c}</span>)}</div>} {selected.limitations?.length>0&&<div><p className="text-xs text-slate-500">Limitations</p><ul className="list-disc ml-5 mt-1 text-xs text-slate-300">{selected.limitations.map(x=><li key={x}>{x}</li>)}</ul></div>}</aside></div>}
  </PageContainer>;
};
export default SecurityOperations;