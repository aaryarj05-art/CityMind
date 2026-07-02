import { Loader2 } from 'lucide-react';

const LoadingState = ({ message = 'Loading data...' }) => {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-slate-400">
      <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-4" />
      <p>{message}</p>
    </div>
  );
};

export default LoadingState;
