import { createBrowserRouter, Navigate } from "react-router-dom";
import { LoginPage } from "./LoginPage";
import { NewRequestPage } from "./NewRequestPage";
import { RequestDetailPage } from "./RequestDetailPage";
import { RequestsListPage } from "./RequestsListPage";

export const router = createBrowserRouter([
  { path: "/", element: <Navigate to="/requests" replace /> },
  { path: "/login", element: <LoginPage /> },
  { path: "/requests", element: <RequestsListPage /> },
  { path: "/requests/new", element: <NewRequestPage /> },
  { path: "/requests/:id", element: <RequestDetailPage /> },
]);
