import jwt from "jsonwebtoken";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { DEMO_PASSWORD } from "../src/db/seedData.js";
import { env } from "../src/lib/env.js";

// These tests rely on the demo users seeded by `npm run db:test:seed`
// (see apps/api/src/db/seedData.ts) against the isolated test database.

describe("POST /api/auth/login", () => {
  it("issues a verifiable JWT for a valid ANALYST login", async () => {
    const app = createApp();

    const response = await request(app)
      .post("/api/auth/login")
      .send({ username: "analyst.demo", password: DEMO_PASSWORD });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ role: "ANALYST", username: "analyst.demo" });
    expect(typeof response.body.token).toBe("string");

    const payload = jwt.verify(response.body.token, env.JWT_SECRET) as jwt.JwtPayload;
    expect(payload.role).toBe("ANALYST");
    expect(payload.username).toBe("analyst.demo");
    expect(typeof payload.sub).toBe("string");
  });

  it("issues a verifiable JWT for a valid SUPERVISOR login", async () => {
    const app = createApp();

    const response = await request(app)
      .post("/api/auth/login")
      .send({ username: "supervisor.demo", password: DEMO_PASSWORD });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ role: "SUPERVISOR", username: "supervisor.demo" });
  });

  it("rejects an incorrect password without revealing whether the user exists", async () => {
    const app = createApp();

    const response = await request(app)
      .post("/api/auth/login")
      .send({ username: "analyst.demo", password: "wrong-password" });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("rejects a nonexistent username with the same error as a wrong password", async () => {
    const app = createApp();

    const response = await request(app)
      .post("/api/auth/login")
      .send({ username: "nobody.demo", password: DEMO_PASSWORD });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("rejects a malformed request body with a validation error", async () => {
    const app = createApp();

    const response = await request(app).post("/api/auth/login").send({ username: "" });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects syntactically invalid JSON as a 400, not a 500, and still carries a correlation id", async () => {
    const app = createApp();

    const response = await request(app)
      .post("/api/auth/login")
      .set("Content-Type", "application/json")
      .send('{"username": not-valid-json');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(response.body.error.correlationId).toBeTruthy();
    expect(response.headers["x-request-id"]).toBe(response.body.error.correlationId);
  });

  it("never leaks a stack trace or internal details in the error body", async () => {
    const app = createApp();

    const response = await request(app)
      .post("/api/auth/login")
      .send({ username: "analyst.demo", password: "wrong-password" });

    const serialized = JSON.stringify(response.body);
    expect(serialized).not.toMatch(/at .*\(.*:\d+:\d+\)/);
    expect(response.body.error.correlationId).toBeTruthy();
  });
});
