import { clearSession, loadSession } from "../auth/session";
import { navigateTo } from "./navigation";

// Only relevant when serving the built frontend without a same-origin proxy
// in front of it. Local `vite dev` (via vite.config.ts's server.proxy) and
// the nginx-fronted Docker/k8s deployment (TDD §16) both proxy /api/* on
// the same origin, so this is left unset in both — set it only for a setup
// with no such proxy (see .env.example).
const API_BASE_URL = import.meta.env.VITE_API_URL ?? "";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const session = loadSession();

  const response = await fetch(`${API_BASE_URL}/api${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(session ? { Authorization: `Bearer ${session.token}` } : {}),
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const message = body?.error?.message ?? `Request failed with status ${response.status}`;

    if (response.status === 401) {
      clearSession();
      if (typeof window !== "undefined" && window.location.pathname !== "/login") {
        navigateTo("/login");
      }
    }

    throw new ApiError(response.status, message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}
