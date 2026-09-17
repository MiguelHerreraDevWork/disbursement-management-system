import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { httpRequestsTotal, metricsRegistry } from "../src/lib/metrics.js";

async function getCounterValue(method: string, route: string, status: string): Promise<number> {
  const metric = await httpRequestsTotal.get();
  const entry = metric.values.find(
    (value) => value.labels.method === method && value.labels.route === route && value.labels.status === status,
  );
  return entry?.value ?? 0;
}

describe("GET /metrics", () => {
  it("exposes Prometheus text-format metrics with the documented metric names", async () => {
    const app = createApp();

    const response = await request(app).get("/metrics");

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain(metricsRegistry.contentType.split(";")[0]);
    expect(response.text).toContain("# HELP http_requests_total");
    expect(response.text).toContain("# TYPE http_requests_total counter");
    expect(response.text).toContain("# HELP http_request_duration_seconds");
    expect(response.text).toContain("# TYPE http_request_duration_seconds histogram");
  });

  it("increments http_requests_total by exactly the number of requests made, labeled by method/route/status", async () => {
    const app = createApp();

    const before = await getCounterValue("GET", "/healthz", "200");

    // TDD §15's own verification philosophy: "hit an endpoint N times,
    // curl /metrics, see the counter at N" — asserted here as a delta so
    // the test doesn't depend on this being the only test hitting /healthz
    // within the shared process-level registry.
    const hits = 5;
    for (let i = 0; i < hits; i += 1) {
      await request(app).get("/healthz");
    }

    const after = await getCounterValue("GET", "/healthz", "200");

    expect(after - before).toBe(hits);
  });

  it("labels the route by pattern, not by concrete id, to keep label cardinality bounded", async () => {
    const app = createApp();

    // Two different (nonexistent) ids hitting the same route pattern.
    await request(app).get(`/api/disbursement-requests/00000000-0000-4000-8000-000000000001`);
    await request(app).get(`/api/disbursement-requests/00000000-0000-4000-8000-000000000002`);

    const metric = await httpRequestsTotal.get();
    const idLabeledEntries = metric.values.filter((value) => value.labels.route?.toString().includes("00000000"));
    const patternEntry = metric.values.find(
      (value) => value.labels.route === "/api/disbursement-requests/:id" && value.labels.status === "401",
    );

    expect(idLabeledEntries).toHaveLength(0);
    expect(patternEntry?.value).toBeGreaterThanOrEqual(2);
  });
});
