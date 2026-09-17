import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { NewRequestPage } from "../src/routes/NewRequestPage";
import { server } from "./mocks/server";
import { renderWithProviders } from "./testUtils";

const routes = [
  { path: "/requests/new", element: <NewRequestPage /> },
  { path: "/requests/:id", element: <div>Detail for request</div> },
];

const SUPPLIER_ID = "11111111-1111-4111-8111-111111111111";

function mockSuppliers() {
  server.use(
    http.get("/api/suppliers", () =>
      HttpResponse.json([{ id: SUPPLIER_ID, taxId: "TAX-0001", name: "Acme Logistics SA" }]),
    ),
  );
}

async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  await screen.findByLabelText(/supplier/i);
  await user.selectOptions(screen.getByLabelText(/supplier/i), SUPPLIER_ID);
  await user.type(screen.getByLabelText(/external reference/i), "REF-NEW");
  await user.type(screen.getByLabelText(/amount/i), "50.00");
  await user.type(screen.getByLabelText(/currency/i), "usd");
  await user.type(screen.getByLabelText(/concept/i), "New invoice");
}

describe("NewRequestPage", () => {
  it("shows a client-side validation error without calling the API when required fields are missing", async () => {
    mockSuppliers();
    let createCalled = false;
    server.use(
      http.post("/api/disbursement-requests", () => {
        createCalled = true;
        return HttpResponse.json({}, { status: 201 });
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(routes, ["/requests/new"]);

    await screen.findByLabelText(/supplier/i);
    await user.click(screen.getByRole("button", { name: /create request/i }));

    const alerts = await screen.findAllByRole("alert");
    expect(alerts.some((alert) => /select a supplier/i.test(alert.textContent ?? ""))).toBe(true);
    expect(createCalled).toBe(false);
  });

  it("creates a request and navigates to its detail page on success", async () => {
    mockSuppliers();
    server.use(
      http.post("/api/disbursement-requests", () =>
        HttpResponse.json(
          {
            id: "new-request-id",
            externalReference: "REF-NEW",
            supplierId: SUPPLIER_ID,
            supplier: { id: SUPPLIER_ID, taxId: "TAX-0001", name: "Acme Logistics SA" },
            amount: "50.00",
            currency: "USD",
            concept: "New invoice",
            status: "PENDING",
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
            idempotentReplay: false,
          },
          { status: 201 },
        ),
      ),
    );

    const user = userEvent.setup();
    renderWithProviders(routes, ["/requests/new"]);

    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: /create request/i }));

    expect(await screen.findByText("Detail for request")).toBeInTheDocument();
  });

  it("shows a server-side error message when creation fails", async () => {
    mockSuppliers();
    server.use(
      http.post("/api/disbursement-requests", () =>
        HttpResponse.json(
          { error: { code: "SUPPLIER_NOT_FOUND", message: "Supplier not found", correlationId: "x" } },
          { status: 404 },
        ),
      ),
    );

    const user = userEvent.setup();
    renderWithProviders(routes, ["/requests/new"]);

    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: /create request/i }));

    expect(await screen.findByText("Supplier not found")).toBeInTheDocument();
  });
});
