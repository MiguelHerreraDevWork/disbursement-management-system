import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { ForbiddenError, UnauthorizedError } from "../lib/errors.js";
import { env } from "../lib/env.js";

interface AuthTokenPayload {
  sub: string;
  username: string;
  role: "ANALYST" | "SUPERVISOR";
}

function isAuthTokenPayload(payload: unknown): payload is AuthTokenPayload {
  return (
    typeof payload === "object" &&
    payload !== null &&
    typeof (payload as Record<string, unknown>).sub === "string" &&
    typeof (payload as Record<string, unknown>).username === "string" &&
    ((payload as Record<string, unknown>).role === "ANALYST" || (payload as Record<string, unknown>).role === "SUPERVISOR")
  );
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.header("authorization");

  if (!header || !header.startsWith("Bearer ")) {
    next(new UnauthorizedError("Missing or malformed Authorization header"));
    return;
  }

  const token = header.slice("Bearer ".length).trim();

  let payload: unknown;
  try {
    payload = jwt.verify(token, env.JWT_SECRET);
  } catch {
    next(new UnauthorizedError("Invalid or expired token"));
    return;
  }

  if (!isAuthTokenPayload(payload)) {
    next(new UnauthorizedError("Invalid token payload"));
    return;
  }

  req.user = { userId: payload.sub, username: payload.username, role: payload.role };
  next();
}

export function requireRole(...roles: Array<"ANALYST" | "SUPERVISOR">) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      next(new UnauthorizedError("Authentication required"));
      return;
    }

    if (!roles.includes(req.user.role)) {
      next(new ForbiddenError("Insufficient permissions for this operation"));
      return;
    }

    next();
  };
}
