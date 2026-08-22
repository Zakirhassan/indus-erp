import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { currentSession, login as apiLogin, logout as apiLogout, me } from "../api/auth";
import type { Session } from "../mock/session";

interface AuthContextValue {
  session: Session | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(() => currentSession());

  useEffect(() => {
    if (!session) return;
    // Revalidate the persisted session on app load — apiClient's 401 handling clears it and
    // redirects to /login if the token is stale/expired, instead of waiting for the first
    // real page action to discover that.
    me().catch(() => {
      /* apiClient already cleared the session and redirected on 401 */
    });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      login: async (email, password) => {
        const s = await apiLogin(email, password);
        setSession(s);
      },
      logout: () => {
        apiLogout();
        setSession(null);
      },
    }),
    [session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
