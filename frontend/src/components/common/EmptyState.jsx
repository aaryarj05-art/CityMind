import { SearchX } from 'lucide-react';

const EmptyState = ({ message = 'No data available.' }) => {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-slate-500 bg-navy-800/50 rounded-xl border border-navy-700 border-dashed">
      <SearchX className="w-8 h-8 mb-3 opacity-50" />
      <p>{message}</p>
    </div>
  );
};

export default EmptyState;
