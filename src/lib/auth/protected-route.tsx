import { Navigate, Outlet } from "react-router-dom";

import { ROUTES } from "@/lib/routes";
import { useAuth } from "./use-auth";

/** Пускает во вложенные роуты только при наличии токена, иначе → на логин. */
export function ProtectedRoute() {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to={ROUTES.login} replace />;
  return <Outlet />;
}
