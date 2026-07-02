import { AlertOctagon } from 'lucide-react';

const ErrorState = ({ message = 'Something went wrong.', onRetry }) => {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-slate-400 bg-navy-800 rounded-xl border border-red-500/20">
      <AlertOctagon className="w-10 h-10 text-red-400 mb-4" />
      <p className="text-red-300 font-medium">{message}</p>
      {onRetry && (
        <button 
          onClick={onRetry}
          className="mt-4 px-4 py-2 bg-navy-700 hover:bg-navy-600 rounded-lg text-sm font-medium transition-colors border border-navy-600"
        >
          Retry Request
        </button>
      )}
    </div>
  );
};

export default ErrorState;
