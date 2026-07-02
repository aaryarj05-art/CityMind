import { useState, useEffect, useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import PageContainer from '../components/layout/PageContainer';
import LoadingState from '../components/common/LoadingState';
import ErrorState from '../components/common/ErrorState';
import { incidentsAPI, resourcesAPI, areasAPI } from '../services/api';
import { AlertCircle, Target, Activity, Shield } from 'lucide-react';

const COLORS = ['#3b82f6', '#f59e0b', '#ef4444', '#10b981', '#8b5cf6', '#64748b'];

const Analytics = () => {
  const [data, setData] = useState({ incidents: [], resources: [], areas: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAnalyticsData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [incRes, resRes, areasRes] = await Promise.all([
        incidentsAPI.getAll(),
        resourcesAPI.getAll(),
        areasAPI.getAll()
      ]);
      setData({
        incidents: incRes.data,
        resources: resRes.data,
        areas: areasRes.data
      });
    } catch (err) {
      setError(err.message || 'Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalyticsData();
  }, []);

  // Compute Metrics
  const metrics = useMemo(() => {
    if (!data.incidents.length) return null;
    
    const categoryCounts = data.incidents.reduce((acc, inc) => {
      acc[inc.category] = (acc[inc.category] || 0) + 1;
      return acc;
    }, {});
    
    let mostCommonCat = '';
    let maxCatCount = 0;
    Object.entries(categoryCounts).forEach(([cat, count]) => {
      if (count > maxCatCount) {
        maxCatCount = count;
        mostCommonCat = cat;
      }
    });

    const avgScore = data.areas.length > 0 
      ? data.areas.reduce((sum, a) => sum + a.operational_score, 0) / data.areas.length 
      : 0;
      
    const availableRes = data.resources.filter(r => r.status === 'Available').length;
    const availPercent = data.resources.length > 0 
      ? Math.round((availableRes / data.resources.length) * 100) 
      : 0;

    return {
      totalIncidents: data.incidents.length,
      mostCommonCategory: mostCommonCat,
      averageScore: Math.round(avgScore),
      resourceAvailability: availPercent
    };
  }, [data]);

  // Compute Chart Data
  const chartData = useMemo(() => {
    // 1. Incidents by Category (Pie)
    const incCatMap = {};
    data.incidents.forEach(inc => { incCatMap[inc.category] = (incCatMap[inc.category] || 0) + 1; });
    const incidentsByCategory = Object.keys(incCatMap).map(name => ({ name, value: incCatMap[name] }));

    // 2. Incidents by Severity (Bar)
    const incSevMap = { Critical: 0, High: 0, Moderate: 0, Low: 0 };
    data.incidents.forEach(inc => { if (incSevMap[inc.severity] !== undefined) incSevMap[inc.severity]++; });
    const incidentsBySeverity = Object.keys(incSevMap).map(name => ({ name, count: incSevMap[name] }));

    // 3. Resources by Status (Bar)
    const resStatusMap = {};
    data.resources.forEach(res => { resStatusMap[res.status] = (resStatusMap[res.status] || 0) + 1; });
    const resourcesByStatus = Object.keys(resStatusMap).map(name => ({ name, count: resStatusMap[name] }));

    // 4. Area Operational Scores (Bar)
    const areaScores = data.areas.map(a => ({ name: `Area ${a.id}`, score: a.operational_score }))
                                 .sort((a, b) => b.score - a.score);

    return { incidentsByCategory, incidentsBySeverity, resourcesByStatus, areaScores };
  }, [data]);

  if (loading) return <PageContainer title="Analytics"><LoadingState /></PageContainer>;
  if (error) return <PageContainer title="Analytics"><ErrorState message={error} onRetry={fetchAnalyticsData} /></PageContainer>;

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-navy-900 border border-navy-700 p-3 rounded-lg shadow-lg">
          <p className="text-white font-medium text-sm mb-1">{label || payload[0].name}</p>
          <p className="text-blue-400 text-sm">{`${payload[0].value}`}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <PageContainer title="City Analytics">
      <div className="bg-navy-800/50 border border-navy-700 rounded-xl p-4 mb-6 flex items-center gap-3">
        <Activity className="w-5 h-5 text-blue-400" />
        <p className="text-sm text-slate-300 font-medium">
          Demonstration analytics based on seeded Mysuru operational data.
        </p>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
        <div className="bg-navy-800 border border-navy-700 p-5 rounded-xl">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-slate-400 text-sm font-medium mb-1">Total Incidents</p>
              <h3 className="text-2xl font-bold text-white">{metrics?.totalIncidents || 0}</h3>
            </div>
            <div className="p-2 bg-blue-500/10 rounded-lg"><Target className="w-5 h-5 text-blue-400" /></div>
          </div>
        </div>
        <div className="bg-navy-800 border border-navy-700 p-5 rounded-xl">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-slate-400 text-sm font-medium mb-1">Most Common Issue</p>
              <h3 className="text-xl font-bold text-white leading-tight mt-1">{metrics?.mostCommonCategory || 'N/A'}</h3>
            </div>
            <div className="p-2 bg-orange-500/10 rounded-lg"><AlertCircle className="w-5 h-5 text-orange-400" /></div>
          </div>
        </div>
        <div className="bg-navy-800 border border-navy-700 p-5 rounded-xl">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-slate-400 text-sm font-medium mb-1">Avg Operational Score</p>
              <h3 className="text-2xl font-bold text-white">{metrics?.averageScore || 0}<span className="text-sm font-normal text-slate-500">/100</span></h3>
            </div>
            <div className="p-2 bg-red-500/10 rounded-lg"><Activity className="w-5 h-5 text-red-400" /></div>
          </div>
        </div>
        <div className="bg-navy-800 border border-navy-700 p-5 rounded-xl">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-slate-400 text-sm font-medium mb-1">Resource Availability</p>
              <h3 className="text-2xl font-bold text-white">{metrics?.resourceAvailability || 0}%</h3>
            </div>
            <div className="p-2 bg-emerald-500/10 rounded-lg"><Shield className="w-5 h-5 text-emerald-400" /></div>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-8">
        
        {/* Chart 1: Incidents by Category */}
        <div className="bg-navy-800 border border-navy-700 rounded-xl p-5">
          <h3 className="text-white font-medium mb-6">Incidents by Category</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData.incidentsByCategory}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {chartData.incidentsByCategory.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip content={<CustomTooltip />} />
                <Legend 
                  verticalAlign="bottom" 
                  height={36} 
                  wrapperStyle={{ fontSize: '12px', color: '#cbd5e1' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Incidents by Severity */}
        <div className="bg-navy-800 border border-navy-700 rounded-xl p-5">
          <h3 className="text-white font-medium mb-6">Incidents by Severity</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData.incidentsBySeverity} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: '#334155', opacity: 0.4 }} />
                <Bar dataKey="count" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 3: Resources by Status */}
        <div className="bg-navy-800 border border-navy-700 rounded-xl p-5">
          <h3 className="text-white font-medium mb-6">Resources by Status</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData.resourcesByStatus} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: '#334155', opacity: 0.4 }} />
                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 4: Area Operational Scores */}
        <div className="bg-navy-800 border border-navy-700 rounded-xl p-5">
          <h3 className="text-white font-medium mb-6">Area Operational Scores</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData.areaScores} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} domain={[0, 100]} />
                <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: '#334155', opacity: 0.4 }} />
                <Bar dataKey="score" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </PageContainer>
  );
};

export default Analytics;
