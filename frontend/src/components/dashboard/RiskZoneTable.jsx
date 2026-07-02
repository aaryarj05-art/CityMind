import StatusBadge from '../common/StatusBadge';

const RiskZoneTable = ({ zones = [] }) => {
  return (
    <div className="bg-navy-800 border border-navy-700 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-navy-900/50 text-slate-400 uppercase text-xs">
            <tr>
              <th className="px-6 py-4 font-medium">Area</th>
              <th className="px-6 py-4 font-medium">Score</th>
              <th className="px-6 py-4 font-medium">Status</th>
              <th className="px-6 py-4 font-medium">Main Issue</th>
              <th className="px-6 py-4 font-medium text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-navy-700/50">
            {zones.map((zone) => (
              <tr key={zone.id} className="hover:bg-navy-700/30 transition-colors">
                <td className="px-6 py-4">
                  <div className="font-medium text-white">{zone.name}</div>
                  <div className="text-xs text-slate-500">{zone.ward_number}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center">
                    <span className={`font-bold ${zone.operational_score > 80 ? 'text-red-400' : 'text-orange-400'}`}>
                      {zone.operational_score}
                    </span>
                    <span className="text-slate-500 ml-1">/100</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <StatusBadge status={zone.status} />
                </td>
                <td className="px-6 py-4 text-slate-300">
                  {zone.main_issue}
                </td>
                <td className="px-6 py-4 text-right">
                  <button className="text-blue-400 hover:text-blue-300 font-medium text-xs uppercase tracking-wider">
                    Details
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RiskZoneTable;
