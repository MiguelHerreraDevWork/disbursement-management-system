export type Role = "ANALYST" | "SUPERVISOR";

export interface AuthSession {
  token: string;
  role: Role;
  username: string;
}

// sessionStorage (not localStorage) so the token survives a reload but not
// a closed tab — the assessment-scope tradeoff documented in TDD §10.
const STORAGE_KEY = "ias.auth.session";

export function loadSession(): AuthSession | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AuthSession) : null;
  } catch {
    return null;
  }
}

export function saveSession(session: AuthSession): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // sessionStorage unavailable (private browsing, storage quota, etc.) —
    // the session simply won't survive a reload.
  }
}

export function clearSession(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
