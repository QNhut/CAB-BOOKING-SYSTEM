import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { decodeToken, isExpired } from "../lib/jwt";
import type { Role } from "../lib/jwt";
import { setAuthToken } from "../lib/http";

type AuthState = {
  token: string | null;
  role: Role | null;
  userId: string | null;
  driverId: string | null;
  login: (token: string) => void;
  logout: () => void;
};

const AuthCtx = createContext<AuthState | null>(null);

const LS_KEY = "taxi.accessToken";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(localStorage.getItem(LS_KEY));

  useEffect(() => {
    if (token && isExpired(token)) {
      localStorage.removeItem(LS_KEY);
      setToken(null);
    }
    setAuthToken(token);
  }, [token]);

  // Periodically check if token expires while page is open (every 30s)
  useEffect(() => {
    const id = setInterval(() => {
      const stored = localStorage.getItem(LS_KEY);
      if (stored && isExpired(stored)) {
        console.warn("[Auth] Access token expired — logging out");
        localStorage.removeItem(LS_KEY);
        setToken(null);
      }
    }, 30_000);
    return () => clearInterval(id);
  }, []);

  const claims = useMemo(() => (token ? decodeToken(token) : null), [token]);

  const value: AuthState = {
    token,
    role: (claims?.role ?? null) as any,
    userId: claims?.userId ?? (claims?.role === "USER" ? claims.sub : null),
    driverId: claims?.driverId ?? (claims?.role === "DRIVER" ? claims.sub : null),
    login: (t) => {
      localStorage.setItem(LS_KEY, t);
      setToken(t);
    },
    logout: () => {
      localStorage.removeItem(LS_KEY);
      setToken(null);
    },
  };

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const v = useContext(AuthCtx);
  if (!v) throw new Error("useAuth must be used within AuthProvider");
  return v;
}