import { useMemo } from "react";

import {
  useMyPermissions,
  type AdminEmployeePermission,
  type AdminPanelSection,
} from "@/lib/api";
import { ROUTES, type RoutePath } from "@/lib/routes";
import { useAuth } from "./use-auth";

/**
 * Маршрут → раздел прав панели (`AdminPanelSection`). Маршруты без записи
 * доступны всегда; экраны входа — публичные.
 */
export const ROUTE_SECTION: Partial<Record<RoutePath, AdminPanelSection>> = {
  [ROUTES.dashboard]: "BUSINESS_OVERVIEW",
  [ROUTES.gmv]: "BUSINESS_OVERVIEW",
  [ROUTES.revenue]: "BUSINESS_OVERVIEW",
  [ROUTES.averageCheck]: "BUSINESS_OVERVIEW",
  [ROUTES.conversion]: "BUSINESS_OVERVIEW",
  [ROUTES.users]: "CLIENTS",
  [ROUTES.masters]: "MASTERS_AND_SALONS",
  [ROUTES.mastersModeration]: "MASTERS_AND_SALONS",
  [ROUTES.appointments]: "RECORDS",
  [ROUTES.categories]: "CATEGORIES",
  [ROUTES.referral]: "REFERRAL_PROGRAM",
  [ROUTES.loyalty]: "LOYALTY_PROGRAM",
  [ROUTES.chats]: "SUPPORT",
  [ROUTES.complaints]: "COMPLAINTS",
  [ROUTES.documents]: "DOCUMENTS",
  [ROUTES.notifications]: "NOTIFICATIONS",
  [ROUTES.history]: "ACTION_HISTORY",
  [ROUTES.roles]: "ROLES",
};

type AccessLevel = AdminEmployeePermission["access_level"];

/**
 * Права текущего пользователя для фильтрации меню и маршрутов.
 *
 * ВАЖНО: клиентская фильтрация — это только UX. По-настоящему доступ проверяет
 * бэкенд на каждом эндпоинте (`x-admin-permission`), поэтому при ошибке/незагрузке
 * прав ничего не прячем (fail-open): максимум пользователь увидит пункт, по
 * которому API вернёт 403.
 */
export function usePermissions() {
  const { isAuthenticated } = useAuth();
  const { data, isLoading } = useMyPermissions(isAuthenticated);

  const levelBySection = useMemo(() => {
    const map = new Map<AdminPanelSection, AccessLevel>();
    (data ?? []).forEach((p) => map.set(p.section, p.access_level));
    return map;
  }, [data]);

  /** Права загружены (или пользователь не залогинен) — можно судить о доступе. */
  const ready = !isAuthenticated || !isLoading;

  /** Доступен ли маршрут: нет раздела → да; права не загружены → да; иначе ≠ NONE. */
  const canAccessRoute = useMemo(() => {
    return (path: string): boolean => {
      const section = ROUTE_SECTION[path as RoutePath];
      if (!section) return true;
      if (levelBySection.size === 0) return true;
      return levelBySection.get(section) !== "NONE";
    };
  }, [levelBySection]);

  return { ready, canAccessRoute };
}
