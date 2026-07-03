import { User, Bot } from 'lucide-react';
import GroundedBadge from './GroundedBadge';
import AgentTrace from './AgentTrace';
import AIResponseRenderer from './AIResponseRenderer';

const AIChatMessage = ({ message }) => {
  const isUser = message.role === 'user';
  const time = new Date(message.timestamp).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  });

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[75%] space-y-1">
          <div className="bg-blue-600/20 border border-blue-500/25 rounded-xl rounded-tr-sm px-4 py-3">
            <p className="text-sm text-slate-100 whitespace-pre-wrap leading-relaxed">{message.content}</p>
          </div>
          <div className="flex justify-end items-center gap-2 px-1">
            <span className="text-[10px] text-slate-500">{time}</span>
            <User className="w-3 h-3 text-slate-500" />
          </div>
        </div>
      </div>
    );
  }

  // Assistant message
  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] space-y-1.5">
        <div className="bg-navy-800 border border-navy-600 rounded-xl rounded-tl-sm px-4 py-3 space-y-3">
          <AIResponseRenderer text={message.content} />
        </div>
        <div className="flex flex-wrap items-center gap-2 px-1">
          <Bot className="w-3 h-3 text-slate-500" />
          <span className="text-[10px] text-slate-500">{time}</span>
          {message.grounded !== undefined && (
            <GroundedBadge grounded={message.grounded} />
          )}
        </div>
        {message.agents_used && message.agents_used.length > 0 && (
          <div className="px-1">
            <AgentTrace agents={message.agents_used} />
          </div>
        )}
      </div>
    </div>
  );
};

export default AIChatMessage;
