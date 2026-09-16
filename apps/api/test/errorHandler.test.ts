import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { errorHandler, notFoundHandler } from "../src/middleware/errorHandler.js";
import { requestId } from "../src/middleware/requestLogger.js";
import { ConflictError } from "../src/lib/errors.js";

function buildTestApp() {
  const app = express();
  app.use(requestId);

  app.get("/known-error", () => {
    throw new ConflictError("This request has already been decided.", "REQUEST_ALREADY_DECIDED");
  });

  app.get("/unexpected-error", () => {
    throw new Error("something exploded with a secret stack trace detail");
  });

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

describe("errorHandler", () => {
  it("maps a known AppError to its status code and safe body", async () => {
    const app = buildTestApp();

    const response = await request(app).get("/known-error");

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      error: {
        code: "REQUEST_ALREADY_DECIDED",
        message: "This request has already been decided.",
        correlationId: expect.any(String),
      },
    });
    expect(response.headers["x-request-id"]).toBe(response.body.error.correlationId);
  });

  it("maps an unexpected error to a generic 500 without leaking internals", async () => {
    const app = buildTestApp();

    const response = await request(app).get("/unexpected-error");

    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe("INTERNAL_ERROR");
    expect(response.body.error.message).not.toMatch(/secret stack trace/);
    expect(JSON.stringify(response.body)).not.toMatch(/at .*\(.*:\d+:\d+\)/);
    expect(response.body.error.correlationId).toBeTruthy();
  });

  it("returns a JSON 404 (not the default Express HTML page) for unmatched routes", async () => {
    const app = buildTestApp();

    const response = await request(app).get("/does-not-exist");

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("NOT_FOUND");
    expect(response.headers["content-type"]).toMatch(/json/);
  });
});
