import jwt from "jsonwebtoken";
import type { NextFunction, Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import { requireAuth, requireRole } from "../src/middleware/auth.js";
import { ForbiddenError, UnauthorizedError } from "../src/lib/errors.js";
import { env } from "../src/lib/env.js";

function mockReq(headers: Record<string, string> = {}): Request {
  return {
    header: (name: string) => headers[name.toLowerCase()],
  } as unknown as Request;
}

describe("requireAuth", () => {
  it("attaches req.user and calls next() with no error for a valid token", () => {
    const token = jwt.sign({ sub: "user-1", username: "analyst.demo", role: "ANALYST" }, env.JWT_SECRET);
    const req = mockReq({ authorization: `Bearer ${token}` });
    const next = vi.fn() as unknown as NextFunction;

    requireAuth(req, {} as Response, next);

    expect(req.user).toEqual({ userId: "user-1", username: "analyst.demo", role: "ANALYST" });
    expect(next).toHaveBeenCalledWith();
  });

  it("calls next() with UnauthorizedError when the Authorization header is missing", () => {
    const req = mockReq();
    const next = vi.fn() as unknown as NextFunction;

    requireAuth(req, {} as Response, next);

    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });

  it("calls next() with UnauthorizedError for a token signed with the wrong secret", () => {
    const token = jwt.sign({ sub: "user-1", username: "analyst.demo", role: "ANALYST" }, "wrong-secret");
    const req = mockReq({ authorization: `Bearer ${token}` });
    const next = vi.fn() as unknown as NextFunction;

    requireAuth(req, {} as Response, next);

    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });

  it("calls next() with UnauthorizedError for a malformed header (no Bearer prefix)", () => {
    const req = mockReq({ authorization: "not-a-bearer-token" });
    const next = vi.fn() as unknown as NextFunction;

    requireAuth(req, {} as Response, next);

    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });
});

describe("requireRole", () => {
  it("calls next() with no error when the user's role is allowed", () => {
    const req = { user: { userId: "u1", username: "supervisor.demo", role: "SUPERVISOR" } } as Request;
    const next = vi.fn() as unknown as NextFunction;

    requireRole("SUPERVISOR")(req, {} as Response, next);

    expect(next).toHaveBeenCalledWith();
  });

  it("calls next() with ForbiddenError when the user's role is not allowed", () => {
    const req = { user: { userId: "u1", username: "analyst.demo", role: "ANALYST" } } as Request;
    const next = vi.fn() as unknown as NextFunction;

    requireRole("SUPERVISOR")(req, {} as Response, next);

    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
  });

  it("calls next() with UnauthorizedError when req.user is missing", () => {
    const req = {} as Request;
    const next = vi.fn() as unknown as NextFunction;

    requireRole("SUPERVISOR")(req, {} as Response, next);

    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });
});
