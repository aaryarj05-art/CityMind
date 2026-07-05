const styles = {
  liveTraffic: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  googlePlaces: 'border-blue-500/30 bg-blue-500/10 text-blue-300',
  verifiedCapacity: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300',
  simulatedCapacity: 'border-violet-500/30 bg-violet-500/10 text-violet-300',
  unknownCapacity: 'border-slate-500/30 bg-slate-500/10 text-slate-300',
  fallback: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  stale: 'border-orange-500/30 bg-orange-500/10 text-orange-300',
  approval: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
};

const labels = {
  liveTraffic: 'Live Google Traffic',
  googlePlaces: 'Google Places Identity',
  verifiedCapacity: 'CityMind Verified Capacity',
  simulatedCapacity: 'CityMind Simulated Capacity',
  unknownCapacity: 'Unknown Capacity',
  fallback: 'CityMind Fallback Estimate',
  stale: 'Stale Data',
  approval: 'Human Approval Required',
};

const ProvenanceBadge = ({ type, label }) => (
  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${styles[type] || styles.unknownCapacity}`}>
    {label || labels[type] || type}
  </span>
);

export default ProvenanceBadge;
