import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { decisions } from "../src/db/schema.js";
import { DEMO_PASSWORD } from "../src/db/seedData.js";
import { testDb } from "../src/db/testClient.js";
import { getSupplierIdByTaxId, loginAs } from "./helpers.js";

async function createPendingRequest(
  app: ReturnType<typeof createApp>,
  analystToken: string,
  supplierId: string,
) {
  const response = await request(app)
    .post("/api/disbursement-requests")
    .set("Authorization", `Bearer ${analystToken}`)
    .send({
      supplierId,
      externalReference: `TEST-DECIDE-${randomUUID()}`,
      amount: "500.00",
      currency: "USD",
      concept: "Decide fixture",
    });
  return response.body.id as string;
}

describe("POST /api/disbursement-requests/:id/approve", () => {
  it("approves a PENDING request as SUPERVISOR and records the decision (RF4)", async () => {
    const app = createApp();
    const analystToken = await loginAs(app, "analyst.demo", DEMO_PASSWORD);
    const supervisorToken = await loginAs(app, "supervisor.demo", DEMO_PASSWORD);
    const supplierId = await getSupplierIdByTaxId(app, analystToken, "TAX-0001");
    const requestId = await createPendingRequest(app, analystToken, supplierId);

    const response = await request(app)
      .post(`/api/disbursement-requests/${requestId}/approve`)
      .set("Authorization", `Bearer ${supervisorToken}`)
      .send({});

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("APPROVED");
    expect(response.body.decision).toMatchObject({ decision: "APPROVED", reason: null });
    expect(response.body.decision.decidedAt).toBeTruthy();
  });

  it("a request that is already decided cannot be re-decided (409)", async () => {
    const app = createApp();
    const analystToken = await loginAs(app, "analyst.demo", DEMO_PASSWORD);
    const supervisorToken = await loginAs(app, "supervisor.demo", DEMO_PASSWORD);
    const supplierId = await getSupplierIdByTaxId(app, analystToken, "TAX-0001");
    const requestId = await createPendingRequest(app, analystToken, supplierId);

    const first = await request(app)
      .post(`/api/disbursement-requests/${requestId}/approve`)
      .set("Authorization", `Bearer ${supervisorToken}`)
      .send({});
    expect(first.status).toBe(200);

    const second = await request(app)
      .post(`/api/disbursement-requests/${requestId}/approve`)
      .set("Authorization", `Bearer ${supervisorToken}`)
      .send({});

    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe("REQUEST_ALREADY_DECIDED");
    expect(second.body.error.details).toMatchObject({ status: "APPROVED" });
    expect(second.body.error.details.decision).toMatchObject({ decision: "APPROVED" });
  });

  it("rejects an ANALYST attempting to approve with 403", async () => {
    const app = createApp();
    const analystToken = await loginAs(app, "analyst.demo", DEMO_PASSWORD);
    const supplierId = await getSupplierIdByTaxId(app, analystToken, "TAX-0001");
    const requestId = await createPendingRequest(app, analystToken, supplierId);

    const response = await request(app)
      .post(`/api/disbursement-requests/${requestId}/approve`)
      .set("Authorization", `Bearer ${analystToken}`)
      .send({});

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
  });

  it("rejects an unauthenticated request with 401", async () => {
    const app = createApp();

    const response = await request(app).post(`/api/disbursement-requests/${randomUUID()}/approve`).send({});

    expect(response.status).toBe(401);
  });

  it("returns 404 REQUEST_NOT_FOUND for a nonexistent id", async () => {
    const app = createApp();
    const supervisorToken = await loginAs(app, "supervisor.demo", DEMO_PASSWORD);

    const response = await request(app)
      .post(`/api/disbursement-requests/${randomUUID()}/approve`)
      .set("Authorization", `Bearer ${supervisorToken}`)
      .send({});

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("REQUEST_NOT_FOUND");
  });

  it("returns 400 VALIDATION_ERROR for a malformed id", async () => {
    const app = createApp();
    const supervisorToken = await loginAs(app, "supervisor.demo", DEMO_PASSWORD);

    const response = await request(app)
      .post("/api/disbursement-requests/not-a-uuid/approve")
      .set("Authorization", `Bearer ${supervisorToken}`)
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("POST /api/disbursement-requests/:id/reject", () => {
  it("rejects a PENDING request with a reason as SUPERVISOR (RF4)", async () => {
    const app = createApp();
    const analystToken = await loginAs(app, "analyst.demo", DEMO_PASSWORD);
    const supervisorToken = await loginAs(app, "supervisor.demo", DEMO_PASSWORD);
    const supplierId = await getSupplierIdByTaxId(app, analystToken, "TAX-0001");
    const requestId = await createPendingRequest(app, analystToken, supplierId);

    const response = await request(app)
      .post(`/api/disbursement-requests/${requestId}/reject`)
      .set("Authorization", `Bearer ${supervisorToken}`)
      .send({ reason: "Amount exceeds the approved budget for this supplier" });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("REJECTED");
    expect(response.body.decision).toMatchObject({
      decision: "REJECTED",
      reason: "Amount exceeds the approved budget for this supplier",
    });
  });

  it("requires a non-empty reason (400 VALIDATION_ERROR)", async () => {
    const app = createApp();
    const analystToken = await loginAs(app, "analyst.demo", DEMO_PASSWORD);
    const supervisorToken = await loginAs(app, "supervisor.demo", DEMO_PASSWORD);
    const supplierId = await getSupplierIdByTaxId(app, analystToken, "TAX-0001");
    const requestId = await createPendingRequest(app, analystToken, supplierId);

    const missing = await request(app)
      .post(`/api/disbursement-requests/${requestId}/reject`)
      .set("Authorization", `Bearer ${supervisorToken}`)
      .send({});
    expect(missing.status).toBe(400);
    expect(missing.body.error.code).toBe("VALIDATION_ERROR");

    const blank = await request(app)
      .post(`/api/disbursement-requests/${requestId}/reject`)
      .set("Authorization", `Bearer ${supervisorToken}`)
      .send({ reason: "   " });
    expect(blank.status).toBe(400);
    expect(blank.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects an ANALYST attempting to reject with 403", async () => {
    const app = createApp();
    const analystToken = await loginAs(app, "analyst.demo", DEMO_PASSWORD);
    const supplierId = await getSupplierIdByTaxId(app, analystToken, "TAX-0001");
    const requestId = await createPendingRequest(app, analystToken, supplierId);

    const response = await request(app)
      .post(`/api/disbursement-requests/${requestId}/reject`)
      .set("Authorization", `Bearer ${analystToken}`)
      .send({ reason: "Should be forbidden" });

    expect(response.status).toBe(403);
  });
});

describe("Concurrent decisions (RF6)", () => {
  it("resolves two simultaneous decide calls on the same PENDING request to exactly one winner, consistently and auditably", async () => {
    const app = createApp();
    const analystToken = await loginAs(app, "analyst.demo", DEMO_PASSWORD);
    const supervisorToken = await loginAs(app, "supervisor.demo", DEMO_PASSWORD);
    const supplierId = await getSupplierIdByTaxId(app, analystToken, "TAX-0001");
    const requestId = await createPendingRequest(app, analystToken, supplierId);

    const [approveResponse, rejectResponse] = await Promise.all([
      request(app)
        .post(`/api/disbursement-requests/${requestId}/approve`)
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send({}),
      request(app)
        .post(`/api/disbursement-requests/${requestId}/reject`)
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send({ reason: "Concurrent rejection attempt" }),
    ]);

    // Exactly one of the two concurrent calls wins (200), the other loses (409).
    const statuses = [approveResponse.status, rejectResponse.status].sort();
    expect(statuses).toEqual([200, 409]);

    const winnerIsApprove = approveResponse.status === 200;
    const winnerResponse = winnerIsApprove ? approveResponse : rejectResponse;
    const loserResponse = winnerIsApprove ? rejectResponse : approveResponse;
    const winningStatus = winnerIsApprove ? "APPROVED" : "REJECTED";

    expect(winnerResponse.body.status).toBe(winningStatus);
    expect(loserResponse.body.error.code).toBe("REQUEST_ALREADY_DECIDED");
    expect(loserResponse.body.error.details.status).toBe(winningStatus);

    // Auditable + consistent: exactly one decisions row exists, and it
    // matches the actual final status of the request.
    const decisionRows = await testDb.select().from(decisions).where(eq(decisions.requestId, requestId));
    expect(decisionRows).toHaveLength(1);
    expect(decisionRows[0]?.decision).toBe(winningStatus);

    const finalDetail = await request(app)
      .get(`/api/disbursement-requests/${requestId}`)
      .set("Authorization", `Bearer ${supervisorToken}`);
    expect(finalDetail.body.status).toBe(winningStatus);
    expect(finalDetail.body.decision.decision).toBe(winningStatus);
  });
});
