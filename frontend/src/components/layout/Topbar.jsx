import { Bell, MapPin, AlertTriangle, Siren, Activity, Rss, CheckCheck } from 'lucide-react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { dashboardAPI } from '../../services/api';

const Topbar = ({ title }) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [readIds, setReadIds] = useState(new Set());
  const dropdownRef = useRef(null);

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

  // Derive notifications from dashboard data
  const fetchNotifications = useCallback(async () => {
    try {
      const res = await dashboardAPI.getDashboardData();
      const data = res.data;
      const derived = [];
      let notifId = 1;

      // Critical zone alerts
      if (data.priority_zones) {
        data.priority_zones.forEach(zone => {
          if (zone.status === 'Critical') {
            derived.push({
              id: notifId++,
              title: 'Critical Zone Alert',
              description: `${zone.name} has reached critical operational score (${zone.operational_score}/100).`,
              severity: 'critical',
              area: zone.name,
              timestamp: zone.last_updated || new Date().toISOString(),
              icon: 'zone',
            });
          }
        });
      }

      // High-severity active incidents
      if (data.recent_incidents) {
        data.recent_incidents.forEach(inc => {
          if (inc.severity === 'Critical' || inc.severity === 'High') {
            derived.push({
              id: notifId++,
              title: `${inc.severity} Incident`,
              description: `${inc.title} — ${inc.responding_department} responding.`,
              severity: inc.severity === 'Critical' ? 'critical' : 'high',
              area: `Area ${inc.area_id}`,
              timestamp: inc.reported_at,
              icon: 'incident',
            });
          }
        });
      }

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
