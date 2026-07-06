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
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-navy-950 p-4 sm:p-8">
      <div
        className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.18),transparent_36%),radial-gradient(circle_at_bottom_right,rgba(139,92,246,0.12),transparent_40%)]"
        aria-hidden="true"
      />

      <section
        className="relative w-full max-w-md rounded-2xl border border-navy-700 bg-navy-900/95 p-6 shadow-2xl sm:p-9"
        aria-labelledby="login-title"
      >
        {/* CityMind logo */}
        <div className="flex justify-center">
          <img
            src="/citymind-logo.png"
            alt="CityMind"
            className="max-h-28 w-auto max-w-full object-contain"
          />
        </div>

        <div className="mt-8">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-300">
            Verified personnel access
          </p>

          <h1
            id="login-title"
            className="mt-2 text-3xl font-bold leading-tight text-white"
          >
            Sign in to the command center
          </h1>

          <p className="mt-3 text-sm leading-6 text-slate-400">
            Sign in using your Google identity.
            CityMind securely verifies the credential
            through the backend before granting access
            to the demonstration environment.
          </p>
        </div>

        {(reason === 'session' ||
          reason === 'expired') && (
          <div
            className="mt-5 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-200"
            role="status"
          >
            Your CityMind session expired or is no
            longer valid. Please sign in again.
          </div>
        )}

        {error && (
          <div
            className="mt-5 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-200"
            role="alert"
          >
            {error}
          </div>
        )}

        <div
          className="mt-7 flex min-h-12 justify-center"
          aria-label="Sign in with Google button"
          aria-busy={busy}
        >
          {busy && (
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <LoaderCircle className="h-5 w-5 animate-spin" />

              {status === 'authenticating'
                ? 'Verifying with CityMind…'
                : 'Loading secure sign-in…'}
            </div>
          )}

          <div
            ref={buttonRef}
            className={busy ? 'hidden' : ''}
          />
        </div>

        {status === 'error' && (
          <button
            type="button"
            onClick={() => {
              setStatus('loading');
              setError('');
              setRetryKey((value) => value + 1);
            }}
            className="mx-auto mt-3 flex items-center gap-2 rounded-lg border border-navy-600 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:bg-navy-800"
          >
            <RefreshCw className="h-4 w-4" />
            Retry sign-in setup
          </button>
        )}

        <div className="mt-8 flex gap-3 rounded-xl border border-emerald-500/15 bg-emerald-500/5 p-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />

          <p className="text-[11px] leading-5 text-slate-400">
            Authentication only: no Google API access
            scopes are requested. The Google credential
            is exchanged once and is never retained in
            browser storage.
          </p>
        </div>

        <p className="mt-5 text-center text-[10px] leading-4 text-slate-600">
          CityMind hackathon prototype · Human approval
          remains required for operational actions
        </p>
      </section>
    </main>
  );
};

export default Login;