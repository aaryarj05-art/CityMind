import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const FactorContributionChart = ({ factors = [] }) => {
  // Format factor labels for display
  const chartData = factors.map(f => ({
    name: f.factor.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase()),
    Score: Math.round(f.score * 10) / 10,
    Contribution: Math.round(f.contribution * 10) / 10,
    Weight: f.weight
  }));

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-navy-950 border border-navy-700 p-3 rounded-lg shadow-lg">
          <p className="text-white font-semibold text-sm mb-1">{data.name}</p>
          <p className="text-blue-400 text-xs">Raw Score: {data.Score}/100</p>
          <p className="text-slate-400 text-xs">Weight: {data.Weight}</p>
          <p className="text-red-400 text-xs font-medium">Contribution: {data.Contribution} pts</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
          <XAxis type="number" stroke="#94a3b8" fontSize={11} domain={[0, 100]} />
          <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={11} width={110} tickLine={false} />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: '11px' }} />
          <Bar dataKey="Score" fill="#3b82f6" name="Raw Score" radius={[0, 4, 4, 0]} barSize={8} />
          <Bar dataKey="Contribution" fill="#ef4444" name="Weighted Contribution" radius={[0, 4, 4, 0]} barSize={8} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default FactorContributionChart;
