import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { AuthProvider } from "../src/auth/AuthContext";
import { RequireAuth } from "../src/auth/RequireAuth";
import { clearSession, saveSession } from "../src/auth/session";

function renderProtected(initialPath: string) {
  const router = createMemoryRouter(
    [
      { path: "/login", element: <div>Login page</div> },
      {
        element: <RequireAuth />,
        children: [{ path: "/protected", element: <div>Protected content</div> }],
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

describe("RequireAuth", () => {
  afterEach(() => {
    clearSession();
  });

  it("redirects to /login when there is no session", () => {
    renderProtected("/protected");

    expect(screen.getByText("Login page")).toBeInTheDocument();
    expect(screen.queryByText("Protected content")).not.toBeInTheDocument();
  });

  it("renders the protected content and user info when a session exists", () => {
    saveSession({ token: "t", role: "ANALYST", username: "analyst.demo" });

    renderProtected("/protected");

    expect(screen.getByText("Protected content")).toBeInTheDocument();
    expect(screen.getByText(/analyst\.demo/)).toBeInTheDocument();
    expect(screen.getByText(/ANALYST/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /log out/i })).toBeInTheDocument();
  });
});
