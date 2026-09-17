import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { AuthProvider } from "../src/auth/AuthContext";
import { clearSession } from "../src/auth/session";
import { LoginPage } from "../src/routes/LoginPage";
import { server } from "./mocks/server";

function renderLoginPage() {
  const router = createMemoryRouter(
    [
      { path: "/login", element: <LoginPage /> },
      { path: "/requests", element: <div>Requests page</div> },
    ],
    { initialEntries: ["/login"] },
  );

  return render(
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>,
  );
}

describe("LoginPage", () => {
  afterEach(() => {
    clearSession();
  });

  it("logs in and navigates to /requests on success", async () => {
    server.use(
      http.post("/api/auth/login", () =>
        HttpResponse.json({ token: "t", role: "ANALYST", username: "analyst.demo" }),
      ),
    );

    const user = userEvent.setup();
    renderLoginPage();

    await user.type(screen.getByLabelText(/username/i), "analyst.demo");
    await user.type(screen.getByLabelText(/password/i), "Demo-Pass-1234!");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByText("Requests page")).toBeInTheDocument();
  });

  it("shows an error message and stays on the login page for invalid credentials", async () => {
    server.use(
      http.post("/api/auth/login", () =>
        HttpResponse.json(
          { error: { code: "INVALID_CREDENTIALS", message: "Invalid username or password", correlationId: "x" } },
          { status: 401 },
        ),
      ),
    );

    const user = userEvent.setup();
    renderLoginPage();

    await user.type(screen.getByLabelText(/username/i), "analyst.demo");
    await user.type(screen.getByLabelText(/password/i), "wrong");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid username or password");
    expect(screen.getByRole("heading", { name: /login/i })).toBeInTheDocument();
  });
});
