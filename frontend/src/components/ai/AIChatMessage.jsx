import { Bot, ShieldAlert, User } from 'lucide-react';
import GroundedBadge from './GroundedBadge';
import AgentTrace from './AgentTrace';
import AIResponseRenderer from './AIResponseRenderer';
import SecurityDecisionMeta from './SecurityDecisionMeta';

const AIChatMessage = ({ message }) => {
  const isUser = message.role === 'user';
  const time = new Date(message.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  if (isUser) return (
    <div className="flex justify-end"><div className="max-w-[75%] space-y-1">
      <div className="rounded-xl rounded-tr-sm border border-cyan-300/25 bg-blue-500/15 px-4 py-3 shadow-lg shadow-black/10"><p className="text-sm text-slate-100 whitespace-pre-wrap leading-relaxed">{message.content}</p></div>
      <div className="flex justify-end items-center gap-2 px-1"><span className="text-[10px] text-slate-500">{time}</span><User className="w-3 h-3 text-slate-500" /></div>
    </div></div>
  );

  if (message.role === 'blocked') return (
    <div className="flex justify-start"><div className="max-w-[85%] rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 space-y-2 shadow-lg shadow-black/10" role="alert">
      <div className="flex items-center gap-2 text-amber-300"><ShieldAlert className="w-4 h-4" /><span className="text-sm font-semibold">Request Blocked</span></div>
      <p className="text-sm text-slate-200">{message.content}</p>
      <div className="flex flex-wrap gap-2 text-[11px] text-slate-400"><span>Threat: <b className="text-amber-200">{message.threat_level}</b></span><span>Event: <span className="font-mono text-slate-300">{message.event_id}</span></span></div>
      {message.categories?.length > 0 && <p className="text-[11px] text-slate-400">Detected categories: {message.categories.join(', ')}</p>}
      <p className="text-[10px] text-slate-500">Rejected by the deterministic gateway before ADK execution.</p>
    </div></div>
  );

  return (
    <div className="flex justify-start"><div className="max-w-[85%] space-y-1.5">
      <div className="rounded-xl rounded-tl-sm border border-blue-300/10 bg-navy-900/65 px-4 py-3 shadow-lg shadow-black/10 backdrop-blur space-y-3"><AIResponseRenderer text={message.content} /><SecurityDecisionMeta message={message} /></div>
      <div className="flex flex-wrap items-center gap-2 px-1"><Bot className="w-3 h-3 text-slate-500" /><span className="text-[10px] text-slate-500">{time}</span>{message.grounded !== undefined && <GroundedBadge grounded={message.grounded} source={message.source} />}</div>
      {message.agents_used?.length > 0 && <div className="px-1"><AgentTrace agents={message.agents_used} /></div>}
    </div></div>
  );
};
export default AIChatMessage;