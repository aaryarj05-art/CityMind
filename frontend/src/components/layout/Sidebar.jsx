import { NavLink } from 'react-router-dom';
import { LayoutDashboard, AlertTriangle, Activity, Users, BarChart3, Settings } from 'lucide-react';

const Sidebar = () => {
  const navItems = [
    { name: 'Overview', path: '/', icon: LayoutDashboard },
    { name: 'Risk Zones', path: '/risk-zones', icon: AlertTriangle },
    { name: 'Incidents', path: '/incidents', icon: Activity },
    { name: 'Resources', path: '/resources', icon: Users },
    { name: 'Analytics', path: '/analytics', icon: BarChart3 },
    { name: 'Settings', path: '/settings', icon: Settings },
  ];

  return (
    <div className="w-64 bg-navy-800 h-screen border-r border-navy-700 flex flex-col fixed left-0 top-0 text-slate-300">
      <div className="p-6 border-b border-navy-700">
        <h1 className="text-2xl font-bold text-white tracking-wider">CityMind</h1>
        <p className="text-xs text-slate-400 mt-1 uppercase tracking-widest">Urban Decision Intelligence</p>
      </div>
      
      <nav className="flex-1 py-6">
        <ul className="space-y-2 px-4">
          {navItems.map((item) => (
            <li key={item.name}>
              <NavLink
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) =>
                  `flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive 
                      ? 'bg-blue-600/20 text-blue-400' 
                      : 'hover:bg-navy-700 hover:text-white'
                  }`
                }
              >
                <item.icon className="w-5 h-5" />
                <span className="font-medium">{item.name}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="p-4 border-t border-navy-700">
        <div className="flex items-center space-x-3 bg-navy-900 rounded-lg p-3">
          <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold">
            CO
          </div>
          <div>
            <div className="text-sm font-medium text-white">Control Room Officer</div>
            <div className="text-xs text-green-400 flex items-center mt-0.5">
              <span className="w-2 h-2 bg-green-400 rounded-full mr-1.5 animate-pulse"></span>
              Active
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
