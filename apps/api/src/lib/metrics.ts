import { Counter, Histogram, Registry } from "prom-client";

// §8's "at least one additional signal beyond logs" — chosen over
// distributed tracing because a single-process, single-database backend has
// no cross-service span to trace; a metrics endpoint is simple to explain
// and test ("hit an endpoint N times, curl /metrics, see the counter at N").
export const metricsRegistry = new Registry();

export const httpRequestsTotal = new Counter({
  name: "http_requests_total",
  help: "Total number of HTTP requests, labeled by method, route, and status code",
  labelNames: ["method", "route", "status"] as const,
  registers: [metricsRegistry],
});

export const httpRequestDurationSeconds = new Histogram({
  name: "http_request_duration_seconds",
  help: "HTTP request duration in seconds, labeled by method and route",
  labelNames: ["method", "route"] as const,
  registers: [metricsRegistry],
});

export function recordHttpRequestMetrics(method: string, route: string, status: number, durationSeconds: number) {
  httpRequestsTotal.labels(method, route, String(status)).inc();
  httpRequestDurationSeconds.labels(method, route).observe(durationSeconds);
}
