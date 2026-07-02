const StatCard = ({ title, value, icon: Icon, trend, trendValue, color = "blue" }) => {
  const colorMap = {
    blue: "text-blue-400 bg-blue-500/10",
    red: "text-red-400 bg-red-500/10",
    green: "text-emerald-400 bg-emerald-500/10",
    orange: "text-orange-400 bg-orange-500/10",
    purple: "text-purple-400 bg-purple-500/10"
  };

  return (
    <div className="bg-navy-800 rounded-xl p-5 border border-navy-700 hover:border-navy-600 transition-colors">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-slate-400 text-sm font-medium">{title}</p>
          <h3 className="text-3xl font-bold text-white mt-2">{value}</h3>
        </div>
        <div className={`p-3 rounded-lg ${colorMap[color] || colorMap.blue}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
      {trend && (
        <div className="mt-4 flex items-center text-sm">
          <span className={`font-medium ${trend === 'up' ? 'text-red-400' : 'text-emerald-400'}`}>
            {trendValue}
          </span>
          <span className="text-slate-500 ml-2">vs last hour</span>
        </div>
      )}
    </div>
  );
};

export default StatCard;
