import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { DEMO_PASSWORD } from "../src/db/seedData.js";
import { loginAs } from "./helpers.js";

describe("GET /api/suppliers", () => {
  it("returns the seeded suppliers for any authenticated user", async () => {
    const app = createApp();
    const token = await loginAs(app, "supervisor.demo", DEMO_PASSWORD);

    const response = await request(app).get("/api/suppliers").set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body).toEqual(
      expect.arrayContaining([expect.objectContaining({ taxId: "TAX-0001", name: "Acme Logistics SA" })]),
    );
  });

  it("rejects an unauthenticated request with 401", async () => {
    const app = createApp();

    const response = await request(app).get("/api/suppliers");

    expect(response.status).toBe(401);
  });
});
