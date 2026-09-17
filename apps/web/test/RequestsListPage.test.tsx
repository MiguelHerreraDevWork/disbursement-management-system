import { screen } from "@testing-library/react";
import { http, HttpResponse, type JsonBodyType } from "msw";
import { afterEach, describe, expect, it } from "vitest";
import { clearSession, saveSession } from "../src/auth/session";
import { RequestsListPage } from "../src/routes/RequestsListPage";
import { server } from "./mocks/server";
import { renderWithProviders } from "./testUtils";

const routes = [{ path: "/requests", element: <RequestsListPage /> }];

function mockList(body: JsonBodyType, status = 200) {
  server.use(http.get("/api/disbursement-requests", () => HttpResponse.json(body, { status })));
}

const emptyPage = { items: [], page: 1, pageSize: 20, total: 0, totalPages: 0 };

describe("RequestsListPage", () => {
  afterEach(() => {
    clearSession();
  });

  it("shows a loading state, then the fetched requests", async () => {
    mockList({
      items: [
        {
          id: "r1",
          externalReference: "REF-1",
          supplierId: "s1",
          supplier: { id: "s1", taxId: "TAX-1", name: "Acme Logistics" },
          amount: "100.00",
          currency: "USD",
          concept: "Test invoice",
          status: "PENDING",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      page: 1,
      pageSize: 20,
      total: 1,
      totalPages: 1,
    });

    renderWithProviders(routes, ["/requests"]);

    expect(screen.getByText(/loading requests/i)).toBeInTheDocument();

    expect(await screen.findByText("REF-1")).toBeInTheDocument();
    expect(screen.getByText("Acme Logistics")).toBeInTheDocument();
    expect(screen.getByText("PENDING")).toBeInTheDocument();
  });

  it("shows an empty-state message when there are no matching requests", async () => {
    mockList(emptyPage);

    renderWithProviders(routes, ["/requests"]);

    expect(await screen.findByText(/no requests match these filters/i)).toBeInTheDocument();
  });

  it("shows an error state with a retry action on a failed fetch", async () => {
    mockList({ error: { code: "INTERNAL_ERROR", message: "Something broke", correlationId: "x" } }, 500);

    renderWithProviders(routes, ["/requests"]);

    expect(await screen.findByRole("alert")).toHaveTextContent("Something broke");
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });

  it("hides the 'New request' link for a SUPERVISOR session", async () => {
    mockList(emptyPage);
    saveSession({ token: "t", role: "SUPERVISOR", username: "supervisor.demo" });

    renderWithProviders(routes, ["/requests"]);
    await screen.findByText(/no requests match/i);

    expect(screen.queryByRole("link", { name: /new request/i })).not.toBeInTheDocument();
  });

  it("shows the 'New request' link for an ANALYST session", async () => {
    mockList(emptyPage);
    saveSession({ token: "t", role: "ANALYST", username: "analyst.demo" });

    renderWithProviders(routes, ["/requests"]);
    await screen.findByText(/no requests match/i);

    expect(screen.getByRole("link", { name: /new request/i })).toBeInTheDocument();
  });
});
