import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";

describe("health endpoints", () => {
  it("GET /healthz reports the process is up without checking the DB", async () => {
    const app = createApp();

    const response = await request(app).get("/healthz");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
  });

  it("GET /readyz reports ready when the database is reachable", async () => {
    const app = createApp();

    const response = await request(app).get("/readyz");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok", db: "ok" });
  });
});
