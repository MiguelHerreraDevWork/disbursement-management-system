import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "./AuthContext";
import type { Role } from "./session";

// UX only, same caveat as RequireAuth — the server independently enforces
// role checks (e.g. requireRole('ANALYST') on POST /api/disbursement-requests).
// Always rendered as a child of RequireAuth, so `session` is already set here.
export function RequireRole({ role }: { role: Role }) {
  const { session } = useAuth();

  if (session && session.role !== role) {
    return <Navigate to="/requests" replace />;
  }

  return <Outlet />;
}
