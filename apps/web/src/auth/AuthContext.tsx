import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { apiFetch } from "../api/client";
import { clearSession, loadSession, saveSession, type AuthSession, type Role } from "./session";

interface LoginResponse {
  token: string;
  role: Role;
  username: string;
}

interface AuthContextValue {
  session: AuthSession | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(() => loadSession());

  async function login(username: string, password: string) {
    const result = await apiFetch<LoginResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });

    const nextSession: AuthSession = { token: result.token, role: result.role, username: result.username };
    saveSession(nextSession);
    setSession(nextSession);
  }

  function logout() {
    clearSession();
    setSession(null);
  }

  const value = useMemo(() => ({ session, login, logout }), [session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
