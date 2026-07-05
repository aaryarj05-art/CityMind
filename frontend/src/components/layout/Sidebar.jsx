import { NavLink } from 'react-router-dom';
import { Activity, AlertTriangle, BadgeCheck, BarChart3, LayoutDashboard, LogOut, MapPinned, Send, Settings, Sparkles, Users } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';

const Sidebar = () => {
  const { user, hasPermission, logout } = useAuth();
  const navItems = [
    { name: 'Overview', path: '/', icon: LayoutDashboard, permission: 'dashboard.read' },
    { name: 'AI Command Center', path: '/ai-command-center', icon: Sparkles, permission: 'ai.query' },
    { name: 'Risk Zones', path: '/risk-zones', icon: AlertTriangle, permission: 'risk.read' },
    { name: 'Incidents', path: '/incidents', icon: Activity, permission: 'incidents.read' },
    { name: 'Live Response', path: '/live-response', icon: MapPinned, permission: 'traffic.read' },
    { name: 'Dispatches', path: '/dispatches', icon: Send, permission: 'dispatch.read' },
    { name: 'Resources', path: '/resources', icon: Users, permission: 'resources.read' },
    { name: 'Analytics', path: '/analytics', icon: BarChart3, permission: 'analytics.read' },
    { name: 'Settings', path: '/settings', icon: Settings, permission: 'settings.manage' },
  ].filter((item) => hasPermission(item.permission));

  const initials = user?.name?.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'CM';

  return (
    <aside className="w-20 lg:w-64 bg-navy-800 h-screen border-r border-navy-700 flex flex-col fixed left-0 top-0 z-30 text-slate-300">
      <div className="p-4 lg:p-6 border-b border-navy-700">
        <h1 className="text-lg lg:text-2xl font-bold text-white tracking-wider"><span className="lg:hidden">CM</span><span className="hidden lg:inline">CityMind</span></h1>
        <p className="hidden lg:block text-xs text-slate-400 mt-1 uppercase tracking-widest">Urban Decision Intelligence</p>
      </div>
      <nav className="flex-1 py-5 overflow-y-auto" aria-label="Authorized CityMind navigation">
        <ul className="space-y-2 px-3 lg:px-4">
          {navItems.map((item) => (
            <li key={item.name}>
              <NavLink to={item.path} end={item.path === '/'} title={item.name} className={({ isActive }) => `flex items-center justify-center lg:justify-start lg:space-x-3 px-3 lg:px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-blue-600/20 text-blue-400' : 'hover:bg-navy-700 hover:text-white'}`}>
                <item.icon className="w-5 h-5 shrink-0" />
                <span className="hidden lg:inline font-medium">{item.name}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <div className="p-2 lg:p-4 border-t border-navy-700">
        <div className="rounded-xl bg-navy-900 p-2 lg:p-3">
          <div className="flex items-center justify-center lg:justify-start lg:gap-3">
            {user?.picture_url ? <img src={user.picture_url} alt="" referrerPolicy="no-referrer" className="w-10 h-10 rounded-full object-cover border border-navy-600" /> : <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-300 font-bold text-sm">{initials}</div>}
            <div className="hidden lg:block min-w-0 flex-1">
              <div className="text-sm font-medium text-white truncate">{user?.name}</div>
              <div className="text-[11px] text-blue-300 truncate">{user?.role} · {user?.department}</div>
              <div className="text-[10px] text-emerald-400 flex items-center gap-1 mt-0.5"><BadgeCheck className="w-3 h-3" />Google Verified</div>
            </div>
          </div>
          <button type="button" onClick={logout} className="mt-2 w-full flex items-center justify-center lg:justify-start gap-2 rounded-lg px-2 py-2 text-xs text-slate-400 hover:bg-red-500/10 hover:text-red-300" aria-label="Log out of CityMind"><LogOut className="w-4 h-4" /><span className="hidden lg:inline">Log out</span></button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;