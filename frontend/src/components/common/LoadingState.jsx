import { Loader2 } from 'lucide-react';

const LoadingState = ({ message = 'Loading data...' }) => {
  return (
    <div className="glass-panel flex h-64 flex-col items-center justify-center text-slate-400">
      <Loader2 className="mb-4 h-8 w-8 animate-spin text-cyan-300" />
      <p className="text-sm">{message}</p>
    </div>
  );
};

export default LoadingState;