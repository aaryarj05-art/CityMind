import { ArrowLeft, ShieldX } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const AccessDenied = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  return (
    <main className="min-h-screen bg-navy-950 flex items-center justify-center p-6">
      <section className="w-full max-w-lg rounded-2xl border border-red-500/20 bg-navy-800 p-8 text-center shadow-2xl" aria-labelledby="access-denied-title">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10"><ShieldX className="h-7 w-7 text-red-400" /></div>
        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.2em] text-red-300">403 · Permission required</p>
        <h1 id="access-denied-title" className="mt-2 text-2xl font-bold text-white">Access Denied</h1>
        <p className="mt-3 text-sm leading-6 text-slate-400">Your {user?.role || 'current'} role does not include permission for this CityMind workspace. Backend authorization remains authoritative.</p>
        <button type="button" onClick={() => navigate('/', { replace: true })} className="mt-6 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500"><ArrowLeft className="h-4 w-4" />Return to Overview</button>
      </section>
    </main>
  );
};

export default AccessDenied;