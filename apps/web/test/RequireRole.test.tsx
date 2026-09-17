import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { AuthProvider } from "../src/auth/AuthContext";
import { RequireRole } from "../src/auth/RequireRole";
import { clearSession, saveSession } from "../src/auth/session";

function renderAnalystOnly(initialPath: string) {
  const router = createMemoryRouter(
    [
      { path: "/requests", element: <div>Requests list</div> },
      {
        element: <RequireRole role="ANALYST" />,
        children: [{ path: "/requests/new", element: <div>New request form</div> }],
      },
    ],
    { initialEntries: [initialPath] },
  );

  return render(
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>,
  );
}

describe("RequireRole", () => {
  afterEach(() => {
    clearSession();
  });

  it("redirects a user with a mismatched role away from the protected route", () => {
    saveSession({ token: "t", role: "SUPERVISOR", username: "supervisor.demo" });

    renderAnalystOnly("/requests/new");

    expect(screen.getByText("Requests list")).toBeInTheDocument();
    expect(screen.queryByText("New request form")).not.toBeInTheDocument();
  });

  it("renders the outlet for a user with the matching role", () => {
    saveSession({ token: "t", role: "ANALYST", username: "analyst.demo" });

    renderAnalystOnly("/requests/new");

    expect(screen.getByText("New request form")).toBeInTheDocument();
  });
});
