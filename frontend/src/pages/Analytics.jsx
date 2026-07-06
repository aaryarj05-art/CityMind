import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, ScatterChart, Scatter, ZAxis, Label
} from 'recharts';
import PageContainer from '../components/layout/PageContainer';
import LoadingState from '../components/common/LoadingState';
import ErrorState from '../components/common/ErrorState';
import EmptyState from '../components/common/EmptyState';
import { dashboardAPI, riskAPI } from '../services/api';
import { Brain } from 'lucide-react';


const Analytics = () => {
  const [data, setData] = useState({ summary: null, areas: [], incidents: [], operations: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAnalyticsData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [sumRes, areasRes, incRes, operationsRes] = await Promise.all([
        riskAPI.getSummary(),
        riskAPI.getAreas(),
        riskAPI.getIncidents(),
        dashboardAPI.getSummary()
      ]);
      setData({
        summary: sumRes.data,
        areas: areasRes.data,
        incidents: incRes.data,
        operations: operationsRes.data
      });
    } catch (err) {
      setError(err.message || 'Failed to load dynamic risk analytics from backend');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalyticsData();
  }, []);

  // Compute stats metrics
  const stats = useMemo(() => {
    if (!data.summary || !data.areas.length) return null;

    // Most common incident category
    const categoryCounts = data.incidents.reduce((acc, inc) => {
      // In Phase 2 incidents priority data we don't have the category directly on the root of the incident,
      // but wait! The API response matches IncidentPriority which contains severity, status, title.
      // We can extract category from the title (e.g. "Road Accident at Kuvempunagar" -> "Road Accident")
      // or map standard category keywords found in title.
      const title = inc.title.toLowerCase();
      let category = 'General Incident';
      if (title.includes('road accident')) category = 'Road Accident';
      else if (title.includes('traffic congestion')) category = 'Traffic Congestion';
      else if (title.includes('waterlogging')) category = 'Waterlogging';
      else if (title.includes('fire')) category = 'Fire';
      else if (title.includes('medical emergency')) category = 'Medical Emergency';
      else if (title.includes('public disturbance')) category = 'Public Disturbance';

      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {});

    let topCat = 'N/A';
    let maxCount = 0;
    Object.entries(categoryCounts).forEach(([cat, count]) => {
      if (count > maxCount) {
        maxCount = count;
        topCat = cat;
      }
    });

    return {
      avgRiskScore: data.summary.average_city_risk_score,
      criticalZonesCount: data.summary.critical_area_count,
      highZonesCount: data.summary.high_risk_area_count,
      totalIncidents: data.incidents.length,
      topCategory: topCat,
      topDriver: data.summary.top_contributing_factor_city_wide
        ? data.summary.top_contributing_factor_city_wide.replace('_', ' ') : 'N/A'
    };
  }, [data]);

  // Compute charts data
  const chartsData = useMemo(() => {
    if (!data.areas.length) return null;

    // 1. Risk level distribution (Pie)
    const levelCounts = { Critical: 0, High: 0, Moderate: 0, Low: 0 };
    data.areas.forEach(a => {
      if (levelCounts[a.risk_level] !== undefined) levelCounts[a.risk_level]++;
    });
    const riskDistribution = Object.entries(levelCounts).map(([name, value]) => ({ name, value }));

    // 2. Top 10 highest-risk areas (Bar)
    const topAreas = [...data.areas]
      .sort((a, b) => b.risk_score - a.risk_score)
      .slice(0, 10)
      .map(a => ({ name: a.area_name, score: Math.round(a.risk_score * 10) / 10 }));

    // 3. Average factor contribution city-wide (Bar)
    const factorTotals = {};
    let areaCount = data.areas.length;
    data.areas.forEach(a => {
      Object.entries(a.weighted_contributions).forEach(([factor, contribution]) => {
        factorTotals[factor] = (factorTotals[factor] || 0) + contribution;
      });
    });
    const avgFactorContributions = Object.entries(factorTotals).map(([factor, total]) => ({
      name: factor.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase()),
      contribution: Math.round((total / areaCount) * 10) / 10
    })).sort((a, b) => b.contribution - a.contribution);

    // 4. Incident priority distribution (Bar)
    const priorityCounts = { Immediate: 0, Urgent: 0, Elevated: 0, Routine: 0 };
    data.incidents.forEach(inc => {
      if (priorityCounts[inc.priority_level] !== undefined) priorityCounts[inc.priority_level]++;
    });
    const priorityDistribution = Object.entries(priorityCounts).map(([name, count]) => ({ name, count }));

    // 5. Risk score versus incident count (Scatter)
    // Count incidents per area
    const incsPerArea = data.incidents.reduce((acc, inc) => {
      acc[inc.area_id] = (acc[inc.area_id] || 0) + 1;
      return acc;
    }, {});
    const riskVsIncident = data.areas.map(a => ({
      name: a.area_name,
      x: Math.round(a.risk_score * 10) / 10, // Risk Score (X-axis)
      y: incsPerArea[a.area_id] || 0,        // Incident Count (Y-axis)
      z: 5                                   // Marker size
    }));

    return { riskDistribution, topAreas, avgFactorContributions, priorityDistribution, riskVsIncident };
  }, [data]);

  if (loading) return <PageContainer title="Analytics"><LoadingState message="Fetching analytics calculation tables..." /></PageContainer>;
  if (error) return <PageContainer title="Analytics"><ErrorState message="Could not build deterministic risk charts" details={error} onRetry={fetchAnalyticsData} /></PageContainer>;
  if (!chartsData) return <PageContainer title="Analytics"><EmptyState message="No calculations found to render" /></PageContainer>;

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-navy-950 border border-navy-700 p-3 rounded-lg shadow-lg">
          <p className="text-white font-semibold text-sm mb-1">{payload[0].name || payload[0].payload.name}</p>
          <p className="text-blue-400 text-sm">{`${payload[0].value.toFixed ? payload[0].value.toFixed(1) : payload[0].value}`}</p>
        </div>
      );
    }
    return null;
  };

  // Color mapper for Risk Distribution levels
  const getLevelColor = (level) => {
    switch (level) {
      case 'Critical': return '#ef4444'; // Red
      case 'High': return '#f97316';     // Orange
      case 'Moderate': return '#eab308'; // Yellow
      case 'Low': return '#10b981';      // Emerald
      default: return '#3b82f6';
    }
  };

  return (
    <PageContainer title="City Analytics">
      {/* Dynamic Warning Header */}
      <div className="bg-navy-800 border border-navy-700 rounded-xl p-4 mb-6 flex items-center gap-3">
        <Brain className="w-5 h-5 text-blue-400" />
        <p className="text-sm text-slate-300 font-medium">
          Deterministic risk intelligence based on seeded Mysuru operational data.
        </p>
      </div>

      {/* Stats Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-navy-800 border border-navy-700 p-5 rounded-xl">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">Avg City Risk</p>
          <h3 className="text-3xl font-extrabold text-white">{stats.avgRiskScore.toFixed(1)}<span className="text-sm font-normal text-slate-500">/100</span></h3>
        </div>
        <div className="bg-navy-800 border border-navy-700 p-5 rounded-xl">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">Critical & High-Risk Zones</p>
          <div className="flex items-center gap-4">
            <div className="flex flex-col">
              <span className="text-3xl font-extrabold text-red-400">{stats.criticalZonesCount}</span>
              <span className="text-[10px] text-slate-500 uppercase font-medium">Critical</span>
            </div>
            <div className="h-8 w-px bg-navy-700/50" />
            <div className="flex flex-col">
              <span className="text-3xl font-extrabold text-orange-400">{stats.highZonesCount}</span>
              <span className="text-[10px] text-slate-500 uppercase font-medium">High Risk</span>
            </div>
          </div>
        </div>
        <div className="bg-navy-800 border border-navy-700 p-5 rounded-xl">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">Primary Driver</p>
          <h3 className="text-xl font-extrabold text-white capitalize leading-tight mt-1 truncate">{stats.topDriver}</h3>
        </div>
        <div className="bg-navy-800 border border-navy-700 p-5 rounded-xl">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">Total Incidents</p>
          <h3 className="text-3xl font-extrabold text-white">{stats.totalIncidents}</h3>
        </div>
      </div>

      {/* Live operational analytics */}
      {data.operations && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-navy-800 border border-navy-700 p-5 rounded-xl">
              <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Resource readiness</p>
              <h3 className="text-3xl font-extrabold text-emerald-400">{data.operations.readiness_percent.toFixed(1)}%</h3>
              <p className="text-xs text-slate-500">{data.operations.available_resources} of {data.operations.total_resources} available</p>
            </div>
            <div className="bg-navy-800 border border-navy-700 p-5 rounded-xl">
              <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Active dispatches</p>
              <h3 className="text-3xl font-extrabold text-blue-400">{data.operations.active_dispatches}</h3>
              <p className="text-xs text-slate-500">{data.operations.completed_dispatches} completed</p>
            </div>
            <div className="bg-navy-800 border border-navy-700 p-5 rounded-xl">
              <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Emergency beds</p>
              <h3 className="text-3xl font-extrabold text-cyan-400">{data.operations.available_emergency_beds}</h3>
              <p className="text-xs text-slate-500">{data.operations.available_icu_beds} ICU beds available</p>
            </div>
            <div className="bg-navy-800 border border-navy-700 p-5 rounded-xl">
              <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Hospitals accepting</p>
              <h3 className="text-3xl font-extrabold text-violet-400">{data.operations.hospitals_accepting_patients}</h3>
              <p className="text-xs text-slate-500">{data.operations.hospitals_on_diversion} on diversion</p>
            </div>
          </div>
          <p className="text-xs text-slate-500 mb-6">{data.operations.data_source_note}</p>
        </>
      )}

      {/* Grid of 5 Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-8">

        {/* Chart 1: Risk Distribution by Level */}
        <div className="bg-navy-800 border border-navy-700 rounded-xl p-5 flex flex-col justify-between">
          <h3 className="text-white font-semibold text-sm mb-6 uppercase tracking-wider">1. Risk Distribution by Level</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartsData.riskDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {chartsData.riskDistribution.map((entry) => (
                    <Cell key={entry.name} fill={getLevelColor(entry.name)} />
                  ))}
                </Pie>
                <RechartsTooltip content={<CustomTooltip />} />
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  wrapperStyle={{ fontSize: '11px', color: '#cbd5e1' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Top 10 Highest-Risk Areas */}
        <div className="bg-navy-800 border border-navy-700 rounded-xl p-5">
          <h3 className="text-white font-semibold text-sm mb-6 uppercase tracking-wider">2. Top 10 Highest-Risk Areas</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartsData.topAreas} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} domain={[0, 100]} />
                <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: '#334155', opacity: 0.4 }} />
                <Bar dataKey="score" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 3: Average Factor Contribution City-Wide */}
        <div className="bg-navy-800 border border-navy-700 rounded-xl p-5">
          <h3 className="text-white font-semibold text-sm mb-6 uppercase tracking-wider">3. Average Factor Contribution City-Wide</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartsData.avgFactorContributions}
                layout="vertical"
                margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                <XAxis type="number" stroke="#94a3b8" fontSize={11} />
                <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={11} width={120} tickLine={false} />
                <RechartsTooltip content={<CustomTooltip />} />
                <Bar dataKey="contribution" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={12} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 4: Incident Priority Distribution */}
        <div className="bg-navy-800 border border-navy-700 rounded-xl p-5">
          <h3 className="text-white font-semibold text-sm mb-6 uppercase tracking-wider">4. Incident Priority Distribution</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartsData.priorityDistribution} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: '#334155', opacity: 0.4 }} />
                <Bar dataKey="count" fill="#eab308" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 5: Risk Score vs Active Incident Count (Correlation) */}
        <div className="bg-navy-800 border border-navy-700 rounded-xl p-5 lg:col-span-2">
          <h3 className="text-white font-semibold text-sm mb-6 uppercase tracking-wider">5. Risk Score vs Incident Count Correlation</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: -20 }}>
                <CartesianGrid stroke="#334155" />
                <XAxis type="number" dataKey="x" name="Risk Score" stroke="#94a3b8" fontSize={11}>
                  <Label value="Risk Score" offset={-10} position="insideBottom" fill="#94a3b8" fontSize={11} />
                </XAxis>
                <YAxis type="number" dataKey="y" name="Incident Count" stroke="#94a3b8" fontSize={11}>
                  <Label value="Incident Count" angle={-90} position="insideLeft" style={{ textAnchor: 'middle' }} fill="#94a3b8" fontSize={11} />
                </YAxis>
                <ZAxis type="number" dataKey="z" range={[60, 400]} />
                <RechartsTooltip
                  cursor={{ strokeDasharray: '3 3' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const item = payload[0].payload;
                      return (
                        <div className="bg-navy-950 border border-navy-700 p-3 rounded-lg shadow-lg">
                          <p className="text-white font-semibold text-sm mb-1">{item.name}</p>
                          <p className="text-red-400 text-xs">Risk Score: {item.x.toFixed(1)}</p>
                          <p className="text-blue-400 text-xs">Incidents: {item.y}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Scatter name="Hotspots" data={chartsData.riskVsIncident} fill="#f43f5e" />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </PageContainer>
  );
};

export default Analytics;
