import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { createMemoryRouter, RouterProvider, type RouteObject } from "react-router-dom";
import { AuthProvider } from "../src/auth/AuthContext";

export function renderWithProviders(routes: RouteObject[], initialEntries: string[] = ["/"]) {
  // A fresh, isolated QueryClient per render — no retries, so error-state
  // assertions in tests don't have to wait out the app's real retry policy.
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const router = createMemoryRouter(routes, { initialEntries });

  const utils = render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>,
  );

  return { ...utils, router, queryClient };
}
