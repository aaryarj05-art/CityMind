import { useEffect, useRef, useState } from 'react';
import {
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import {
  Navigate,
  useLocation,
  useNavigate,
  useSearchParams,
} from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const GIS_SCRIPT_ID = 'google-identity-services';

const objectives = [
  { title: 'Risk Prioritization', detail: 'Deterministic intelligence ranks city risk zones.' },
  { title: 'Traffic-Aware Response', detail: 'Emergency decisions include live route context.' },
  { title: 'Evidence Verification', detail: 'Trusted sources and eyewitness reports support incidents.' },
  { title: 'Human-Approved Dispatch', detail: 'Resources, hospitals, and dispatch stay approval-led.' },
  { title: 'Safe AI Explanations', detail: 'Gemini and Google ADK explain recommendations clearly.' },
];

const Login = () => {
  const buttonRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const {
    authenticated,
    loading: sessionLoading,
    loginWithCredential,
  } = useAuth();

  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [retryKey, setRetryKey] = useState(0);

  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  useEffect(() => {
    let active = true;

    if (!clientId) {
      setStatus('error');
      setError('Google authentication is not configured for this browser.');
      return undefined;
    }

    const renderGoogleButton = () => {
      if (
        !active ||
        !window.google?.accounts?.id ||
        !buttonRef.current
      ) {
        return;
      }

      buttonRef.current.replaceChildren();

      window.google.accounts.id.initialize({
        client_id: clientId,
        auto_select: false,
        cancel_on_tap_outside: true,

        callback: async (credentialResponse) => {
          if (!credentialResponse?.credential) {
            setStatus('error');
            setError(
              'Google did not return a usable identity credential.',
            );
            return;
          }

          setStatus('authenticating');
          setError('');

          try {
            await loginWithCredential(
              credentialResponse.credential,
            );

            const destination = location.state?.from || '/';

            navigate(destination, {
              replace: true,
            });
          } catch (authError) {
            const code = authError.response?.status;

            setError(
              code === 503
                ? 'CityMind authentication is temporarily unavailable. Please retry.'
                : 'Sign-in could not be verified. Please use a valid Google account and retry.',
            );

            setStatus('error');
          }
        },
      });

      window.google.accounts.id.renderButton(
        buttonRef.current,
        {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'signin_with',
          shape: 'rectangular',
          logo_alignment: 'left',
          width: 320,
        },
      );

      setStatus('ready');
    };

    if (window.google?.accounts?.id) {
      renderGoogleButton();
    } else {
      let script = document.getElementById(
        GIS_SCRIPT_ID,
      );

      if (!script) {
        script = document.createElement('script');
        script.id = GIS_SCRIPT_ID;
        script.src =
          'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      }

      script.addEventListener(
        'load',
        renderGoogleButton,
        { once: true },
      );

      script.addEventListener(
        'error',
        () => {
          if (!active) return;

          setStatus('error');
          setError(
            'Google sign-in could not be loaded. Check the network and retry.',
          );
        },
        { once: true },
      );
    }

    return () => {
      active = false;
    };
  }, [
    clientId,
    retryKey,
    loginWithCredential,
    location.state,
    navigate,
  ]);

  if (!sessionLoading && authenticated) {
    return <Navigate to="/" replace />;
  }

  const reason = searchParams.get('reason');

  const busy =
    sessionLoading ||
    status === 'loading' ||
    status === 'authenticating';

  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-[#030811] text-slate-100">
      <style>{`
        @keyframes login-logo-float { 0%, 100% { transform: translateY(0); filter: drop-shadow(0 20px 45px rgba(34, 211, 238, 0.10)); } 50% { transform: translateY(-7px); filter: drop-shadow(0 24px 55px rgba(34, 211, 238, 0.18)); } }
        @keyframes login-card-in { from { opacity: 0; transform: translateX(18px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes login-objective-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes login-bar-glow { 0%, 100% { box-shadow: 0 -10px 28px rgba(14, 165, 233, 0.10); } 50% { box-shadow: 0 -10px 34px rgba(56, 189, 248, 0.18); } }
        .login-logo-float { animation: login-logo-float 5.5s ease-in-out infinite; }
        .login-card-in { animation: login-card-in 320ms ease-out both; }
        .login-objective-in { animation: login-objective-in 260ms ease-out both; }
        .login-bar-glow { animation: login-bar-glow 3s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .login-logo-float, .login-card-in, .login-objective-in, .login-bar-glow { animation: none !important; } }
      `}</style>

      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_22%_12%,rgba(56,189,248,0.15),transparent_30rem),radial-gradient(circle_at_78%_32%,rgba(29,78,216,0.16),transparent_28rem),linear-gradient(135deg,rgba(255,255,255,0.035),transparent_42%)]"
        aria-hidden="true"
      />

      <div className="relative z-10 grid min-h-[calc(100vh-2.25rem)] flex-1 grid-cols-1 lg:grid-cols-[70fr_30fr]">
        <section className="flex min-h-[55vh] flex-col items-center justify-center border-b border-cyan-300/10 bg-[#030914]/95 px-5 py-10 sm:px-8 lg:min-h-0 lg:border-b-0 lg:border-r lg:px-12 lg:py-12">
          <div className="mx-auto flex w-full max-w-2xl flex-col items-center">
            <div className="login-logo-float relative w-full max-w-[28rem] rounded-[1.75rem] border border-cyan-100/80 bg-[#fefefe] px-6 py-6 shadow-2xl shadow-cyan-950/25 sm:px-10 sm:py-8">
              <div className="absolute -inset-px rounded-[1.75rem] shadow-[0_0_38px_rgba(34,211,238,0.18)]" aria-hidden="true" />
              <img
                src="/citymind-logo.png"
                alt="CityMind command intelligence platform"
                className="relative mx-auto max-h-36 w-auto max-w-full object-contain"
              />
            </div>

            <div className="mt-10 text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200/70">
                Urban intelligence command layer
              </p>
              <h1 className="mt-3 text-3xl font-bold leading-tight text-white sm:text-4xl">
                Smarter city decisions, verified before action.
              </h1>
            </div>

            <ol className="mt-8 grid w-full gap-3" aria-label="CityMind objectives">
              {objectives.map((objective, index) => (
                <li
                  key={objective.title}
                  className="login-objective-in rounded-xl border border-cyan-200/10 bg-white/[0.035] px-4 py-3 shadow-lg shadow-black/10 backdrop-blur-md"
                  style={{ animationDelay: `${120 + index * 45}ms` }}
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-cyan-200/15 bg-cyan-300/10 text-[11px] font-bold text-cyan-100">
                      {index + 1}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-white">{objective.title}</p>
                      <p className="mt-0.5 text-xs leading-5 text-slate-400">{objective.detail}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="flex items-center justify-center bg-[#07182c]/95 px-5 py-10 sm:px-8 lg:px-12">
          <div
            className="login-card-in relative w-full max-w-md rounded-[1.5rem] border border-cyan-200/14 bg-navy-900/72 p-6 shadow-2xl shadow-blue-950/40 backdrop-blur-2xl sm:p-9"
            aria-labelledby="login-title"
          >
            <div className="pointer-events-none absolute inset-0 rounded-[1.5rem] bg-[linear-gradient(145deg,rgba(56,189,248,0.10),rgba(15,23,42,0.10)_42%,rgba(59,130,246,0.08))]" aria-hidden="true" />
            <div className="pointer-events-none absolute -inset-px rounded-[1.5rem] shadow-[0_0_38px_rgba(14,165,233,0.10)]" aria-hidden="true" />

            <div className="relative">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-300">Verified personnel access</p>
              <h2 id="login-title" className="mt-2 text-3xl font-bold leading-tight text-white">Sign in to the command center</h2>
              <p className="mt-3 text-sm leading-6 text-slate-400">Sign in using your Google identity. CityMind securely verifies the credential through the backend before granting access to the demonstration environment.</p>

              {(reason === 'session' || reason === 'expired') && (
                <div className="mt-5 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-200" role="status">
                  Your CityMind session expired or is no longer valid. Please sign in again.
                </div>
              )}

              {error && (
                <div className="mt-5 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-200" role="alert">
                  {error}
                </div>
              )}

              <div className="mt-7 flex min-h-12 justify-center" aria-label="Sign in with Google button" aria-busy={busy}>
                {busy && (
                  <div className="flex items-center gap-2 text-sm text-slate-400">
                    <LoaderCircle className="h-5 w-5 animate-spin" />
                    {status === 'authenticating' ? 'Verifying with CityMind...' : 'Loading secure sign-in...'}
                  </div>
                )}

                <div ref={buttonRef} className={busy ? 'hidden' : ''} />
              </div>

              {status === 'error' && (
                <button
                  type="button"
                  onClick={() => {
                    setStatus('loading');
                    setError('');
                    setRetryKey((value) => value + 1);
                  }}
                  className="mx-auto mt-3 flex items-center gap-2 rounded-lg border border-cyan-200/15 bg-navy-950/35 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-cyan-300/30 hover:bg-cyan-400/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60"
                >
                  <RefreshCw className="h-4 w-4" />
                  Retry sign-in setup
                </button>
              )}

              <div className="mt-8 flex gap-3 rounded-xl border border-emerald-500/15 bg-emerald-500/5 p-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
                <p className="text-[11px] leading-5 text-slate-400">Authentication only: no Google API access scopes are requested. The Google credential is exchanged once and is never retained in browser storage.</p>
              </div>

              <p className="mt-5 text-center text-[10px] leading-4 text-slate-500">CityMind · Human approval remains required for operational actions</p>
            </div>
          </div>
        </section>
      </div>

      <footer className="login-bar-glow relative z-20 flex h-9 w-full items-center justify-center border-t border-cyan-200/12 bg-[#07182c]/90 px-4 text-center text-[11px] font-medium tracking-[0.08em] text-cyan-100/80 backdrop-blur-xl">
        @ Copyright All Rights Reserved 2026, Yukta
      </footer>
    </main>
  );
};

export default Login;
