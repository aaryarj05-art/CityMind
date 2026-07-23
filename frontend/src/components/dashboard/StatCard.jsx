const StatCard = ({ title, value, icon: Icon, trend, trendValue, color = "blue" }) => {
  const colorMap = {
    blue: "text-cyan-300 bg-cyan-400/10 border-cyan-300/15",
    red: "text-red-300 bg-red-500/10 border-red-400/15",
    green: "text-emerald-300 bg-emerald-500/10 border-emerald-400/15",
    orange: "text-orange-300 bg-orange-500/10 border-orange-400/15",
    purple: "text-blue-300 bg-blue-500/10 border-blue-400/15",
  };

  return (
    <div className="glass-card glass-card-hover p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-400">{title}</p>
          <h3 className="mt-2 truncate text-3xl font-semibold text-white">{value}</h3>
        </div>
        <div className={`rounded-xl border p-3 ${colorMap[color] || colorMap.blue}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      {trend && (
        <div className="mt-4 flex items-center text-sm">
          <span className={`font-medium ${trend === 'up' ? 'text-red-300' : 'text-emerald-300'}`}>
            {trendValue}
          </span>
          <span className="ml-2 text-slate-500">vs last hour</span>
        </div>
      )}
    </div>
  );
};

export default StatCard;