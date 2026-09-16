import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";

describe("app scaffold", () => {
  it("responds with a 200 ok marker on GET /", async () => {
    const app = createApp();

    const response = await request(app).get("/");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ name: "@ias/api", status: "ok" });
  });
});
