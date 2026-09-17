import { Navigate, Outlet, useLocation } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { useAuth } from "./AuthContext";

// UX only: the server independently re-verifies the JWT and role on every
// request (TDD §10) — this only avoids flashing protected UI at a client
// that has no (or an expired) session, it never grants access.
export function RequireAuth() {
  const { session, logout } = useAuth();
  const location = useLocation();

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return (
    <AppShell username={session.username} role={session.role} onLogout={logout}>
      <Outlet />
    </AppShell>
  );
}
