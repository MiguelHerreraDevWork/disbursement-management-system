import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse, type JsonBodyType } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { clearSession, saveSession } from "../src/auth/session";
import { RequestDetailPage } from "../src/routes/RequestDetailPage";
import { server } from "./mocks/server";
import { renderWithProviders } from "./testUtils";

const routes = [{ path: "/requests/:id", element: <RequestDetailPage /> }];

function baseRequest(overrides: Record<string, unknown> = {}) {
  return {
    id: "req-1",
    externalReference: "REF-1",
    supplierId: "s1",
    supplier: { id: "s1", taxId: "TAX-0001", name: "Acme Logistics SA" },
    amount: "250.00",
    currency: "USD",
    concept: "Consulting services",
    status: "PENDING",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    decision: null,
    ...overrides,
  };
}

function mockDetail(body: JsonBodyType) {
  server.use(http.get("/api/disbursement-requests/req-1", () => HttpResponse.json(body)));
}

// A successful decide mutation invalidates the detail query, which
// refetches GET .../req-1 — a static mock would clobber the mutation's own
// result with stale (still-PENDING) data on that refetch, so the GET
// handler here tracks whether the decide endpoint has already been called.
function mockDecideFlow(action: "approve" | "reject", decidedBody: JsonBodyType) {
  let decided = false;
  server.use(
    http.get("/api/disbursement-requests/req-1", () => HttpResponse.json(decided ? decidedBody : baseRequest())),
    http.post(`/api/disbursement-requests/req-1/${action}`, () => {
      decided = true;
      return HttpResponse.json(decidedBody);
    }),
  );
}

describe("RequestDetailPage", () => {
  afterEach(() => {
    clearSession();
  });

  it("renders the request detail with a null decision", async () => {
    mockDetail(baseRequest());

    renderWithProviders(routes, ["/requests/req-1"]);

    expect(await screen.findByText("REF-1")).toBeInTheDocument();
    expect(screen.getByText(/Acme Logistics SA/)).toBeInTheDocument();
    expect(screen.getByText("PENDING")).toBeInTheDocument();
    expect(screen.queryByText("Decision")).not.toBeInTheDocument();
  });

  it("renders a <script> tag in concept as literal text, not executable markup (no stored XSS)", async () => {
    mockDetail(baseRequest({ concept: "<script>window.__xss = true;</script>" }));

    renderWithProviders(routes, ["/requests/req-1"]);

    expect(await screen.findByText("<script>window.__xss = true;</script>")).toBeInTheDocument();
    expect(document.querySelector("script[data-injected]")).toBeNull();
    expect((window as unknown as { __xss?: boolean }).__xss).toBeUndefined();
  });

  it("shows the decision section once the request has been decided", async () => {
    mockDetail(
      baseRequest({
        status: "REJECTED",
        decision: {
          id: "d1",
          decision: "REJECTED",
          reason: "Budget exceeded",
          decidedBy: "supervisor-id",
          decidedAt: "2026-01-02T00:00:00.000Z",
        },
      }),
    );

    renderWithProviders(routes, ["/requests/req-1"]);

    const decisionHeading = await screen.findByRole("heading", { name: "Decision" });
    const decisionSection = decisionHeading.closest("section");
    expect(decisionSection).not.toBeNull();
    expect(within(decisionSection as HTMLElement).getByText("REJECTED")).toBeInTheDocument();
    expect(within(decisionSection as HTMLElement).getByText("Budget exceeded")).toBeInTheDocument();
  });

  it("hides approve/reject controls for an ANALYST session", async () => {
    mockDetail(baseRequest());
    saveSession({ token: "t", role: "ANALYST", username: "analyst.demo" });

    renderWithProviders(routes, ["/requests/req-1"]);

    await screen.findByText("REF-1");
    expect(screen.queryByRole("button", { name: /^approve$/i })).not.toBeInTheDocument();
  });

  it("hides approve/reject controls for a SUPERVISOR once the request is no longer PENDING", async () => {
    mockDetail(
      baseRequest({
        status: "APPROVED",
        decision: { id: "d1", decision: "APPROVED", reason: null, decidedBy: "x", decidedAt: "2026-01-02T00:00:00.000Z" },
      }),
    );
    saveSession({ token: "t", role: "SUPERVISOR", username: "supervisor.demo" });

    renderWithProviders(routes, ["/requests/req-1"]);

    await screen.findByText("REF-1");
    expect(screen.queryByRole("button", { name: /^approve$/i })).not.toBeInTheDocument();
  });

  it("shows approve/reject controls for a SUPERVISOR on a PENDING request and approves successfully", async () => {
    saveSession({ token: "t", role: "SUPERVISOR", username: "supervisor.demo" });
    mockDecideFlow(
      "approve",
      baseRequest({
        status: "APPROVED",
        decision: { id: "d1", decision: "APPROVED", reason: null, decidedBy: "supervisor-id", decidedAt: "2026-01-02T00:00:00.000Z" },
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(routes, ["/requests/req-1"]);

    await screen.findByText("REF-1");
    await user.click(screen.getByRole("button", { name: /^approve$/i }));

    const decisionHeading = await screen.findByRole("heading", { name: "Decision" });
    const decisionSection = decisionHeading.closest("section");
    expect(within(decisionSection as HTMLElement).getByText("APPROVED")).toBeInTheDocument();
  });

  // TDD §18's stretch goal explicitly names this: "clicking Approve
  // triggers the mutation call and subsequent list invalidation (mocked)".
  it("invalidates the requests list cache after a successful approve, so other views pick up the new status", async () => {
    saveSession({ token: "t", role: "SUPERVISOR", username: "supervisor.demo" });
    mockDecideFlow(
      "approve",
      baseRequest({
        status: "APPROVED",
        decision: { id: "d1", decision: "APPROVED", reason: null, decidedBy: "supervisor-id", decidedAt: "2026-01-02T00:00:00.000Z" },
      }),
    );

    const user = userEvent.setup();
    const { queryClient } = renderWithProviders(routes, ["/requests/req-1"]);
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    await screen.findByText("REF-1");
    await user.click(screen.getByRole("button", { name: /^approve$/i }));
    await screen.findByRole("heading", { name: "Decision" });

    expect(invalidateSpy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ["requests"] }));
    expect(invalidateSpy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ["requests", "req-1"] }));
  });

  it("rejects with a reason and shows the updated decision", async () => {
    saveSession({ token: "t", role: "SUPERVISOR", username: "supervisor.demo" });
    mockDecideFlow(
      "reject",
      baseRequest({
        status: "REJECTED",
        decision: {
          id: "d1",
          decision: "REJECTED",
          reason: "Missing documentation",
          decidedBy: "supervisor-id",
          decidedAt: "2026-01-02T00:00:00.000Z",
        },
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(routes, ["/requests/req-1"]);

    await screen.findByText("REF-1");
    await user.click(screen.getByRole("button", { name: /^reject$/i }));
    await user.type(screen.getByLabelText(/reason for rejection/i), "Missing documentation");
    await user.click(screen.getByRole("button", { name: /confirm rejection/i }));

    expect(await screen.findByText("Missing documentation")).toBeInTheDocument();
  });

  it("shows a 409 conflict error message if the request was already decided by someone else", async () => {
    mockDetail(baseRequest());
    saveSession({ token: "t", role: "SUPERVISOR", username: "supervisor.demo" });
    server.use(
      http.post("/api/disbursement-requests/req-1/approve", () =>
        HttpResponse.json(
          { error: { code: "REQUEST_ALREADY_DECIDED", message: "This request has already been decided.", correlationId: "x" } },
          { status: 409 },
        ),
      ),
    );

    const user = userEvent.setup();
    renderWithProviders(routes, ["/requests/req-1"]);

    await screen.findByText("REF-1");
    await user.click(screen.getByRole("button", { name: /^approve$/i }));

    expect(await screen.findByText("This request has already been decided.")).toBeInTheDocument();
  });
});
