import { createBrowserRouter, Navigate } from "react-router-dom";
import { registerNavigator } from "../api/navigation";
import { RequireAuth } from "../auth/RequireAuth";
import { RequireRole } from "../auth/RequireRole";
import { LoginPage } from "./LoginPage";
import { NewRequestPage } from "./NewRequestPage";
import { RequestDetailPage } from "./RequestDetailPage";
import { RequestsListPage } from "./RequestsListPage";

export const router = createBrowserRouter([
  { path: "/", element: <Navigate to="/requests" replace /> },
  { path: "/login", element: <LoginPage /> },
  {
    element: <RequireAuth />,
    children: [
      { path: "/requests", element: <RequestsListPage /> },
      { path: "/requests/:id", element: <RequestDetailPage /> },
      {
        element: <RequireRole role="ANALYST" />,
        children: [{ path: "/requests/new", element: <NewRequestPage /> }],
      },
    ],
  },
]);

// Lets api/client.ts force a navigation to /login on a 401 without importing
// this module (and the route tree it pulls in) directly — see navigation.ts.
registerNavigator((path) => {
  void router.navigate(path);
});
