import { useEffect, useRef, useState } from 'react';
import {
  Building2,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import {
  Navigate,
  useNavigate,
  useSearchParams,
} from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const GIS_SCRIPT_ID = 'google-identity-services';
const GOOGLE_BUTTON_WIDTH = 400;

const hiddenGoogleButtonStyle = {
  position: 'absolute',
  left: '-9999px',
  top: '0',
  width: `${GOOGLE_BUTTON_WIDTH}px`,
  height: '48px',
  opacity: 0,
  pointerEvents: 'auto',
  overflow: 'hidden',
};

const maskClientId = (value) => {
  if (!value) return 'missing';
  if (value.length <= 14) return 'configured';
  return `${value.slice(0, 6)}...${value.slice(-8)}`;
};

const oauthLog = (message, detail = {}) => {
  console.info('[CityMind OAuth]', message, detail);
};

const oauthWarn = (message, detail = {}) => {
  console.warn('[CityMind OAuth]', message, detail);
};


const objectives = [
  { title: 'Risk Prioritization', detail: 'Deterministic intelligence ranks city risk zones.' },
  { title: 'Traffic-Aware Response', detail: 'Emergency decisions include live route context.' },
  { title: 'Evidence Verification', detail: 'Trusted sources and eyewitness reports support incidents.' },
  { title: 'Human-Approved Dispatch', detail: 'Resources, hospitals, and dispatch stay approval-led.' },
  { title: 'Safe AI Explanations', detail: 'Gemini and Google ADK explain recommendations clearly.' },
];

const Login = () => {
  const loginModeRef = useRef('admin');
  const userGoogleButtonRef = useRef(null);
  const adminGoogleButtonRef = useRef(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const {
    authenticated,
    loading: sessionLoading,
    loginWithCredential,
  } = useAuth();

  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [retryKey, setRetryKey] = useState(0);
  const [selectedMode, setSelectedMode] = useState(null);

  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  useEffect(() => {
    let active = true;

    if (!clientId) {
      oauthWarn('missing client id', { origin: window.location.origin });
      setStatus('error');
      setError('Google authentication is not configured: VITE_GOOGLE_CLIENT_ID is missing from this frontend build.');
      return undefined;
    }

    const renderGoogleButton = () => {
      if (!active || !window.google?.accounts?.id) {
        return;
      }

      oauthLog('initializing Google Identity Services', {
        clientId: maskClientId(clientId),
        origin: window.location.origin,
      });

      try {
        window.google.accounts.id.initialize({
          client_id: clientId,
          auto_select: false,
          cancel_on_tap_outside: true,

          callback: async (credentialResponse) => {
            if (!credentialResponse?.credential) {
              oauthWarn('credential callback missing ID token', {
                mode: loginModeRef.current,
                origin: window.location.origin,
              });
              setStatus('error');
              setError(
                'Google did not return a usable identity credential. Check browser popup/cookie settings and the OAuth client origin.',
              );
              return;
            }

            setSelectedMode(loginModeRef.current);
            setStatus('authenticating');
            setError('');
            oauthLog(`credential received for mode: ${loginModeRef.current}`, {
              mode: loginModeRef.current,
              origin: window.location.origin,
            });

            try {
              const user = await loginWithCredential(
                credentialResponse.credential,
              );

              oauthLog('backend authentication succeeded', {
                mode: loginModeRef.current,
                role: user?.role,
                department: user?.department,
              });

              const destination =
                loginModeRef.current === 'user'
                  ? '/user'
                  : '/';

              oauthLog('route selected after login', {
                mode: loginModeRef.current,
                destination,
              });

              navigate(destination, {
                replace: true,
              });
            } catch (authError) {
              const code = authError.response?.status;
              const detail = authError.response?.data?.detail;
              const message =
                typeof detail === 'object'
                  ? detail.message
                  : detail;

              oauthWarn('backend authentication failed', {
                status: code,
                detail,
                origin: window.location.origin,
              });

              setError(
                message || (code === 503
                  ? 'CityMind authentication is temporarily unavailable. Confirm GOOGLE_OAUTH_CLIENT_ID and CITYMIND_JWT_SECRET are configured on the backend.'
                  : 'Google sign-in was rejected by the backend. Confirm the frontend and backend use the same OAuth client ID.'),
              );

              setStatus('error');
            } finally {
              setSelectedMode(null);
            }
          },
        });


        setStatus('ready');
        oauthLog('Google Identity Services ready', {
          clientId: maskClientId(clientId),
          origin: window.location.origin,
        });
      } catch (oauthError) {
        oauthWarn('Google Identity Services initialization failed', oauthError);
        setStatus('error');
        setError(
          'Google sign-in could not be initialized. Confirm this exact origin is authorized in Google Cloud Console.',
        );
      }
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

          oauthWarn('Google Identity Services script failed to load', {
            clientId: maskClientId(clientId),
            origin: window.location.origin,
          });
          setStatus('error');
          setError(
            'Google sign-in could not be loaded. Check the network, browser blockers, and access to accounts.google.com.',
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
    navigate,
  ]);

  useEffect(() => {
    if (status !== 'ready' || !window.google?.accounts?.id) return;

    try {
      [
        { mode: 'user', ref: userGoogleButtonRef },
        { mode: 'admin', ref: adminGoogleButtonRef },
      ].forEach(({ mode, ref }) => {
        if (!ref.current) return;
        ref.current.replaceChildren();
        window.google.accounts.id.renderButton(ref.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'signin_with',
          shape: 'rectangular',
          logo_alignment: 'left',
          width: GOOGLE_BUTTON_WIDTH,
        });
        oauthLog('Google sign-in button rendered', { mode });
      });
    } catch (oauthError) {
      oauthWarn('Google sign-in button rendering failed', oauthError);
      setStatus('error');
      setError(
        'Google sign-in button could not be prepared. Confirm this origin is authorized in Google Cloud Console.',
      );
    }
  }, [status, retryKey]);

  if (!sessionLoading && authenticated) {
    return <Navigate to="/" replace />;
  }

  const reason = searchParams.get('reason');

  const busy =
    sessionLoading ||
    status === 'loading' ||
    status === 'authenticating';

  const findHiddenGoogleButton = (mode) => {
    const container = mode === 'user'
      ? userGoogleButtonRef.current
      : adminGoogleButtonRef.current;

    return container?.querySelector('div[role="button"], button, iframe') || null;
  };

  const startGoogleLogin = (mode) => {
    loginModeRef.current = mode;
    setError('');
    oauthLog(`${mode} login clicked`, {
      mode,
      clientId: maskClientId(clientId),
      clientIdPresent: Boolean(clientId),
      gisReady: Boolean(window.google?.accounts?.id) && status === 'ready',
      origin: window.location.origin,
    });
    oauthLog('selected login mode', { mode });

    if (status !== 'ready' || !window.google?.accounts?.id) {
      oauthWarn('GIS not ready during visible login click', {
        mode,
        status,
        clientIdPresent: Boolean(clientId),
        origin: window.location.origin,
      });
      setStatus(status === 'error' ? 'error' : 'loading');
      setError('Google sign-in is still loading. Please retry in a moment.');
      return;
    }

    const googleButton = findHiddenGoogleButton(mode);

    if (!googleButton) {
      oauthWarn('hidden GIS button not found', {
        mode,
        origin: window.location.origin,
      });
      setStatus('error');
      setError('Google sign-in button could not be initialized. Please refresh and retry.');
      return;
    }

    setSelectedMode(mode);
    oauthLog('GIS button found, forwarding click', {
      mode,
      tagName: googleButton.tagName,
    });

    try {
      googleButton.click();
      oauthLog('hidden GIS button click attempted', { mode });
      window.setTimeout(() => {
        setSelectedMode((current) => (current === mode ? null : current));
      }, 1000);
    } catch (oauthError) {
      oauthWarn('hidden GIS button click failed', { mode, error: oauthError });
      setSelectedMode(null);
      setStatus('error');
      setError('Google sign-in button could not be initialized. Please refresh and retry.');
    }
  };

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

              <div className="mt-7 flex min-h-12 flex-col gap-3" aria-label="Sign in with Google" aria-busy={busy}>
                {busy && (
                  <div className="flex items-center justify-center gap-2 text-sm text-slate-400">
                    <LoaderCircle className="h-5 w-5 animate-spin" />
                    {status === 'authenticating' ? 'Verifying with CityMind...' : 'Loading secure sign-in...'}
                  </div>
                )}

                {!busy && (
                  <>
                    <button
                      type="button"
                      onClick={() => startGoogleLogin('user')}
                      disabled={Boolean(selectedMode)}
                      className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-cyan-200/15 bg-cyan-400/10 px-4 py-3 text-sm font-semibold text-cyan-50 transition hover:border-cyan-200/35 hover:bg-cyan-300/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60 disabled:cursor-not-allowed disabled:opacity-70"
                      aria-label="User Login with Google"
                    >
                      {selectedMode === 'user' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <UserRound className="h-4 w-4" />}
                      User Login
                    </button>
                    <button
                      type="button"
                      onClick={() => startGoogleLogin('admin')}
                      disabled={Boolean(selectedMode)}
                      className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-blue-300/20 bg-blue-500/15 px-4 py-3 text-sm font-semibold text-blue-50 transition hover:border-blue-200/40 hover:bg-blue-400/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300/60 disabled:cursor-not-allowed disabled:opacity-70"
                      aria-label="Admin Login with Google"
                    >
                      {selectedMode === 'admin' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Building2 className="h-4 w-4" />}
                      Admin Login
                    </button>
                  </>
                )}
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

      <div aria-hidden="true" style={hiddenGoogleButtonStyle}>
        <div ref={userGoogleButtonRef} />
      </div>
      <div aria-hidden="true" style={hiddenGoogleButtonStyle}>
        <div ref={adminGoogleButtonRef} />
      </div>

      <footer className="login-bar-glow relative z-20 flex h-9 w-full items-center justify-center border-t border-cyan-200/12 bg-[#07182c]/90 px-4 text-center text-[11px] font-medium tracking-[0.08em] text-cyan-100/80 backdrop-blur-xl">
        @ Copyright All Rights Reserved 2026, Yukta
      </footer>
    </main>
  );
};

export default Login;
