import { Navigate, Outlet } from "react-router-dom";

import { getPostLoginRoute } from "./last-route";
import { useAuth } from "./use-auth";

/**
 * Экраны авторизации: пользователя с активной сессией (есть токен) сразу
 * уводим внутрь приложения — на последний открытый экран, иначе на дефолтный.
 */
export function PublicOnlyRoute() {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) return <Navigate to={getPostLoginRoute()} replace />;
  return <Outlet />;
}
