import { BadgeCheck, ShieldCheck } from 'lucide-react';

const SecurityDecisionMeta = ({ message }) => {
  const hash = message.audit?.integrity_hash;
  return (
    <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-[11px] text-slate-300 space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-emerald-300 font-medium">
        <ShieldCheck className="w-3.5 h-3.5" />
        <span>{message.security?.authorized ? 'Authorized' : 'Authorization unknown'}</span>
        <span className="text-slate-500">Threat: {message.security?.threat_level || 'unknown'}</span>
        <span className="text-slate-500">Assurance: {message.assurance_level || 'unknown'}</span>
      </div>
      <div className="grid sm:grid-cols-2 gap-1 text-slate-400">
        <span>Decision: <span className="text-slate-200">{message.decision_id || 'Not recorded'}</span></span>
        <span>Grounded: <span className="text-slate-200">{message.grounded ? 'Yes' : 'No'}</span></span>
        <span>Audit: <span className="font-mono text-slate-200">{hash ? `${hash.slice(0, 12)}…` : 'Not recorded'}</span></span>
        <span>Timestamp: <span className="text-slate-200">{message.audit?.timestamp ? new Date(message.audit.timestamp).toLocaleString('en-IN') : 'Not recorded'}</span></span>
      </div>
      {message.tools_used?.length > 0 && <p>Tools observed: {message.tools_used.join(', ')}</p>}
      {message.limitations?.length > 0 && (
        <div><span className="text-amber-300">Limitations:</span><ul className="list-disc ml-4 mt-1">{message.limitations.map(item => <li key={item}>{item}</li>)}</ul></div>
      )}
      <div className="flex items-center gap-1 text-slate-500"><BadgeCheck className="w-3 h-3" /> Deterministic policy and audit metadata</div>
    </div>
  );
};
export default SecurityDecisionMeta;