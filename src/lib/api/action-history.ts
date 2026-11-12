import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { api, unwrap } from "./client";
import type { components } from "./schema";

/** Одна запись журнала действий. */
export type AdminActionHistoryItem =
  components["schemas"]["AdminActionHistoryItem"];

/** Страница журнала действий (items + курсор offset/limit + has_more). */
export type AdminActionHistoryPage =
  components["schemas"]["AdminActionHistoryPage"];

/** Параметры выборки истории. `from`/`to` — даты `YYYY-MM-DD` (обязательны). */
export interface ActionHistoryParams {
  from: string;
  to: string;
  query?: string;
  offset?: number;
  limit?: number;
}

/** Ключи запросов TanStack Query для истории действий. */
export const actionHistoryKeys = {
  all: ["action-history"] as const,
  page: (params: ActionHistoryParams) =>
    [...actionHistoryKeys.all, params] as const,
};

/**
 * История действий сотрудников за период (от новых к старым).
 * `GET /api/admin/action-history`, раздел прав `ACTION_HISTORY: READ`.
 */
export const getActionHistory = async (
  params: ActionHistoryParams,
): Promise<AdminActionHistoryPage> => {
  const res = await api.GET("/api/admin/action-history", {
    params: { query: params },
  });
  // `data` в спеке помечен опциональным, но на success всегда присутствует.
  return unwrap(res)!;
};

/* ------------------------------------------------- хуки React Query */

/**
 * Страница истории действий. Пока грузится следующая страница/фильтр —
 * держит предыдущие данные (`keepPreviousData`), чтобы таблица не мигала.
 */
export const useActionHistory = (params: ActionHistoryParams) =>
  useQuery({
    queryKey: actionHistoryKeys.page(params),
    queryFn: () => getActionHistory(params),
    placeholderData: keepPreviousData,
  });
