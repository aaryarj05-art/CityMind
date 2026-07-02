import { Shield, Truck, Siren } from 'lucide-react';

const ResourceSummary = ({ summary = {} }) => {
  const resources = [
    { key: 'ambulances', label: 'Ambulances', icon: Siren, color: 'text-red-400', bg: 'bg-red-400/10' },
    { key: 'police', label: 'Police Units', icon: Shield, color: 'text-blue-400', bg: 'bg-blue-400/10' },
    { key: 'fire', label: 'Fire Engines', icon: Truck, color: 'text-orange-400', bg: 'bg-orange-400/10' },
  ];

  return (
    <div className="bg-navy-800 border border-navy-700 rounded-xl p-5">
      <h3 className="font-semibold text-white mb-4">Emergency Resources</h3>
      <div className="space-y-4">
        {resources.map((res) => {
          const data = summary[res.key] || { total: 0, available: 0 };
          const percent = data.total ? Math.round((data.available / data.total) * 100) : 0;
          
          return (
            <div key={res.key}>
              <div className="flex justify-between items-center mb-2 text-sm text-slate-300">
                <div className="flex items-center space-x-2">
                  <div className={`p-1.5 rounded-md ${res.bg} ${res.color}`}>
                    <res.icon className="w-4 h-4" />
                  </div>
                  <span>{res.label}</span>
                </div>
                <span>{data.available} / {data.total} Available</span>
              </div>
              <div className="w-full bg-navy-900 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full ${res.color.replace('text-', 'bg-')}`}
                  style={{ width: `${percent}%` }}
                ></div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  );
};

export default ResourceSummary;
