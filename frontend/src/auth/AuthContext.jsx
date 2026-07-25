import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { authAPI } from '../services/api';
import {
  clearSession,
  getAccessToken,
  getStoredExpiry,
  getStoredUser,
  storeSession,
  updateStoredUser,
} from './authStorage';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(getStoredUser);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(Boolean(getAccessToken()));
  const [expiry, setExpiry] = useState(getStoredExpiry);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [accessDenied, setAccessDenied] = useState('');
  const [judgeMode, setJudgeMode] = useState(false);
  const [loginMode, setLoginMode] = useState(getStoredUser()?.login_mode || 'user');

  const clearLocalAuth = useCallback(() => {
    clearSession();
    setUser(null);
    setPermissions([]);
    setExpiry(0);
    setRemainingSeconds(0);
    setJudgeMode(false);
    setLoginMode('user');
  }, []);

  const verifySession = useCallback(async () => {
    if (!getAccessToken()) {
      clearLocalAuth();
      setLoading(false);
      return false;
    }
    setLoading(true);
    try {
      const [meResponse, statusResponse] = await Promise.all([authAPI.me(), authAPI.sessionStatus()]);
      const nextLoginMode = statusResponse.data.login_mode || meResponse.data.login_mode || meResponse.data.user?.login_mode || 'user';
      const nextUser = { ...meResponse.data.user, login_mode: nextLoginMode };
      setUser(nextUser);
      setLoginMode(nextLoginMode);
      setPermissions(meResponse.data.permissions || []);
      setExpiry(statusResponse.data.expiry || 0);
      setRemainingSeconds(statusResponse.data.remaining_seconds || 0);
      setJudgeMode(Boolean(statusResponse.data.judge_mode || meResponse.data.judge_mode));
      updateStoredUser(nextUser);
      sessionStorage.setItem('citymind_session_expiry', String(statusResponse.data.expiry || 0));
      return true;
    } catch {
      clearLocalAuth();
      return false;
    } finally {
      setLoading(false);
    }
  }, [clearLocalAuth]);

  useEffect(() => { verifySession(); }, [verifySession]);

  useEffect(() => {
    const handleCleared = () => clearLocalAuth();
    const handleDenied = (event) => setAccessDenied(event.detail || 'Access denied.');
    const handleDeniedClear = () => setAccessDenied('');
    window.addEventListener('citymind-auth-cleared', handleCleared);
    window.addEventListener('citymind-access-denied', handleDenied);
    window.addEventListener('citymind-access-denied-clear', handleDeniedClear);
    return () => {
      window.removeEventListener('citymind-auth-cleared', handleCleared);
      window.removeEventListener('citymind-access-denied', handleDenied);
      window.removeEventListener('citymind-access-denied-clear', handleDeniedClear);
    };
  }, [clearLocalAuth]);

  useEffect(() => {
    if (!expiry) return undefined;
    const update = () => {
      const remaining = Math.max(0, expiry - Math.floor(Date.now() / 1000));
      setRemainingSeconds(remaining);
      if (remaining === 0) {
        clearLocalAuth();
        navigate('/login?reason=expired', { replace: true });
      }
    };
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [expiry, clearLocalAuth, navigate]);

  const loginWithCredential = useCallback(async (credential, loginMode = 'user') => {
    const response = await authAPI.google(credential, loginMode);
    const expiresAt = Math.floor(Date.now() / 1000) + response.data.expires_in;
    const sessionLoginMode = response.data.login_mode || loginMode;
    const sessionUser = { ...response.data.user, login_mode: sessionLoginMode };
    storeSession({ accessToken: response.data.access_token, user: sessionUser, expiry: expiresAt });
    setUser(sessionUser);
    setLoginMode(sessionLoginMode);
    setExpiry(expiresAt);
    const verified = await verifySession();
    if (!verified) throw new Error('Session verification failed');
    return sessionUser;
  }, [verifySession]);

  const logout = useCallback(async () => {
    try {
      if (getAccessToken()) await authAPI.logout();
    } finally {
      clearLocalAuth();
      navigate('/login', { replace: true });
    }
  }, [clearLocalAuth, navigate]);

  const hasPermission = useCallback(
    (permission) => permissions.includes(permission),
    [permissions],
  );

  const value = useMemo(() => ({
    user,
    permissions,
    loading,
    authenticated: Boolean(user && getAccessToken()),
    remainingSeconds,
    sessionExpiring: remainingSeconds > 0 && remainingSeconds <= 120,
    judgeMode,
    loginMode,
    loginWithCredential,
    logout,
    hasPermission,
    verifySession,
  }), [user, permissions, loading, remainingSeconds, judgeMode, loginMode, loginWithCredential, logout, hasPermission, verifySession]);

  return (
    <AuthContext.Provider value={value}>
      {children}
      {accessDenied && (
        <div className="fixed right-4 bottom-4 z-[100] max-w-sm rounded-lg border border-red-500/30 bg-navy-800 px-4 py-3 shadow-2xl" role="alert">
          <div className="flex items-start gap-3">
            <p className="flex-1 text-sm text-red-200">{accessDenied}</p>
            <button type="button" className="text-xs text-slate-400 hover:text-white" onClick={() => setAccessDenied('')} aria-label="Dismiss access denied message">Dismiss</button>
          </div>
        </div>
      )}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
};
