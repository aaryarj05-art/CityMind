import { ChevronRight } from 'lucide-react';

const AGENT_LABELS = {
  city_operations_coordinator: 'City Operations Coordinator',
  risk_intelligence_agent: 'Risk Intelligence Agent',
  response_planning_agent: 'Response Planning Agent',
  public_communication_agent: 'Public Communication Agent',
};

const AgentTrace = ({ agents }) => {
  if (!agents || agents.length === 0) return null;

  return (
    <div className="flex items-center gap-1 flex-wrap text-[11px]">
      <span className="text-slate-500 font-medium mr-0.5">Agents:</span>
      {agents.map((agent, i) => (
        <span key={agent} className="flex items-center gap-1">
          <span className="px-1.5 py-0.5 rounded bg-navy-700 border border-navy-600 text-slate-300 font-medium">
            {AGENT_LABELS[agent] || agent}
          </span>
          {i < agents.length - 1 && (
            <ChevronRight className="w-3 h-3 text-slate-600" />
          )}
        </span>
      ))}
    </div>
  );
};

export default AgentTrace;
