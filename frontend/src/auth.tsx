import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from 'react';
import { api, Me } from './api';
import { Language, normalizeLanguage } from './i18n';

type AuthContextValue = {
  me: Me | null;
  language: Language;
  can: (permission: string) => boolean;
  loadMe: () => Promise<void>;
  logout: () => Promise<void>;
  clearAuth: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);

  const loadMe = useCallback(async () => {
    try {
      setMe(await api.me());
    } catch {
      setMe(null);
    }
  }, []);

  const clearAuth = useCallback(() => setMe(null), []);

  const logout = useCallback(async () => {
    await api.logout();
    setMe(null);
    window.history.replaceState({}, '', '/');
  }, []);

  const can = useCallback((permission: string) => me?.permissions.includes(permission) ?? false, [me]);
  const language = normalizeLanguage(me?.preferred_language);
  const value = useMemo(() => ({ me, language, can, loadMe, logout, clearAuth }), [me, language, can, loadMe, logout, clearAuth]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
