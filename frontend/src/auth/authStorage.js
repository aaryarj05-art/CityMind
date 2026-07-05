export const AUTH_TOKEN_KEY = 'citymind_access_token';
export const AUTH_USER_KEY = 'citymind_authenticated_user';
export const AUTH_EXPIRY_KEY = 'citymind_session_expiry';

export const getAccessToken = () => sessionStorage.getItem(AUTH_TOKEN_KEY);

export const getStoredUser = () => {
  try {
    return JSON.parse(sessionStorage.getItem(AUTH_USER_KEY) || 'null');
  } catch {
    return null;
  }
};

export const storeSession = ({ accessToken, user, expiry }) => {
  sessionStorage.setItem(AUTH_TOKEN_KEY, accessToken);
  sessionStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  if (expiry) sessionStorage.setItem(AUTH_EXPIRY_KEY, String(expiry));
};

export const updateStoredUser = (user) => {
  sessionStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
};

export const clearSession = () => {
  sessionStorage.removeItem(AUTH_TOKEN_KEY);
  sessionStorage.removeItem(AUTH_USER_KEY);
  sessionStorage.removeItem(AUTH_EXPIRY_KEY);
  sessionStorage.removeItem('citymind_ai_session_id');
};

export const getStoredExpiry = () => Number(sessionStorage.getItem(AUTH_EXPIRY_KEY) || 0);