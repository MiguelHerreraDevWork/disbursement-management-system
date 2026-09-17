import { sql } from "drizzle-orm";
import express from "express";
import { db } from "./db/client.js";
import { metricsRegistry } from "./lib/metrics.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { captureRoutePath, requestId, requestLogger } from "./middleware/requestLogger.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import "./modules/disbursement-requests/decide.js";
import { disbursementRequestsRouter } from "./modules/disbursement-requests/disbursement-requests.routes.js";
import { suppliersRouter } from "./modules/suppliers/suppliers.routes.js";

export function createApp() {
  const app = express();

  // requestId must run before body parsing so every request — including
  // one with a malformed body that body-parser rejects — gets a correlation id.
  app.use(requestId);
  app.use(requestLogger);
  app.use(express.json());

  // Scaffold-only marker route.
  app.get("/", captureRoutePath, (_req, res) => {
    res.status(200).json({ name: "@ias/api", status: "ok" });
  });

  // Liveness: proves the process is up and responsive. Never checks the DB.
  app.get("/healthz", captureRoutePath, (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  // Readiness: proves the process can currently serve real traffic
  // (i.e. it can reach PostgreSQL). Kubernetes removes the pod from
  // Service endpoints on 503 without restarting it.
  app.get("/readyz", captureRoutePath, async (_req, res) => {
    try {
      await db.execute(sql`SELECT 1`);
      res.status(200).json({ status: "ok", db: "ok" });
    } catch {
      res.status(503).json({ status: "unavailable", db: "unreachable" });
    }
  });

  // §8's additional signal beyond logs. Unauthenticated per the API
  // contract (§9) — acceptable for this assessment, would sit behind
  // network policy/auth in production (§22).
  app.get("/metrics", captureRoutePath, async (_req, res) => {
    res.set("Content-Type", metricsRegistry.contentType);
    res.send(await metricsRegistry.metrics());
  });

  app.use("/api/auth", authRouter);
  app.use("/api/suppliers", suppliersRouter);
  app.use("/api/disbursement-requests", disbursementRequestsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
