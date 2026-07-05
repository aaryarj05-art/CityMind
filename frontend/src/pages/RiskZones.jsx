import React, { useState, useEffect, useCallback } from 'react';
import PageContainer from '../components/layout/PageContainer';
import EmptyState from '../components/common/EmptyState';
import LoadingState from '../components/common/LoadingState';
import ErrorState from '../components/common/ErrorState';
import RiskLevelBadge from '../components/common/RiskLevelBadge';
import RiskScoreBadge from '../components/common/RiskScoreBadge';
import Modal from '../components/common/Modal';
import FactorContributionChart from '../components/common/FactorContributionChart';
import RiskExplanationPanel from '../components/common/RiskExplanationPanel';
import { riskAPI } from '../services/api';
import { formatDate } from '../utils/formatters';
import { Search, Filter, X, ArrowUpDown, ChevronDown, ChevronUp, Brain, Info } from 'lucide-react';

const RiskZones = () => {
  const [areas, setAreas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Selected area for detail modal
  const [selectedAreaId, setSelectedAreaId] = useState(null);
  const [areaDetails, setAreaDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState(null);

  // Filters state
  const [search, setSearch] = useState('');
  const [riskLevel, setRiskLevel] = useState('');
  const [minScore, setMinScore] = useState('');
  const [sortOrder, setSortOrder] = useState('desc');

  const fetchAreas = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Build clean params object, avoiding empty strings
      const params = {};
      if (search.trim()) params.search = search.trim();
      if (riskLevel) params.risk_level = riskLevel;
      if (minScore) params.min_score = parseFloat(minScore);
      params.sort_order = sortOrder;

      const res = await riskAPI.getAreas(params);
      setAreas(res.data);
    } catch (err) {
      setError(err.message || 'Failed to load risk zones from backend API');
    } finally {
      setLoading(false);
    }
  }, [search, riskLevel, minScore, sortOrder]);

  useEffect(() => {
    fetchAreas();
  }, [fetchAreas]);

  // Fetch individual Area Risk Details when modal opens
  useEffect(() => {
    if (!selectedAreaId) {
      setAreaDetails(null);
      return;
    }

    const fetchAreaDetails = async () => {
      setDetailsLoading(true);
      setDetailsError(null);
      try {
        const res = await riskAPI.getAreaById(selectedAreaId);
        setAreaDetails(res.data);
      } catch (err) {
        setDetailsError(err.message || 'Failed to load area risk details');
      } finally {
        setDetailsLoading(false);
      }
    };

    fetchAreaDetails();
  }, [selectedAreaId]);

  const clearFilters = () => {
    setSearch('');
    setRiskLevel('');
    setMinScore('');
    setSortOrder('desc');
  };

  const handleRowClick = (areaId) => {
    setSelectedAreaId(areaId);
  };

  const toggleSortOrder = () => {
    setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc');
  };

  const formatFactorName = (name) => {
    return name.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
  };

  return (
    <PageContainer title="Risk Zones">
      <div className="bg-navy-800 border border-navy-700 rounded-xl overflow-hidden flex flex-col h-[calc(100vh-140px)]">
        
        {/* Toolbar with Filters */}
        <div className="p-4 border-b border-navy-700 bg-navy-800/80 flex flex-col lg:flex-row gap-4 items-center justify-between">
          <div className="relative w-full lg:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search area name or ward..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-navy-900 border border-navy-700 rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>
          
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            {/* Risk Level Filter */}
            <div className="flex items-center space-x-2 bg-navy-900 border border-navy-700 rounded-lg px-3 py-1.5">
              <Filter className="w-4 h-4 text-slate-400" />
              <select 
                value={riskLevel} 
                onChange={e => setRiskLevel(e.target.value)} 
                className="bg-transparent text-sm text-slate-200 outline-none w-28 appearance-none"
              >
                <option value="">All Risk Levels</option>
                <option value="Low">Low</option>
                <option value="Moderate">Moderate</option>
                <option value="High">High</option>
                <option value="Critical">Critical</option>
              </select>
            </div>

            {/* Minimum Score Filter */}
            <div className="flex items-center space-x-2 bg-navy-900 border border-navy-700 rounded-lg px-3 py-1.5">
              <select 
                value={minScore} 
                onChange={e => setMinScore(e.target.value)} 
                className="bg-transparent text-sm text-slate-200 outline-none w-36 appearance-none"
              >
                <option value="">Min Score: Any</option>
                <option value="30">Min Score: 30+</option>
                <option value="50">Min Score: 50+</option>
                <option value="70">Min Score: 70+</option>
                <option value="85">Min Score: 85+</option>
              </select>
            </div>

            {/* Sort Order Toggle */}
            <button 
              onClick={toggleSortOrder}
              className="flex items-center gap-1.5 text-sm text-slate-200 bg-navy-900 border border-navy-700 px-3 py-1.5 rounded-lg hover:bg-navy-750 transition-colors"
              aria-label={`Sort list ${sortOrder === 'desc' ? 'ascending' : 'descending'}`}
            >
              <ArrowUpDown className="w-4 h-4 text-slate-400" />
              <span>Score: {sortOrder === 'desc' ? 'High to Low' : 'Low to High'}</span>
            </button>

            {/* Clear Button */}
            {(search || riskLevel || minScore) && (
              <button 
                onClick={clearFilters} 
                className="text-xs text-slate-400 hover:text-white flex items-center bg-navy-700 px-2 py-1.5 rounded-lg transition-colors"
              >
                <X className="w-3 h-3 mr-1" /> Clear
              </button>
            )}
          </div>
        </div>

        {/* List Content */}
        <div className="flex-1 overflow-auto p-0">
          {loading ? (
            <div className="pt-20"><LoadingState message="Fetching deterministic risk zones..." /></div>
          ) : error ? (
            <div className="p-8">
              <ErrorState 
                message="Dynamic risk intelligence is unavailable. Check server connection." 
                details={error}
                onRetry={fetchAreas} 
              />
            </div>
          ) : areas.length === 0 ? (
            <div className="pt-20"><EmptyState message="No risk zones found matching filters" /></div>
          ) : (
            <div>
              <div className="px-6 py-3 bg-navy-900/50 text-xs font-medium text-slate-400 uppercase tracking-wider flex justify-between items-center border-b border-navy-700">
                <span>{areas.length} Calculated Risk Zones</span>
                <span className="flex items-center gap-1">
                  <Brain className="w-3 h-3 text-blue-400" /> Dynamic Risk Scoring Active
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-navy-900/50 text-slate-400 uppercase text-xs">
                    <tr>
                      <th className="px-6 py-4 font-medium text-center w-12">Rank</th>
                      <th className="px-6 py-4 font-medium">Area</th>
                      <th className="px-6 py-4 font-medium">Score</th>
                      <th className="px-6 py-4 font-medium">Risk Level</th>
                      <th className="px-6 py-4 font-medium">Primary Driver</th>
                      <th className="px-6 py-4 font-medium">Secondary Drivers</th>
                      <th className="px-6 py-4 font-medium">Analysis Summary</th>
                      <th className="px-6 py-4 font-medium text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-navy-700/50">
                    {areas.map((zone, index) => {
                      const topFactor = zone.top_contributing_factors?.[0];
                      const secondThirdFactors = zone.top_contributing_factors?.slice(1, 3) || [];

                      return (
                        <tr 
                          key={zone.area_id} 
                          onClick={() => handleRowClick(zone.area_id)}
                          className="hover:bg-navy-700/35 transition-colors cursor-pointer"
                        >
                          <td className="px-6 py-4 text-center font-bold text-slate-500">
                            {index + 1}
                          </td>
                          <td className="px-6 py-4">
                            <div className="font-semibold text-white">{zone.area_name}</div>
                            <div className="text-xs text-slate-500">{zone.ward_number}</div>
                          </td>
                          <td className="px-6 py-4">
                            <RiskScoreBadge score={zone.risk_score} />
                          </td>
                          <td className="px-6 py-4">
                            <RiskLevelBadge level={zone.risk_level} />
                          </td>
                          <td className="px-6 py-4 text-slate-300">
                            {topFactor ? (
                              <div className="flex flex-col">
                                <span className="font-medium text-slate-200 capitalize">
                                  {topFactor.factor.replace('_', ' ')}
                                </span>
                                <span className="text-[10px] text-red-400">
                                  +{topFactor.contribution.toFixed(1)} pts
                                </span>
                              </div>
                            ) : 'N/A'}
                          </td>
                          <td className="px-6 py-4 text-slate-400 text-xs">
                            <div className="flex flex-col gap-0.5">
                              {secondThirdFactors.map(f => (
                                <span key={f.factor} className="capitalize">
                                  • {f.factor.replace('_', ' ')} ({f.contribution.toFixed(0)} pts)
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-slate-400 max-w-xs truncate" title={zone.explanation}>
                            {zone.explanation}
                          </td>
                          <td className="px-6 py-4 text-right" onClick={e => e.stopPropagation()}>
                            <button 
                              onClick={() => handleRowClick(zone.area_id)}
                              className="text-blue-400 hover:text-blue-300 font-semibold text-xs uppercase tracking-wider bg-blue-500/10 px-3 py-1.5 rounded border border-blue-500/20"
                            >
                              Details
                            </button>
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

      {/* Details Modal */}
      <Modal 
        isOpen={!!selectedAreaId} 
        onClose={() => setSelectedAreaId(null)}
        title="Area Risk Details"
      >
        {detailsLoading ? (
          <div className="py-12"><LoadingState message="Fetching area calculations..." /></div>
        ) : detailsError ? (
          <div className="p-6">
            <ErrorState message="Could not fetch area details" details={detailsError} />
          </div>
        ) : areaDetails ? (
          <div className="space-y-6">
            <div className="flex justify-between items-start border-b border-navy-700 pb-3">
              <div>
                <h3 className="text-xl font-bold text-white">{areaDetails.area_name}</h3>
                <p className="text-xs text-slate-400 mt-0.5">Ward Number: {areaDetails.ward_number}</p>
              </div>
              <div className="text-[10px] text-slate-500 font-mono text-right">
                Updated: {formatDate(areaDetails.last_calculated)}
              </div>
            </div>

            {/* Calculations Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2 bg-navy-900 border border-navy-700 rounded-xl p-4">
                <h4 className="text-slate-300 font-semibold text-xs uppercase tracking-wider mb-4 flex items-center gap-1.5">
                  <Info className="w-4 h-4 text-blue-400" /> Factor Contributions
                </h4>
                <FactorContributionChart factors={areaDetails.top_contributing_factors} />
              </div>
              
              <div className="md:col-span-1">
                <RiskExplanationPanel areaRisk={areaDetails} />
              </div>
            </div>

            {/* Configured Weights & Scores Table */}
            <div className="bg-navy-900 border border-navy-700 rounded-xl overflow-hidden">
              <div className="px-4 py-2 bg-navy-950/80 text-xs font-semibold text-slate-400 uppercase">
                Detailed Parameter Calculations
              </div>
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-navy-950/30 text-slate-500 uppercase text-[10px]">
                  <tr>
                    <th className="px-4 py-2">Parameter</th>
                    <th className="px-4 py-2 text-right">Raw Score</th>
                    <th className="px-4 py-2 text-right">Weight</th>
                    <th className="px-4 py-2 text-right text-red-400">Contribution</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-750">
                  {Object.entries(areaDetails.factor_scores).map(([factor, rawScore]) => {
                    const weight = areaDetails.factor_weights[factor] || 0;
                    const contribution = areaDetails.weighted_contributions[factor] || 0;
                    return (
                      <tr key={factor} className="hover:bg-navy-750/30">
                        <td className="px-4 py-2 font-medium text-slate-300 capitalize">
                          {factor.replace('_', ' ')}
                        </td>
                        <td className="px-4 py-2 text-right text-slate-400">
                          {rawScore.toFixed(1)}
                        </td>
                        <td className="px-4 py-2 text-right text-slate-500">
                          {weight.toFixed(2)}
                        </td>
                        <td className="px-4 py-2 text-right text-red-400 font-semibold">
                          {contribution.toFixed(2)} pts
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-4 border-t border-navy-700/50">
              <button 
                onClick={() => setSelectedAreaId(null)}
                className="px-4 py-2 bg-navy-700 hover:bg-navy-600 rounded-lg text-sm font-medium text-white transition-colors border border-navy-600"
              >
                Close Details
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </PageContainer>
  );
};

export default RiskZones;
