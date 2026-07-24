import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock3, ExternalLink, FileText, Loader2, ShieldCheck, X } from 'lucide-react';
import { incidentsAPI } from '../../services/api';
import { formatDate } from '../../utils/formatters';

const statusTone = (status) => {
  if (status === 'VERIFIED') return 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300';
  if (status === 'UNVERIFIED') return 'border-red-400/25 bg-red-400/10 text-red-300';
  return 'border-amber-400/25 bg-amber-400/10 text-amber-300';
};

const SourceLink = ({ source, compact = false }) => (
  <a
    href={source.url}
    target="_blank"
    rel="noopener noreferrer"
    className={`inline-flex items-center gap-1 text-cyan-300 hover:text-cyan-200 ${compact ? 'text-xs' : 'text-sm'}`}
  >
    Open Original Article <ExternalLink className="h-3.5 w-3.5" />
  </a>
);

const IncidentEvidenceDrawer = ({ isOpen, onClose, incidentId }) => {
  const [evidence, setEvidence] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen || !incidentId) return;
    let active = true;
    setLoading(true);
    setError(null);
    setEvidence(null);
    incidentsAPI.getEvidence(incidentId)
      .then(({ data }) => { if (active) setEvidence(data); })
      .catch((err) => { if (active) setError(err.response?.data?.detail || err.message || 'Failed to load incident evidence'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [isOpen, incidentId]);

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape') onClose();
    };
    if (isOpen) document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm" onClick={onClose}>
      <aside
        className="ml-auto flex h-full w-full max-w-xl flex-col border-l border-navy-700 bg-navy-900 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
        aria-label="Incident evidence verification panel"
      >
        <div className="flex items-start justify-between border-b border-navy-700 p-5">
          <div>
            <p className="cm-section-label">Incident Evidence</p>
            <h2 className="mt-1 text-lg font-semibold text-white">Source Verification</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-navy-800 hover:text-white" aria-label="Close evidence panel">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {loading && <div className="flex items-center gap-2 text-sm text-slate-300"><Loader2 className="h-4 w-4 animate-spin text-cyan-300" /> Verifying live external sources...</div>}
          {error && <div className="rounded-lg border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-300">{error}</div>}

          {evidence && (
            <div className="space-y-5">
              <div className="rounded-lg border border-cyan-300/20 bg-cyan-400/10 p-4 text-sm text-cyan-100">
                {evidence.banner}
              </div>

              <section className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-white">{evidence.incident_title}</h3>
                    <p className="mt-1 text-sm text-slate-400">{evidence.location}</p>
                    <p className="mt-1 text-xs text-slate-500">Incident time: {formatDate(evidence.incident_time)}</p>
                  </div>
                  <span className={`shrink-0 rounded-full border px-3 py-1 text-xs font-bold ${statusTone(evidence.verification_status)}`}>
                    {evidence.verification_status === 'VERIFIED' ? '✓ VERIFIED' : evidence.verification_status}
                  </span>
                </div>
              </section>

              <section className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-navy-700 bg-navy-950/45 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Confidence</p>
                  <p className="mt-1 text-2xl font-bold text-white">{evidence.confidence_score}%</p>
                </div>
                <div className="rounded-lg border border-navy-700 bg-navy-950/45 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Last Updated</p>
                  <p className="mt-1 text-sm font-semibold text-slate-200">{formatDate(evidence.last_updated)}</p>
                </div>
              </section>

              <section className="space-y-3">
                <h4 className="flex items-center gap-2 text-sm font-semibold text-white"><FileText className="h-4 w-4 text-cyan-300" /> Primary Source</h4>
                {evidence.primary_source ? (
                  <div className="rounded-lg border border-navy-700 bg-navy-950/45 p-4">
                    <p className="font-semibold text-white">{evidence.primary_source.publisher_name}</p>
                    <p className="mt-1 text-sm text-slate-300">{evidence.primary_source.title}</p>
                    <p className="mt-1 text-xs text-slate-500">Publication time: {evidence.primary_source.publication_time ? formatDate(evidence.primary_source.publication_time) : 'Unavailable'}</p>
                    <div className="mt-3"><SourceLink source={evidence.primary_source} /></div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-200">
                    No primary source could be selected because no live external source matched this incident.
                  </div>
                )}
              </section>

              <section className="space-y-3">
                <h4 className="flex items-center gap-2 text-sm font-semibold text-white"><ShieldCheck className="h-4 w-4 text-emerald-300" /> Verified By</h4>
                {evidence.verified_by.length ? (
                  <div className="space-y-2">
                    {evidence.verified_by.map((source) => (
                      <div key={source.url} className="rounded-lg border border-navy-700 bg-navy-950/35 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-100">✓ {source.publisher_name}</p>
                            <p className="mt-0.5 text-xs text-slate-400">{source.title}</p>
                          </div>
                          {source.is_official && <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-bold text-emerald-300">Official</span>}
                        </div>
                        <div className="mt-2"><SourceLink source={source} compact /></div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-lg border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-200">No independent publisher confirmation was verified. CityMind will not fabricate confirmations.</p>
                )}
              </section>

              <section className="space-y-3">
                <h4 className="flex items-center gap-2 text-sm font-semibold text-white"><CheckCircle2 className="h-4 w-4 text-cyan-300" /> Why CityMind Trusts This Incident</h4>
                <ul className="space-y-2">
                  {evidence.trust_reasons.map((reason) => (
                    <li key={reason} className="flex gap-2 text-sm text-slate-300"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />{reason}</li>
                  ))}
                </ul>
              </section>

              <section className="space-y-3">
                <h4 className="flex items-center gap-2 text-sm font-semibold text-white"><Clock3 className="h-4 w-4 text-blue-300" /> Evidence Timeline</h4>
                {evidence.evidence_timeline.length ? (
                  <div className="space-y-3">
                    {evidence.evidence_timeline.map((item) => (
                      <div key={`${item.timestamp}-${item.label}`} className="border-l border-navy-600 pl-3">
                        <p className="text-xs font-semibold text-slate-400">{formatDate(item.timestamp)}</p>
                        <p className="mt-0.5 text-sm text-slate-200">{item.label}</p>
                        {item.url && <a href={item.url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-cyan-300 hover:text-cyan-200">Open Original Article <ExternalLink className="h-3 w-3" /></a>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-lg border border-navy-700 bg-navy-950/45 p-4 text-sm text-slate-400">No evidence timeline is available because no live source matched this incident.</p>
                )}
              </section>

              {evidence.provider_errors.length > 0 && (
                <div className="flex gap-2 rounded-lg border border-amber-400/20 bg-amber-400/10 p-3 text-xs text-amber-200">
                  <AlertTriangle className="h-4 w-4 shrink-0" /> Some providers were unavailable; CityMind used only sources that could be verified.
                </div>
              )}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
};

export default IncidentEvidenceDrawer;