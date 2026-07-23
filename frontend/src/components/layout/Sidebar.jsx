import { NavLink } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  BadgeCheck,
  BarChart3,
  LayoutDashboard,
  LogOut,
  MapPinned,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';

const Sidebar = () => {
  const { user, hasPermission, logout } = useAuth();

  const navItems = [
    {
      name: 'Overview',
      path: '/',
      icon: LayoutDashboard,
      permission: 'dashboard.read',
    },
    {
      name: 'AI Command Center',
      path: '/ai-command-center',
      icon: Sparkles,
      permission: 'ai.query',
    },
    {
      name: 'Risk Zones',
      path: '/risk-zones',
      icon: AlertTriangle,
      permission: 'risk.read',
    },
    {
      name: 'Incidents',
      path: '/incidents',
      icon: Activity,
      permission: 'incidents.read',
    },
    {
      name: 'Live Response',
      path: '/live-response',
      icon: MapPinned,
      permission: 'traffic.read',
    },
    {
      name: 'Dispatches',
      path: '/dispatches',
      icon: Send,
      permission: 'dispatch.read',
    },
    {
      name: 'Resources',
      path: '/resources',
      icon: Users,
      permission: 'resources.read',
    },
    {
      name: 'Analytics',
      path: '/analytics',
      icon: BarChart3,
      permission: 'analytics.read',
    },
    {
      name: 'Security Operations',
      path: '/security-operations',
      icon: ShieldCheck,
      permission: 'audit.read',
    },
    {
      name: 'Settings',
      path: '/settings',
      icon: Settings,
      permission: 'settings.manage',
    },
  ].filter((item) => hasPermission(item.permission));

  const initials =
    user?.name
      ?.split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase() || 'CM';

  return (
    <aside className="fixed left-0 top-0 z-30 flex h-screen w-20 flex-col border-r border-blue-300/10 bg-navy-950/70 text-slate-300 shadow-2xl shadow-black/30 backdrop-blur-xl lg:w-64">
      {/* CityMind branding */}
      <div className="flex min-h-[88px] items-center justify-center border-b border-blue-300/10 px-3 lg:min-h-[104px] lg:px-5">
        {/* Compact logo for collapsed sidebar */}
        <img
          src="/citymind-icon.png"
          alt="CityMind"
          className="h-11 w-11 rounded-xl object-contain lg:hidden"
        />

        {/* Full logo for desktop sidebar */}
        <img
          src="/citymind-logo.png"
          alt="CityMind"
          className="hidden max-h-16 w-full max-w-[205px] object-contain lg:block"
        />
      </div>

      <nav
        className="flex-1 overflow-y-auto py-5"
        aria-label="Authorized CityMind navigation"
      >
        <ul className="space-y-2 px-3 lg:px-4">
          {navItems.map((item) => (
            <li key={item.name}>
              <NavLink
                to={item.path}
                end={item.path === '/'}
                title={item.name}
                className={({ isActive }) =>
                  `flex items-center justify-center rounded-xl px-3 py-3 transition-all duration-200 focus-visible:ring-cyan-400/50 lg:justify-start lg:space-x-3 lg:px-4 ${
                    isActive
                      ? 'border border-cyan-300/20 bg-blue-500/15 text-cyan-100 shadow-lg shadow-blue-950/25'
                      : 'border border-transparent hover:-translate-y-0.5 hover:border-blue-300/15 hover:bg-navy-800/70 hover:text-white'
                  }`
                }
              >
                <item.icon className="h-5 w-5 shrink-0" />
                <span className="hidden font-medium lg:inline">
                  {item.name}
                </span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="border-t border-blue-300/10 p-2 lg:p-4">
        <div className="glass-panel-subtle p-2 lg:p-3">
          <div className="flex items-center justify-center lg:justify-start lg:gap-3">
            {user?.picture_url ? (
              <img
                src={user.picture_url}
                alt={user?.name || 'CityMind user'}
                referrerPolicy="no-referrer"
                className="h-10 w-10 rounded-full border border-navy-600 object-cover"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/20 text-sm font-bold text-blue-300">
                {initials}
              </div>
            )}

            <div className="hidden min-w-0 flex-1 lg:block">
              <div className="truncate text-sm font-medium text-white">
                {user?.name}
              </div>

              <div className="truncate text-[11px] text-blue-300">
                {user?.role}
                {user?.department ? ` · ${user.department}` : ''}
              </div>

              <div className="mt-0.5 flex items-center gap-1 text-[10px] text-emerald-400">
                <BadgeCheck className="h-3 w-3" />
                Google Verified
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={logout}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg px-2 py-2 text-xs text-slate-400 transition-colors hover:bg-red-500/10 hover:text-red-300 focus-visible:ring-red-400/40 lg:justify-start"
            aria-label="Log out of CityMind"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden lg:inline">Log out</span>
          </button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;