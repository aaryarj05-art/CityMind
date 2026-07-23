import { SearchX } from 'lucide-react';

const EmptyState = ({ message = 'No data available.' }) => {
  return (
    <div className="glass-panel-subtle flex h-64 flex-col items-center justify-center border-dashed text-slate-500">
      <SearchX className="mb-3 h-8 w-8 opacity-50" />
      <p className="text-sm">{message}</p>
    </div>
  );
};

export default EmptyState;