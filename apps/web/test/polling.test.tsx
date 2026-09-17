import { screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { RequestDetailPage } from "../src/routes/RequestDetailPage";
import { RequestsListPage } from "../src/routes/RequestsListPage";
import { server } from "./mocks/server";
import { renderWithProviders } from "./testUtils";

// RF7 (TDD §14): verifies the actual wired query configuration — not just
// that the source contains the string "refetchInterval" — by inspecting
// the live QueryClient's cache after the query has run.
describe("polling configuration (RF7)", () => {
  it("polls the requests list every 5 seconds", async () => {
    server.use(
      http.get("/api/disbursement-requests", () =>
        HttpResponse.json({ items: [], page: 1, pageSize: 20, total: 0, totalPages: 0 }),
      ),
    );

    const { queryClient } = renderWithProviders(
      [{ path: "/requests", element: <RequestsListPage /> }],
      ["/requests"],
    );

    await screen.findByText(/no requests match/i);

    const [query] = queryClient.getQueryCache().findAll({ queryKey: ["requests"] });
    const options = query?.options as { refetchInterval?: number } | undefined;
    expect(options?.refetchInterval).toBe(5000);
  });

  it("polls a request's detail every 5 seconds", async () => {
    server.use(
      http.get("/api/disbursement-requests/req-1", () =>
        HttpResponse.json({
          id: "req-1",
          externalReference: "REF-1",
          supplierId: "s1",
          supplier: { id: "s1", taxId: "TAX-1", name: "Acme" },
          amount: "10.00",
          currency: "USD",
          concept: "Test",
          status: "PENDING",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
          decision: null,
        }),
      ),
    );

    const { queryClient } = renderWithProviders(
      [{ path: "/requests/:id", element: <RequestDetailPage /> }],
      ["/requests/req-1"],
    );

    await screen.findByText("REF-1");

    const [query] = queryClient.getQueryCache().findAll({ queryKey: ["requests", "req-1"] });
    const options = query?.options as { refetchInterval?: number } | undefined;
    expect(options?.refetchInterval).toBe(5000);
  });
});
