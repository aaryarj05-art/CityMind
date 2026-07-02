import React, { useState, useEffect, useMemo } from 'react';
import PageContainer from '../components/layout/PageContainer';
import StatCard from '../components/dashboard/StatCard';
import CityMap from '../components/dashboard/CityMap';
import IncidentFeed from '../components/dashboard/IncidentFeed';
import ResourceSummary from '../components/dashboard/ResourceSummary';
import SystemStatus from '../components/dashboard/SystemStatus';
import LoadingState from '../components/common/LoadingState';
import ErrorState from '../components/common/ErrorState';
import RiskLevelBadge from '../components/common/RiskLevelBadge';
import DispatchDetailsDrawer from '../components/common/DispatchDetailsDrawer';
import { useDashboardData } from '../hooks/useDashboardData';
import { riskAPI, areasAPI, dispatchAPI } from '../services/api';
import { formatDate } from '../utils/formatters';
import { AlertCircle, Map, Siren, Shield, Truck, Clock, ShieldAlert, Brain, Zap, Send, Eye, Users, CheckCircle2 } from 'lucide-react';

const Dashboard = () => {
  const { data: p1Data, loading: p1Loading, error: p1Error, refetch: p1Refetch } = useDashboardData();
  
  const [riskSummary, setRiskSummary] = useState(null);
  const [riskAreas, setRiskAreas] = useState([]);
  const [areasList, setAreasList] = useState([]);
  const [riskLoading, setRiskLoading] = useState(true);
  const [riskError, setRiskError] = useState(null);

  const [dispatchSummary, setDispatchSummary] = useState(null);
  const [activeDispatches, setActiveDispatches] = useState([]);
  const [dispatchLoading, setDispatchLoading] = useState(true);
  const [dispatchError, setDispatchError] = useState(null);

  // Selected dispatch for details drawer
  const [selectedDispatchId, setSelectedDispatchId] = useState(null);

  const fetchDashboardData = async () => {
    setRiskLoading(true);
    setRiskError(null);
    setDispatchLoading(true);
    setDispatchError(null);
    try {
      const [sumRes, areasRes, coordsRes, dispSumRes, dispRes] = await Promise.all([
        riskAPI.getSummary(),
        riskAPI.getAreas(),
        areasAPI.getAll(),
        dispatchAPI.getSummary(),
        dispatchAPI.getAll({ active_only: true })
      ]);
      setRiskSummary(sumRes.data);
      setRiskAreas(areasRes.data);
      setAreasList(coordsRes.data);
      setDispatchSummary(dispSumRes.data);
      setActiveDispatches(dispRes.data.slice(0, 5));
    } catch (err) {
      setRiskError(err.message || 'Failed to load risk summary');
      setDispatchError(err.message || 'Failed to load dispatch summary');
    } finally {
      setRiskLoading(false);
      setDispatchLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleRetryAll = () => {
    p1Refetch();
    fetchDashboardData();
  };

  const combinedMapMarkers = useMemo(() => {
    if (!p1Data || !p1Data.map_markers) return [];
    
    // Hospital and Incident markers from Phase 1
    const baseMarkers = [...p1Data.map_markers];
    
    // Map Area Risk levels to all 12 zones using their coordinates
    if (riskAreas.length > 0 && areasList.length > 0) {
      const coordsMap = {};
      areasList.forEach(a => {
        coordsMap[a.id] = { 
          lat: a.latitude, 
          lng: a.longitude, 
          active_incidents: a.active_incident_count 
        };
      });
      
      riskAreas.forEach(ra => {
        const coords = coordsMap[ra.area_id];
        if (coords) {
          baseMarkers.push({
            id: `area-${ra.area_id}`,
            type: 'area',
            title: ra.area_name,
            latitude: coords.lat,
            longitude: coords.lng,
            status: ra.risk_level, // Low, Moderate, High, Critical
            details: {
              risk_score: ra.risk_score,
              top_factor: ra.top_contributing_factors?.[0]?.factor || 'None',
              active_incidents: coords.active_incidents || 0,
              explanation: ra.explanation
            }
          });
        }
      });
    }
    
    return baseMarkers;
  }, [p1Data, riskAreas, areasList]);

  if (p1Loading) return <PageContainer title="City Overview"><LoadingState message="Loading Overview dashboard..." /></PageContainer>;
  if (p1Error) return <PageContainer title="City Overview"><ErrorState message={p1Error} onRetry={handleRetryAll} /></PageContainer>;
  if (!p1Data) return <PageContainer title="City Overview"><ErrorState message="No data received" onRetry={handleRetryAll} /></PageContainer>;

  const { summary, recent_incidents, resource_summary } = p1Data;

  return (
    <PageContainer title="City Overview">
      {/* Phase 1 Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6 mb-8">
        <div className="col-span-1 lg:col-span-2 xl:col-span-1">
          <StatCard title="Active Incidents" value={summary.active_incidents} icon={AlertCircle} color="orange" trend="up" trendValue="+2" />
        </div>
        <div className="col-span-1 lg:col-span-2 xl:col-span-1">
          <StatCard title="Critical Zones" value={summary.critical_zones} icon={Map} color="red" />
        </div>
        <div className="col-span-1 lg:col-span-2 xl:col-span-1">
          <StatCard title="Ambulances" value={summary.available_ambulances} icon={Siren} color="red" />
        </div>
        <div className="col-span-1 lg:col-span-2 xl:col-span-1">
          <StatCard title="Police Units" value={summary.available_police} icon={Shield} color="blue" />
        </div>
        <div className="col-span-1 lg:col-span-2 xl:col-span-1">
          <StatCard title="Fire Engines" value={summary.available_fire} icon={Truck} color="orange" />
        </div>
        <div className="col-span-1 lg:col-span-2 xl:col-span-1">
          <StatCard title="Avg Response" value={summary.average_response_time} icon={Clock} color="purple" />
        </div>
      </div>

      {/* Phase 2 Deterministic Risk Intelligence Section */}
      <div className="bg-navy-800 border border-navy-700 rounded-xl p-6 mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-navy-700/60 pb-4 mb-6">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Brain className="w-5 h-5 text-blue-400" />
              Deterministic Risk Intelligence (Phase 2)
            </h3>
            <p className="text-xs text-slate-400 mt-1">Real-time calculations based on weighted city parameters</p>
          </div>
          {riskSummary && (
            <span className="text-[10px] text-slate-500 font-mono mt-2 md:mt-0">
              Last calculated: {formatDate(riskSummary.last_calculated)}
            </span>
          )}
        </div>

        {riskLoading ? (
          <div className="py-6"><LoadingState message="Calculating city risk metrics..." /></div>
        ) : riskError ? (
          <div className="bg-red-500/10 border border-red-500/20 p-5 rounded-lg flex flex-col items-center justify-center text-center">
            <ShieldAlert className="w-8 h-8 text-red-400 mb-2" />
            <p className="text-sm font-medium text-slate-300">Dynamic Risk Intelligence Unavailable</p>
            <p className="text-xs text-slate-500 mt-1 mb-4">{riskError}</p>
            <button 
              onClick={fetchRiskData}
              className="px-4 py-1.5 bg-navy-700 hover:bg-navy-600 border border-navy-600 rounded-lg text-xs font-semibold text-white transition-colors"
            >
              Retry Connection
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
            {/* Avg City Risk Score */}
            <div className="bg-navy-900/50 border border-navy-700/50 rounded-xl p-4 flex flex-col justify-between">
              <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Avg City Risk</span>
              <div className="my-3 flex items-baseline gap-1.5">
                <span className="text-4xl font-extrabold text-white">{riskSummary.average_city_risk_score.toFixed(1)}</span>
                <span className="text-xs text-slate-500">/100</span>
              </div>
              <div className="flex gap-2">
                <span className="text-xs text-slate-400">Status:</span>
                <span className={`text-xs font-bold ${
                  riskSummary.average_city_risk_score >= 70 ? 'text-red-400' :
                  riskSummary.average_city_risk_score >= 40 ? 'text-yellow-400' : 'text-emerald-400'
                }`}>
                  {riskSummary.average_city_risk_score >= 70 ? 'Elevated' :
                   riskSummary.average_city_risk_score >= 40 ? 'Moderate' : 'Stable'}
                </span>
              </div>
            </div>

            {/* Risk Distribution */}
            <div className="bg-navy-900/50 border border-navy-700/50 rounded-xl p-4 flex flex-col justify-between">
              <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Critical & High Zones</span>
              <div className="my-3 flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-2xl font-bold text-red-400">{riskSummary.critical_area_count}</span>
                  <span className="text-[10px] text-slate-500 uppercase">Critical</span>
                </div>
                <div className="h-8 w-px bg-navy-700/50" />
                <div className="flex flex-col">
                  <span className="text-2xl font-bold text-orange-400">{riskSummary.high_risk_area_count}</span>
                  <span className="text-[10px] text-slate-500 uppercase">High Risk</span>
                </div>
              </div>
              <span className="text-xs text-slate-500">Forming hotspots</span>
            </div>

            {/* Highest Risk Zone */}
            <div className="bg-navy-900/50 border border-navy-700/50 rounded-xl p-4 flex flex-col justify-between">
              <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Highest Risk Zone</span>
              {riskSummary.highest_risk_area ? (
                <div className="my-3">
                  <h4 className="text-base font-bold text-white truncate">{riskSummary.highest_risk_area.area_name}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm font-semibold text-red-400">{riskSummary.highest_risk_area.risk_score.toFixed(1)}</span>
                    <RiskLevelBadge level={riskSummary.highest_risk_area.risk_level} />
                  </div>
                </div>
              ) : (
                <div className="my-3 text-slate-500 text-sm">None</div>
              )}
              <span className="text-[10px] text-slate-500 uppercase tracking-wider">Requires focus</span>
            </div>

            {/* Top Risk Driver */}
            <div className="bg-navy-900/50 border border-navy-700/50 rounded-xl p-4 flex flex-col justify-between">
              <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Top Risk Driver</span>
              <div className="my-3">
                <h4 className="text-base font-bold text-white capitalize">
                  {riskSummary.top_contributing_factor_city_wide ? 
                    riskSummary.top_contributing_factor_city_wide.replace('_', ' ') : 'N/A'}
                </h4>
                <p className="text-xs text-slate-500 mt-1">City-wide maximum impact</p>
              </div>
              <div className="flex items-center gap-1 text-slate-400 text-xs">
                <Zap className="w-3.5 h-3.5 text-yellow-400" />
                <span>Primary Weight</span>
              </div>
            </div>

            {/* Immediate Priority Incidents */}
            <div className="bg-navy-900/50 border border-navy-700/50 rounded-xl p-4 flex flex-col justify-between">
              <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Immediate Incidents</span>
              <div className="my-3 flex items-baseline gap-1.5">
                <span className={`text-4xl font-extrabold ${
                  riskSummary.immediate_priority_incident_count > 0 ? 'text-red-400 animate-pulse' : 'text-slate-300'
                }`}>
                  {riskSummary.immediate_priority_incident_count}
                </span>
                <span className="text-xs text-slate-500">Active</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${
                  riskSummary.immediate_priority_incident_count > 0 ? 'bg-red-500 animate-ping' : 'bg-slate-600'
                }`} />
                <span className="text-[10px] text-slate-500 uppercase font-semibold">High Dispatch Threat</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Phase 3 Dispatch Intelligence Section */}
      <div className="bg-navy-800 border border-navy-700 rounded-xl p-6 mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-navy-700/60 pb-4 mb-6">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Send className="w-5 h-5 text-blue-400" />
              Dispatch & Resource Allocation (Phase 3)
            </h3>
            <p className="text-xs text-slate-400 mt-1">Real-time simulated dispatch lifecycle and candidate recommendations</p>
          </div>
        </div>

        {dispatchLoading ? (
          <div className="py-6"><LoadingState message="Fetching dispatch metrics..." /></div>
        ) : dispatchError ? (
          <div className="bg-red-500/10 border border-red-500/20 p-5 rounded-lg text-center text-slate-400 text-sm">
            Simulated dispatch engine metrics unavailable.
          </div>
        ) : (
          <div className="space-y-6">
            {/* Dispatch Stats Grid */}
            {dispatchSummary && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-navy-900/50 border border-navy-700/50 rounded-xl p-4">
                  <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block">Active Dispatches</span>
                  <span className="text-2xl font-extrabold text-white mt-1.5 block">{dispatchSummary.active_dispatch_count}</span>
                </div>
                <div className="bg-navy-900/50 border border-navy-700/50 rounded-xl p-4">
                  <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block">Currently Assigned</span>
                  <span className="text-2xl font-extrabold text-orange-400 mt-1.5 block">{dispatchSummary.resources_currently_assigned}</span>
                </div>
                <div className="bg-navy-900/50 border border-navy-700/50 rounded-xl p-4">
                  <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block">Average ETA</span>
                  <span className="text-2xl font-extrabold text-yellow-400 mt-1.5 block">{dispatchSummary.average_eta.toFixed(1)} min</span>
                </div>
                <div className="bg-navy-900/50 border border-navy-700/50 rounded-xl p-4">
                  <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block">Incomplete Plans</span>
                  <span className="text-2xl font-extrabold text-red-400 mt-1.5 block">{dispatchSummary.incomplete_response_plan_count}</span>
                </div>
              </div>
            )}

            {/* Shortages & Active List Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Latest Active Dispatches (List) */}
              <div className="lg:col-span-2 space-y-3">
                <span className="text-xs text-slate-400 uppercase font-bold tracking-wider block">Latest Active Dispatches</span>
                {activeDispatches.length === 0 ? (
                  <div className="bg-navy-900/30 border border-navy-700/40 rounded-xl p-6 text-center text-xs text-slate-500 font-semibold">
                    No active dispatches. Use the Incidents page to initiate one.
                  </div>
                ) : (
                  <div className="bg-navy-900/30 border border-navy-700/50 rounded-xl overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs whitespace-nowrap">
                        <thead className="bg-navy-950/40 text-slate-500 uppercase font-semibold">
                          <tr>
                            <th className="px-4 py-2.5">Code</th>
                            <th className="px-4 py-2.5">Status</th>
                            <th className="px-4 py-2.5">ETA</th>
                            <th className="px-4 py-2.5 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-navy-800/40">
                          {activeDispatches.map(disp => (
                            <tr key={disp.id} className="hover:bg-navy-750/20">
                              <td className="px-4 py-3 font-semibold text-white font-mono">{disp.dispatch_code}</td>
                              <td className="px-4 py-3 text-slate-300">{disp.status}</td>
                              <td className="px-4 py-3 text-slate-300 font-mono">
                                {disp.estimated_arrival_minutes ? `${disp.estimated_arrival_minutes.toFixed(1)} min` : '—'}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <button
                                  type="button"
                                  onClick={() => setSelectedDispatchId(disp.id)}
                                  className="p-1 bg-navy-800 hover:bg-navy-700 border border-navy-700 rounded text-slate-300 hover:text-white"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* Resource Shortages Column */}
              <div className="space-y-3">
                <span className="text-xs text-slate-400 uppercase font-bold tracking-wider block">Current Shortages</span>
                {dispatchSummary && Object.keys(dispatchSummary.resource_shortages_by_type).length === 0 ? (
                  <div className="bg-navy-900/30 border border-navy-700/40 rounded-xl p-6 text-center text-xs text-emerald-400 border-emerald-500/10 font-bold flex items-center justify-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    Resource levels optimal
                  </div>
                ) : (
                  <div className="bg-red-500/5 border border-red-500/10 rounded-xl p-4 space-y-2">
                    <span className="text-[10px] text-red-400 uppercase font-bold block mb-1">Active Shortages</span>
                    {dispatchSummary && Object.entries(dispatchSummary.resource_shortages_by_type).map(([type, count]) => (
                      <div key={type} className="flex justify-between items-center text-xs border-b border-red-500/10 pb-1.5 last:border-0 last:pb-0">
                        <span className="text-slate-300 font-semibold">{type}</span>
                        <span className="bg-red-950/80 text-red-400 border border-red-500/25 px-2 py-0.5 rounded font-mono font-bold">
                          -{count} units
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          </div>
        )}
      </div>

      {/* Map, Feeds, and Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2 space-y-6">
          <CityMap markers={combinedMapMarkers} />
          
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">Priority Risk Zones</h3>
            {riskLoading ? (
              <LoadingState message="Loading risk zones..." />
            ) : riskError ? (
              <div className="bg-navy-800 border border-navy-700 rounded-xl p-6 text-center text-slate-400 text-sm">
                Risk zone data unavailable.
              </div>
            ) : (
              <div className="bg-navy-800 border border-navy-700 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-navy-900/50 text-slate-400 uppercase text-xs">
                      <tr>
                        <th className="px-6 py-4 font-medium">Area</th>
                        <th className="px-6 py-4 font-medium">Risk Score</th>
                        <th className="px-6 py-4 font-medium">Level</th>
                        <th className="px-6 py-4 font-medium">Primary Driver</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-navy-700/50">
                      {[...riskAreas]
                        .sort((a, b) => b.risk_score - a.risk_score)
                        .slice(0, 5)
                        .map((zone) => {
                          const topFactor = zone.top_contributing_factors?.[0];
                          return (
                            <tr key={zone.area_id} className="hover:bg-navy-700/30 transition-colors">
                              <td className="px-6 py-4">
                                <div className="font-medium text-white">{zone.area_name}</div>
                                <div className="text-xs text-slate-500">{zone.ward_number}</div>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex items-center">
                                  <span className={`font-bold ${zone.risk_score >= 80 ? 'text-red-400' : zone.risk_score >= 60 ? 'text-orange-400' : zone.risk_score >= 30 ? 'text-yellow-400' : 'text-emerald-400'}`}>
                                    {zone.risk_score.toFixed(1)}
                                  </span>
                                  <span className="text-slate-500 ml-1">/100</span>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <RiskLevelBadge level={zone.risk_level} />
                              </td>
                              <td className="px-6 py-4 text-slate-300 capitalize">
                                {topFactor ? topFactor.factor.replace('_', ' ') : '—'}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
        
        <div className="space-y-6">
          <div className="h-[400px]">
            <IncidentFeed incidents={recent_incidents} />
          </div>
          
          <ResourceSummary summary={resource_summary} />
          
          <SystemStatus statuses={summary.feed_statuses} />
        </div>
      </div>

      {/* Dispatch details drawer for latest dispatches click */}
      <DispatchDetailsDrawer
        isOpen={!!selectedDispatchId}
        onClose={() => setSelectedDispatchId(null)}
        dispatchId={selectedDispatchId}
        onTransitionSuccess={fetchDashboardData}
      />
    </PageContainer>
  );
};

export default Dashboard;
