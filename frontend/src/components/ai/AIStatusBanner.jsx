import { ShieldAlert } from 'lucide-react';

const AIStatusBanner = () => (
  <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/5 border border-amber-500/15 rounded-lg">
    <ShieldAlert className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
    <p className="text-[11px] text-amber-400/80 leading-relaxed">
      CityMind provides simulated decision support. It does not control real emergency systems or confirm real-world dispatch actions.
    </p>
  </div>
);

export default AIStatusBanner;
