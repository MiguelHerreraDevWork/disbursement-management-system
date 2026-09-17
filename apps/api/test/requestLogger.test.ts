import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { logger } from "../src/lib/logger.js";
import { captureRoutePath, requestId, requestLogger } from "../src/middleware/requestLogger.js";

function buildTestApp() {
  const app = express();
  app.use(requestId);
  app.use(requestLogger);

  app.get("/healthz", captureRoutePath, (_req, res) => res.status(200).json({ status: "ok" }));

  const subRouter = express.Router();
  subRouter.get("/", captureRoutePath, (_req, res) => res.status(200).json({ items: [] }));
  subRouter.get("/:id", captureRoutePath, (_req, res) => res.status(200).json({ id: "x" }));
  subRouter.get("/:id/boom", captureRoutePath, () => {
    throw new Error("simulated failure deep in a nested router");
  });
  app.use("/api/things", subRouter);

  // Mounted OUTSIDE the sub-router, like the real app's errorHandler.
  // Express resets req.baseUrl while propagating the thrown error up to
  // here — exactly the scenario captureRoutePath exists to survive.
  app.use((_err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json({ error: "boom" });
  });

  return app;
}

describe("requestLogger path resolution", () => {
  it("logs the route pattern for a top-level route, not a truncated sub-router path", async () => {
    const app = buildTestApp();
    const infoSpy = vi.spyOn(logger, "info").mockImplementation(() => logger);

    await request(app).get("/healthz");

    expect(infoSpy).toHaveBeenCalledWith(expect.objectContaining({ path: "/healthz" }));
    infoSpy.mockRestore();
  });

  it("logs the full mounted path for a sub-router's root route (no trailing slash)", async () => {
    const app = buildTestApp();
    const infoSpy = vi.spyOn(logger, "info").mockImplementation(() => logger);

    await request(app).get("/api/things");

    expect(infoSpy).toHaveBeenCalledWith(expect.objectContaining({ path: "/api/things" }));
    infoSpy.mockRestore();
  });

  it("logs the route's :id pattern instead of the concrete id value", async () => {
    const app = buildTestApp();
    const infoSpy = vi.spyOn(logger, "info").mockImplementation(() => logger);

    await request(app).get("/api/things/12345");

    expect(infoSpy).toHaveBeenCalledWith(expect.objectContaining({ path: "/api/things/:id" }));
    infoSpy.mockRestore();
  });

  it("still logs the correct full route pattern when the route throws and an app-level error handler responds", async () => {
    const app = buildTestApp();
    const infoSpy = vi.spyOn(logger, "info").mockImplementation(() => logger);

    await request(app).get("/api/things/42/boom");

    expect(infoSpy).toHaveBeenCalledWith(
      expect.objectContaining({ path: "/api/things/:id/boom", statusCode: 500 }),
    );
    infoSpy.mockRestore();
  });
});
