import { Bell, MapPin, AlertTriangle, Siren, Activity, Rss, CheckCheck, Brain, Sparkles } from 'lucide-react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { dashboardAPI, riskAPI, dispatchAPI } from '../../services/api';

const Topbar = ({ title }) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [readIds, setReadIds] = useState(new Set());
  const [aiStatus, setAiStatus] = useState(() => sessionStorage.getItem('citymind_ai_status') || 'available');
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleStatusChange = (e) => {
      setAiStatus(e.detail || 'available');
    };
    window.addEventListener('citymind-ai-status-change', handleStatusChange);
    return () => window.removeEventListener('citymind-ai-status-change', handleStatusChange);
  }, []);

  // Update clock every minute
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowNotifications(false);
      }
    };
    if (showNotifications) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showNotifications]);

  // Close on Escape
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') setShowNotifications(false);
    };
    if (showNotifications) {
      document.addEventListener('keydown', handleEscape);
    }
    return () => document.removeEventListener('keydown', handleEscape);
  }, [showNotifications]);

  // Derive notifications from Phase 2 risk data + Phase 3 dispatch data + Phase 1 operational data
  const fetchNotifications = useCallback(async () => {
    try {
      const [riskAreasRes, riskIncidentsRes, riskSummaryRes, dispRes, dashRes] = await Promise.allSettled([
        riskAPI.getAreas(),
        riskAPI.getIncidents(),
        riskAPI.getSummary(),
        dispatchAPI.getAll(),
        dashboardAPI.getDashboardData()
      ]);

      const derived = [];
      let notifId = 1;

      // Phase 3 Dispatch Notifications (new dispatches, status changes, shortages, cancellations, completions)
      if (dispRes.status === 'fulfilled') {
        const dispatches = dispRes.value.data;
        dispatches.forEach(disp => {
          const createdAge = Date.now() - new Date(disp.created_at).getTime();
          const updatedAge = Date.now() - new Date(disp.updated_at).getTime();

          // New dispatch created alert (if created in last 1 hour)
          if (createdAge < 3600000) {
            derived.push({
              id: notifId++,
              title: 'New Dispatch Created',
              description: `Simulated dispatch ${disp.dispatch_code} has been initiated for Incident #${disp.incident_id}.`,
              severity: 'high',
              area: `Incident #${disp.incident_id}`,
              timestamp: disp.created_at,
              icon: 'resource',
            });
          }

          // Dispatch Cancelled (if updated in last 1 hour)
          if (disp.status === 'Cancelled' && updatedAge < 3600000) {
            derived.push({
              id: notifId++,
              title: 'Dispatch Cancelled',
              description: `Simulated dispatch ${disp.dispatch_code} was cancelled. Responders released.`,
              severity: 'critical',
              area: `Incident #${disp.incident_id}`,
              timestamp: disp.updated_at,
              icon: 'feed',
            });
          }

          // Dispatch Completed (if updated in last 1 hour)
          if (disp.status === 'Completed' && updatedAge < 3600000) {
            derived.push({
              id: notifId++,
              title: 'Dispatch Completed',
              description: `Simulated dispatch ${disp.dispatch_code} was completed. Target incident resolved.`,
              severity: 'high',
              area: `Incident #${disp.incident_id}`,
              timestamp: disp.updated_at,
              icon: 'zone',
            });
          }

          // Dispatch Status Changed (if updated in last 1 hour, not Terminal)
          if (!['Planned', 'Completed', 'Cancelled'].includes(disp.status) && updatedAge < 3600000) {
            derived.push({
              id: notifId++,
              title: 'Dispatch Status Changed',
              description: `Simulated dispatch ${disp.dispatch_code} is now ${disp.status}.`,
              severity: 'high',
              area: `Incident #${disp.incident_id}`,
              timestamp: disp.updated_at,
              icon: 'incident',
            });
          }

          // Shortages alert in active dispatch
          if (!['Completed', 'Cancelled'].includes(disp.status) && disp.shortages && Object.keys(disp.shortages).length > 0) {
            derived.push({
              id: notifId++,
              title: 'Dispatch Shortage Alert',
              description: `Simulated dispatch ${disp.dispatch_code} has active unfilled resource shortages.`,
              severity: 'critical',
              area: `Incident #${disp.incident_id}`,
              timestamp: disp.updated_at,
              icon: 'resource',
            });
          }

          // Incomplete response plan in active dispatch
          if (!['Completed', 'Cancelled'].includes(disp.status) && !disp.plan_complete) {
            derived.push({
              id: notifId++,
              title: 'Incomplete Response Plan',
              description: `Simulated dispatch ${disp.dispatch_code} plan is currently incomplete.`,
              severity: 'high',
              area: `Incident #${disp.incident_id}`,
              timestamp: disp.updated_at,
              icon: 'zone',
            });
          }
        });
      }

      // Phase 2 risk zone alerts — Critical and High risk areas
      if (riskAreasRes.status === 'fulfilled') {
        const riskAreas = riskAreasRes.value.data;
        riskAreas.forEach(area => {
          if (area.risk_level === 'Critical') {
            derived.push({
              id: notifId++,
              title: 'Critical Risk Zone',
              description: `${area.area_name} has a critical risk score of ${area.risk_score.toFixed(1)}/100. ${area.explanation}`,
              severity: 'critical',
              area: area.area_name,
              timestamp: area.last_calculated || new Date().toISOString(),
              icon: 'zone',
            });
          } else if (area.risk_level === 'High') {
            derived.push({
              id: notifId++,
              title: 'High Risk Zone',
              description: `${area.area_name} has a high risk score of ${area.risk_score.toFixed(1)}/100. Top driver: ${area.top_contributing_factors?.[0]?.factor?.replace('_', ' ') || 'multiple factors'}.`,
              severity: 'high',
              area: area.area_name,
              timestamp: area.last_calculated || new Date().toISOString(),
              icon: 'zone',
            });
          }
        });
      }

      // Phase 2 priority incidents — Immediate and Urgent only
      if (riskIncidentsRes.status === 'fulfilled') {
        const riskIncidents = riskIncidentsRes.value.data;
        riskIncidents.forEach(inc => {
          if (inc.priority_level === 'Immediate' || inc.priority_level === 'Urgent') {
            derived.push({
              id: notifId++,
              title: `${inc.priority_level} Priority Incident`,
              description: `${inc.title} — Priority score: ${inc.priority_score.toFixed(1)}/100. ${inc.recommended_response_urgency}.`,
              severity: inc.priority_level === 'Immediate' ? 'critical' : 'high',
              area: inc.area_name,
              timestamp: inc.last_calculated || new Date().toISOString(),
              icon: 'incident',
            });
          }
        });
      }

      // Phase 2 city-wide summary alert
      if (riskSummaryRes.status === 'fulfilled') {
        const summary = riskSummaryRes.value.data;
        if (summary.average_city_risk_score >= 60) {
          derived.push({
            id: notifId++,
            title: 'City Risk Elevated',
            description: `City-wide average risk is ${summary.average_city_risk_score.toFixed(1)}/100 with ${summary.critical_area_count} critical and ${summary.high_risk_area_count} high-risk zones.`,
            severity: summary.average_city_risk_score >= 70 ? 'critical' : 'high',
            area: null,
            timestamp: summary.last_calculated || new Date().toISOString(),
            icon: 'zone',
          });
        }
      }

      // Phase 1 operational alerts — Feed delays and Resource shortages
      if (dashRes.status === 'fulfilled') {
        const data = dashRes.value.data;

        // Feed delays
        if (data.summary && data.summary.feed_statuses) {
          Object.entries(data.summary.feed_statuses).forEach(([feed, status]) => {
            if (status === 'Delayed' || status === 'Offline') {
              derived.push({
                id: notifId++,
                title: `Feed ${status}`,
                description: `${feed} is currently ${status.toLowerCase()}.`,
                severity: status === 'Offline' ? 'critical' : 'high',
                area: null,
                timestamp: new Date().toISOString(),
                icon: 'feed',
              });
            }
          });
        }

        // Resource shortages (if availability < 30%)
        if (data.resource_summary) {
          Object.entries(data.resource_summary).forEach(([key, val]) => {
            if (val.total > 0 && val.available / val.total < 0.3) {
              const label = key.charAt(0).toUpperCase() + key.slice(1);
              derived.push({
                id: notifId++,
                title: 'Resource Shortage',
                description: `Only ${val.available}/${val.total} ${label} units available.`,
                severity: val.available === 0 ? 'critical' : 'high',
                area: null,
                timestamp: new Date().toISOString(),
                icon: 'resource',
              });
            }
          });
        }
      }

      setNotifications(derived);
    } catch {
      // Silently fail — the notification bell just won't have items
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const unreadCount = notifications.filter(n => !readIds.has(n.id)).length;

  const markAsRead = (id) => {
    setReadIds(prev => new Set(prev).add(id));
  };

  const markAllAsRead = () => {
    setReadIds(new Set(notifications.map(n => n.id)));
  };

  const getIcon = (type) => {
    switch (type) {
      case 'zone': return <AlertTriangle className="w-4 h-4 text-red-400" />;
      case 'incident': return <Activity className="w-4 h-4 text-orange-400" />;
      case 'resource': return <Siren className="w-4 h-4 text-yellow-400" />;
      case 'feed': return <Rss className="w-4 h-4 text-purple-400" />;
      default: return <Bell className="w-4 h-4 text-slate-400" />;
    }
  };

  const formatRelativeTime = (timestamp) => {
    if (!timestamp) return '';
    const diff = Date.now() - new Date(timestamp).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <div className="h-16 bg-navy-800 border-b border-navy-700 flex items-center justify-between px-8 sticky top-0 z-20">
      <h2 className="text-xl font-semibold text-white">{title}</h2>
      
      <div className="flex items-center space-x-6 text-sm">
        <div className="flex items-center bg-navy-900 px-3 py-1.5 rounded-full border border-navy-700">
          <MapPin className="w-4 h-4 text-blue-400 mr-2" />
          <span className="text-slate-200 font-medium">Mysuru</span>
        </div>
        
        <div className="flex items-center space-x-2 text-slate-400">
          <span>{currentTime.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
          <span>•</span>
          <span>{currentTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
        </div>

        {/* AI Status Indicator */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-navy-900 rounded-full border border-navy-700">
          <Sparkles className="w-3.5 h-3.5 text-blue-400" />
          <span className={`w-1.5 h-1.5 rounded-full ${
            aiStatus === 'available' ? 'bg-emerald-400 animate-pulse' :
            aiStatus === 'processing' ? 'bg-blue-400 animate-pulse' :
            'bg-red-500'
          }`} />
          <span className={`text-[11px] font-medium ${
            aiStatus === 'available' ? 'text-emerald-400' :
            aiStatus === 'processing' ? 'text-blue-400' :
            'text-red-400'
          }`}>
            {aiStatus === 'available' ? 'AI Available' :
             aiStatus === 'processing' ? 'AI Processing' :
             'AI Offline'}
          </span>
        </div>
        
        {/* Notification Bell */}
        <div className="relative" ref={dropdownRef}>
          <button 
            onClick={() => setShowNotifications(prev => !prev)}
            className="relative p-2 text-slate-400 hover:text-white transition-colors"
            aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
            aria-expanded={showNotifications}
            aria-haspopup="true"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full px-1">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Notification Panel */}
          {showNotifications && (
            <div className="absolute right-0 top-12 w-96 max-h-[28rem] bg-navy-800 border border-navy-700 rounded-xl shadow-2xl overflow-hidden flex flex-col z-50">
              <div className="p-4 border-b border-navy-700 flex items-center justify-between bg-navy-800/90 sticky top-0">
                <h3 className="text-white font-semibold text-sm">Notifications</h3>
                {unreadCount > 0 && (
                  <button 
                    onClick={markAllAsRead}
                    className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                    aria-label="Mark all notifications as read"
                  >
                    <CheckCheck className="w-3.5 h-3.5" /> Mark all read
                  </button>
                )}
              </div>
              <div className="flex-1 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 text-sm">
                    <Bell className="w-8 h-8 mx-auto mb-3 opacity-40" />
                    No notifications at this time.
                  </div>
                ) : (
                  notifications.map(notif => {
                    const isUnread = !readIds.has(notif.id);
                    return (
                      <div 
                        key={notif.id}
                        onClick={() => markAsRead(notif.id)}
                        className={`p-4 border-b border-navy-700/50 cursor-pointer transition-colors hover:bg-navy-700/30 ${
                          isUnread ? 'bg-navy-900/40' : ''
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 p-1.5 bg-navy-900 rounded-lg border border-navy-700 flex-shrink-0">
                            {getIcon(notif.icon)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h4 className={`text-sm font-medium truncate ${isUnread ? 'text-white' : 'text-slate-300'}`}>
                                {notif.title}
                              </h4>
                              {isUnread && <span className="w-2 h-2 bg-blue-400 rounded-full flex-shrink-0" />}
                            </div>
                            <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{notif.description}</p>
                            <div className="flex items-center gap-2 mt-1.5 text-[11px] text-slate-500">
                              <span className={`px-1.5 py-0.5 rounded border ${
                                notif.severity === 'critical' ? 'text-red-400 border-red-500/20 bg-red-500/10' :
                                'text-orange-400 border-orange-500/20 bg-orange-500/10'
                              }`}>
                                {notif.severity}
                              </span>
                              {notif.area && <span>{notif.area}</span>}
                              <span>{formatRelativeTime(notif.timestamp)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Topbar;
