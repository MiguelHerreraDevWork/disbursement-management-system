import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { DEMO_PASSWORD } from "../src/db/seedData.js";
import { disbursementRequests } from "../src/db/schema.js";
import { testDb } from "../src/db/testClient.js";
import { getSupplierIdByTaxId, loginAs } from "./helpers.js";

describe("POST /api/disbursement-requests", () => {
  it("creates a new PENDING request as ANALYST and is idempotent on an identical retry (RF1, RF5)", async () => {
    const app = createApp();
    const token = await loginAs(app, "analyst.demo", DEMO_PASSWORD);
    const supplierId = await getSupplierIdByTaxId(app, token, "TAX-0001");
    const externalReference = `TEST-${randomUUID()}`;
    const payload = {
      supplierId,
      externalReference,
      amount: "1234.50",
      currency: "USD",
      concept: "Test invoice for services rendered",
    };

    const first = await request(app)
      .post("/api/disbursement-requests")
      .set("Authorization", `Bearer ${token}`)
      .send(payload);

    expect(first.status).toBe(201);
    expect(first.body.status).toBe("PENDING");
    expect(first.body.idempotentReplay).toBe(false);
    expect(first.body.amount).toBe("1234.50");
    expect(first.body.supplier).toMatchObject({ taxId: "TAX-0001" });
    const requestId = first.body.id;

    // Simulates a client retry after a timeout/network error with the exact
    // same payload — must not create a second row (RF5).
    const second = await request(app)
      .post("/api/disbursement-requests")
      .set("Authorization", `Bearer ${token}`)
      .send(payload);

    expect(second.status).toBe(200);
    expect(second.body.id).toBe(requestId);
    expect(second.body.idempotentReplay).toBe(true);

    const rows = await testDb
      .select()
      .from(disbursementRequests)
      .where(
        and(
          eq(disbursementRequests.supplierId, supplierId),
          eq(disbursementRequests.externalReference, externalReference),
        ),
      );
    expect(rows).toHaveLength(1);
  });

  it("rejects creation from a SUPERVISOR with 403", async () => {
    const app = createApp();
    const analystToken = await loginAs(app, "analyst.demo", DEMO_PASSWORD);
    const supplierId = await getSupplierIdByTaxId(app, analystToken, "TAX-0001");
    const supervisorToken = await loginAs(app, "supervisor.demo", DEMO_PASSWORD);

    const response = await request(app)
      .post("/api/disbursement-requests")
      .set("Authorization", `Bearer ${supervisorToken}`)
      .send({
        supplierId,
        externalReference: `TEST-${randomUUID()}`,
        amount: "10.00",
        currency: "USD",
        concept: "Should be forbidden",
      });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
  });

  it("rejects an unauthenticated request with 401", async () => {
    const app = createApp();

    const response = await request(app).post("/api/disbursement-requests").send({});

    expect(response.status).toBe(401);
  });

  it("returns 404 SUPPLIER_NOT_FOUND for a nonexistent supplier", async () => {
    const app = createApp();
    const token = await loginAs(app, "analyst.demo", DEMO_PASSWORD);

    const response = await request(app)
      .post("/api/disbursement-requests")
      .set("Authorization", `Bearer ${token}`)
      .send({
        supplierId: randomUUID(),
        externalReference: `TEST-${randomUUID()}`,
        amount: "10.00",
        currency: "USD",
        concept: "Supplier does not exist",
      });

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("SUPPLIER_NOT_FOUND");
  });

  it("returns 400 VALIDATION_ERROR for a non-positive amount", async () => {
    const app = createApp();
    const token = await loginAs(app, "analyst.demo", DEMO_PASSWORD);
    const supplierId = await getSupplierIdByTaxId(app, token, "TAX-0001");

    const response = await request(app)
      .post("/api/disbursement-requests")
      .set("Authorization", `Bearer ${token}`)
      .send({
        supplierId,
        externalReference: `TEST-${randomUUID()}`,
        amount: "-5.00",
        currency: "USD",
        concept: "Negative amount",
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 VALIDATION_ERROR for a malformed currency code", async () => {
    const app = createApp();
    const token = await loginAs(app, "analyst.demo", DEMO_PASSWORD);
    const supplierId = await getSupplierIdByTaxId(app, token, "TAX-0001");

    const response = await request(app)
      .post("/api/disbursement-requests")
      .set("Authorization", `Bearer ${token}`)
      .send({
        supplierId,
        externalReference: `TEST-${randomUUID()}`,
        amount: "10.00",
        currency: "us",
        concept: "Lowercase currency",
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 VALIDATION_ERROR when required fields are missing", async () => {
    const app = createApp();
    const token = await loginAs(app, "analyst.demo", DEMO_PASSWORD);

    const response = await request(app)
      .post("/api/disbursement-requests")
      .set("Authorization", `Bearer ${token}`)
      .send({ concept: "Missing everything else" });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("treats a <script> tag in concept as opaque text, not a validation failure", async () => {
    const app = createApp();
    const token = await loginAs(app, "analyst.demo", DEMO_PASSWORD);
    const supplierId = await getSupplierIdByTaxId(app, token, "TAX-0001");

    const response = await request(app)
      .post("/api/disbursement-requests")
      .set("Authorization", `Bearer ${token}`)
      .send({
        supplierId,
        externalReference: `TEST-${randomUUID()}`,
        amount: "10.00",
        currency: "USD",
        concept: "<script>alert('xss')</script>",
      });

    expect(response.status).toBe(201);
    expect(response.body.concept).toBe("<script>alert('xss')</script>");
  });
});
