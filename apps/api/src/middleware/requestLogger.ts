import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { logger } from "../lib/logger.js";

export function requestId(req: Request, res: Response, next: NextFunction) {
  const inbound = req.header("x-request-id");
  req.id = inbound && inbound.trim().length > 0 ? inbound : randomUUID();
  res.setHeader("X-Request-Id", req.id);
  next();
}

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const startedAt = process.hrtime.bigint();

  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    const result = res.statusCode === 409 ? "conflict" : res.statusCode >= 400 ? "error" : "success";

    logger.info({
      reqId: req.id,
      method: req.method,
      path: req.path,
      userId: req.user?.userId ?? null,
      role: req.user?.role ?? null,
      operation: req.operation ?? `${req.method} ${req.path}`,
      result,
      statusCode: res.statusCode,
      durationMs: Math.round(durationMs * 100) / 100,
    });
  });

  next();
}
