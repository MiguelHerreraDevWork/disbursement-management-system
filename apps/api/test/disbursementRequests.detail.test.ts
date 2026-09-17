import { randomUUID } from "node:crypto";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { DEMO_PASSWORD } from "../src/db/seedData.js";
import { getSupplierIdByTaxId, loginAs } from "./helpers.js";

describe("GET /api/disbursement-requests/:id", () => {
  it("returns the full detail with a null decision for a freshly created request (RF3)", async () => {
    const app = createApp();
    const analystToken = await loginAs(app, "analyst.demo", DEMO_PASSWORD);
    const supervisorToken = await loginAs(app, "supervisor.demo", DEMO_PASSWORD);
    const supplierId = await getSupplierIdByTaxId(app, analystToken, "TAX-0001");
    const externalReference = `TEST-DETAIL-${randomUUID()}`;

    const created = await request(app)
      .post("/api/disbursement-requests")
      .set("Authorization", `Bearer ${analystToken}`)
      .send({ supplierId, externalReference, amount: "77.25", currency: "USD", concept: "Detail fixture" });

    const response = await request(app)
      .get(`/api/disbursement-requests/${created.body.id}`)
      .set("Authorization", `Bearer ${supervisorToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      id: created.body.id,
      externalReference,
      amount: "77.25",
      currency: "USD",
      status: "PENDING",
      decision: null,
    });
    expect(response.body.supplier).toMatchObject({ id: supplierId, taxId: "TAX-0001" });
  });

  it("returns 404 REQUEST_NOT_FOUND for a well-formed but nonexistent id", async () => {
    const app = createApp();
    const token = await loginAs(app, "analyst.demo", DEMO_PASSWORD);

    const response = await request(app)
      .get(`/api/disbursement-requests/${randomUUID()}`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("REQUEST_NOT_FOUND");
  });

  it("returns 400 VALIDATION_ERROR for a malformed id", async () => {
    const app = createApp();
    const token = await loginAs(app, "analyst.demo", DEMO_PASSWORD);

    const response = await request(app)
      .get("/api/disbursement-requests/not-a-uuid")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects an unauthenticated request with 401", async () => {
    const app = createApp();

    const response = await request(app).get(`/api/disbursement-requests/${randomUUID()}`);

    expect(response.status).toBe(401);
  });
});
