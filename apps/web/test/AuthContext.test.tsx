import { act, renderHook } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { AuthProvider, useAuth } from "../src/auth/AuthContext";
import { clearSession, loadSession } from "../src/auth/session";
import { server } from "./mocks/server";

function wrapper({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

describe("AuthContext", () => {
  afterEach(() => {
    clearSession();
  });

  it("login stores the session in memory and in sessionStorage on success", async () => {
    server.use(
      http.post("/api/auth/login", () =>
        HttpResponse.json({ token: "fake-token", role: "ANALYST", username: "analyst.demo" }),
      ),
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.login("analyst.demo", "whatever");
    });

    expect(result.current.session).toEqual({ token: "fake-token", role: "ANALYST", username: "analyst.demo" });
    expect(loadSession()).toEqual({ token: "fake-token", role: "ANALYST", username: "analyst.demo" });
  });

  it("login throws and never sets a session on invalid credentials", async () => {
    server.use(
      http.post("/api/auth/login", () =>
        HttpResponse.json(
          { error: { code: "INVALID_CREDENTIALS", message: "Invalid username or password", correlationId: "x" } },
          { status: 401 },
        ),
      ),
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await expect(result.current.login("analyst.demo", "wrong")).rejects.toThrow("Invalid username or password");
    });

    expect(result.current.session).toBeNull();
    expect(loadSession()).toBeNull();
  });

  it("logout clears both the in-memory session and sessionStorage", async () => {
    server.use(
      http.post("/api/auth/login", () =>
        HttpResponse.json({ token: "fake-token", role: "SUPERVISOR", username: "supervisor.demo" }),
      ),
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.login("supervisor.demo", "whatever");
    });
    expect(result.current.session).not.toBeNull();

    act(() => {
      result.current.logout();
    });

    expect(result.current.session).toBeNull();
    expect(loadSession()).toBeNull();
  });
});
