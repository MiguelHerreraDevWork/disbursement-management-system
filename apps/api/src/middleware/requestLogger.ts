import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { logger } from "../lib/logger.js";
import { recordHttpRequestMetrics } from "../lib/metrics.js";

export function requestId(req: Request, res: Response, next: NextFunction) {
  const inbound = req.header("x-request-id");
  req.id = inbound && inbound.trim().length > 0 ? inbound : randomUUID();
  res.setHeader("X-Request-Id", req.id);
  next();
}

// Express resets req.baseUrl/req.route as it unwinds out of a nested router
// once a handler calls next() or next(err) — by the time an error reaches
// the app-level error handler, or the async "finish" event fires, that
// information is already gone. Each router registers this as the first
// middleware on every route, while req.baseUrl/req.route are still valid
// for that specific matched route, and stashes the full pattern (e.g.
// "/api/disbursement-requests/:id") on req.loggedPath — a plain property
// Express's routing internals never touch — for the logger to read later
// regardless of what happens afterward in the chain (success or error).
export function captureRoutePath(req: Request, _res: Response, next: NextFunction) {
  const routePath = req.route?.path;
  if (typeof routePath === "string") {
    const combined = routePath === "/" ? req.baseUrl : `${req.baseUrl}${routePath}`;
    req.loggedPath = combined || "/";
  }
  next();
}

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const startedAt = process.hrtime.bigint();

  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    const result = res.statusCode === 409 ? "conflict" : res.statusCode >= 400 ? "error" : "success";
    // Falls back to req.path for a route that never matched at all (the
    // 404 catch-all), where no router ever ran captureRoutePath. Fine for
    // a log line (useful to see exactly what was requested).
    const path = req.loggedPath ?? req.path;

    logger.info({
      reqId: req.id,
      method: req.method,
      path,
      userId: req.user?.userId ?? null,
      role: req.user?.role ?? null,
      operation: req.operation ?? `${req.method} ${path}`,
      result,
      statusCode: res.statusCode,
      durationMs: Math.round(durationMs * 100) / 100,
    });

    // A Prometheus label must stay bounded — unlike the log line above, an
    // unmatched path (arbitrary client input on a public 404) must not
    // become its own label value, or scraping this endpoint would let a
    // client grow the metrics cardinality without limit.
    const metricsRoute = req.loggedPath ?? "unmatched";
    recordHttpRequestMetrics(req.method, metricsRoute, res.statusCode, durationMs / 1000);
  });

  next();
}
