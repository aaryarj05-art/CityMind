import { AlertTriangle, Activity, Send, Compass, FileText, ShieldAlert, Briefcase, Megaphone } from 'lucide-react';

const QUICK_PROMPTS = [
  {
    label: 'City Risk Situation',
    prompt: 'What is the current city-wide risk situation?',
    icon: AlertTriangle,
    category: 'risk',
  },
  {
    label: 'Highest Attention Area',
    prompt: 'Which area needs the most attention, and why?',
    icon: Compass,
    category: 'risk',
  },
  {
    label: 'Dispatch Situation',
    prompt: 'What is the current dispatch situation?',
    icon: Send,
    category: 'dispatch',
  },
  {
    label: 'Priority Incidents',
    prompt: 'Which incidents are highest priority?',
    icon: Activity,
    category: 'incident',
  },
  {
    label: 'Response Plan',
    prompt: 'Explain the response plan for incident {id}.',
    icon: FileText,
    category: 'incident',
    needsIncidentId: true,
  },
  {
    label: 'Resource Shortages',
    prompt: 'Summarize current resource shortages.',
    icon: ShieldAlert,
    category: 'resource',
  },
  {
    label: 'Executive Briefing',
    prompt: 'Create an executive city briefing.',
    icon: Briefcase,
    category: 'general',
  },
  {
    label: 'Public Alert',
    prompt: 'Generate a safe public alert using verified facts.',
    icon: Megaphone,
    category: 'communication',
  },
];

const AIQuickPrompts = ({ onSelect, disabled, incidents }) => {
  const handleClick = (item) => {
    if (disabled) return;

    if (item.needsIncidentId) {
      // If we have incidents, use the first one; otherwise insert editable template
      if (incidents && incidents.length > 0) {
        const firstId = incidents[0].id;
        onSelect(item.prompt.replace('{id}', String(firstId)));
      } else {
        onSelect(item.prompt.replace('{id}', '1'));
      }
    } else {
      onSelect(item.prompt);
    }
  };

  return (
    <div className="space-y-2">
      <p className="cm-section-label">Quick Prompts</p>
      <div className="grid grid-cols-2 gap-1.5">
        {QUICK_PROMPTS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              onClick={() => handleClick(item)}
              disabled={disabled}
              className="glass-card glass-card-hover flex items-center gap-2 px-3 py-2 text-left text-xs text-slate-300 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label={item.label}
            >
              <Icon className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default AIQuickPrompts;
