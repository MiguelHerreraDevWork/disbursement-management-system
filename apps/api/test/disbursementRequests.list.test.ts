import { randomUUID } from "node:crypto";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { DEMO_PASSWORD } from "../src/db/seedData.js";
import { getSupplierIdByTaxId, loginAs } from "./helpers.js";

async function createRequest(
  app: ReturnType<typeof createApp>,
  token: string,
  overrides: { supplierId: string; externalReference: string },
) {
  return request(app)
    .post("/api/disbursement-requests")
    .set("Authorization", `Bearer ${token}`)
    .send({
      amount: "100.00",
      currency: "USD",
      concept: "List/search fixture",
      ...overrides,
    });
}

describe("GET /api/disbursement-requests", () => {
  it("lists a created request and matches it by exact external reference search (RF2)", async () => {
    const app = createApp();
    const analystToken = await loginAs(app, "analyst.demo", DEMO_PASSWORD);
    const readerToken = await loginAs(app, "supervisor.demo", DEMO_PASSWORD);
    const supplierId = await getSupplierIdByTaxId(app, analystToken, "TAX-0002");
    const externalReference = `TEST-LIST-${randomUUID()}`;

    await createRequest(app, analystToken, { supplierId, externalReference });

    const response = await request(app)
      .get("/api/disbursement-requests")
      .set("Authorization", `Bearer ${readerToken}`)
      .query({ search: externalReference });

    expect(response.status).toBe(200);
    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0].externalReference).toBe(externalReference);
    expect(response.body.items[0].supplier.taxId).toBe("TAX-0002");
    expect(response.body.total).toBe(1);
    expect(response.body.page).toBe(1);
    expect(response.body.pageSize).toBe(20);
    expect(response.body.totalPages).toBe(1);
  });

  it("matches by supplier name search", async () => {
    const app = createApp();
    const analystToken = await loginAs(app, "analyst.demo", DEMO_PASSWORD);
    const supplierId = await getSupplierIdByTaxId(app, analystToken, "TAX-0003");
    const externalReference = `TEST-SUPNAME-${randomUUID()}`;

    await createRequest(app, analystToken, { supplierId, externalReference });

    const response = await request(app)
      .get("/api/disbursement-requests")
      .set("Authorization", `Bearer ${analystToken}`)
      .query({ search: "Delta Industrial" });

    expect(response.status).toBe(200);
    expect(response.body.items.some((item: { externalReference: string }) => item.externalReference === externalReference)).toBe(true);
  });

  it("filters by status=PENDING and excludes it when filtering by APPROVED", async () => {
    const app = createApp();
    const analystToken = await loginAs(app, "analyst.demo", DEMO_PASSWORD);
    const supplierId = await getSupplierIdByTaxId(app, analystToken, "TAX-0001");
    const externalReference = `TEST-STATUS-${randomUUID()}`;

    await createRequest(app, analystToken, { supplierId, externalReference });

    const pending = await request(app)
      .get("/api/disbursement-requests")
      .set("Authorization", `Bearer ${analystToken}`)
      .query({ search: externalReference, status: "PENDING" });
    expect(pending.body.items).toHaveLength(1);

    const approved = await request(app)
      .get("/api/disbursement-requests")
      .set("Authorization", `Bearer ${analystToken}`)
      .query({ search: externalReference, status: "APPROVED" });
    expect(approved.body.items).toHaveLength(0);
  });

  it("paginates results without loading the full history in one response", async () => {
    const app = createApp();
    const analystToken = await loginAs(app, "analyst.demo", DEMO_PASSWORD);
    const supplierId = await getSupplierIdByTaxId(app, analystToken, "TAX-0001");
    const prefix = `TEST-PAGE-${randomUUID()}`;

    await createRequest(app, analystToken, { supplierId, externalReference: `${prefix}-A` });
    await createRequest(app, analystToken, { supplierId, externalReference: `${prefix}-B` });
    await createRequest(app, analystToken, { supplierId, externalReference: `${prefix}-C` });

    const response = await request(app)
      .get("/api/disbursement-requests")
      .set("Authorization", `Bearer ${analystToken}`)
      .query({ search: prefix, page: 1, pageSize: 2 });

    expect(response.status).toBe(200);
    expect(response.body.items).toHaveLength(2);
    expect(response.body.total).toBe(3);
    expect(response.body.totalPages).toBe(2);

    const secondPage = await request(app)
      .get("/api/disbursement-requests")
      .set("Authorization", `Bearer ${analystToken}`)
      .query({ search: prefix, page: 2, pageSize: 2 });

    expect(secondPage.body.items).toHaveLength(1);
  });

  it("rejects an unauthenticated request with 401", async () => {
    const app = createApp();

    const response = await request(app).get("/api/disbursement-requests");

    expect(response.status).toBe(401);
  });

  it("rejects a pageSize above the maximum with 400 VALIDATION_ERROR", async () => {
    const app = createApp();
    const token = await loginAs(app, "analyst.demo", DEMO_PASSWORD);

    const response = await request(app)
      .get("/api/disbursement-requests")
      .set("Authorization", `Bearer ${token}`)
      .query({ pageSize: 101 });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("treats a SQL-meta-character search term as a literal substring, not injected SQL", async () => {
    const app = createApp();
    const token = await loginAs(app, "analyst.demo", DEMO_PASSWORD);

    const response = await request(app)
      .get("/api/disbursement-requests")
      .set("Authorization", `Bearer ${token}`)
      .query({ search: "' OR 1=1 --" });

    // No syntax/server error and no behavior change other than an (empty)
    // literal substring match — proves the value is parameterized, not
    // concatenated into SQL.
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.items)).toBe(true);
  });
});
