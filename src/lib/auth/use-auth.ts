import { logout } from "@/lib/api";
import { selectIsAuthenticated, useAuthStore } from "./auth-store";

/** Хук авторизации для компонентов: статус входа + выход. */
export function useAuth() {
  const isAuthenticated = useAuthStore(selectIsAuthenticated);
  return { isAuthenticated, logout };
}
