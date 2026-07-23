import { AlertOctagon } from 'lucide-react';

const ErrorState = ({ message = 'Something went wrong.', onRetry }) => {
  return (
    <div className="glass-panel flex h-64 flex-col items-center justify-center border-red-500/20 text-slate-400">
      <AlertOctagon className="mb-4 h-10 w-10 text-red-400" />
      <p className="font-medium text-red-300">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="cm-button mt-4">
          Retry Request
        </button>
      )}
    </div>
  );
};

export default ErrorState;