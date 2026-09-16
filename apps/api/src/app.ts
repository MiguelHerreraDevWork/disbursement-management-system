import { sql } from "drizzle-orm";
import express from "express";
import { db } from "./db/client.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { requestId, requestLogger } from "./middleware/requestLogger.js";
import { authRouter } from "./modules/auth/auth.routes.js";

export function createApp() {
  const app = express();

  // requestId must run before body parsing so every request — including
  // one with a malformed body that body-parser rejects — gets a correlation id.
  app.use(requestId);
  app.use(requestLogger);
  app.use(express.json());

  // Scaffold-only marker route. The disbursement-requests API is
  // implemented in a later phase per docs/TDD.md.
  app.get("/", (_req, res) => {
    res.status(200).json({ name: "@ias/api", status: "ok" });
  });

  // Liveness: proves the process is up and responsive. Never checks the DB.
  app.get("/healthz", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  // Readiness: proves the process can currently serve real traffic
  // (i.e. it can reach PostgreSQL). Kubernetes removes the pod from
  // Service endpoints on 503 without restarting it.
  app.get("/readyz", async (_req, res) => {
    try {
      await db.execute(sql`SELECT 1`);
      res.status(200).json({ status: "ok", db: "ok" });
    } catch {
      res.status(503).json({ status: "unavailable", db: "unreachable" });
    }
  });

  app.use("/api/auth", authRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
