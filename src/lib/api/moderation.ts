import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { api, unwrap } from "./client";
import type { components, paths } from "./schema";

/** Статус заявки модерации (вкладка): `PENDING | APPROVED | REJECTED`. */
export type ModerationStatus = components["schemas"]["ModerationStatus"];

/** Тип субъекта заявки: `MASTER | SALON`. */
export type ModerationSubjectType =
  components["schemas"]["ModerationSubjectType"];

/** Одна заявка в списке модерации. */
export type ModerationListItem = components["schemas"]["ModerationListItem"];

/** Админ-обработчик заявки (`reviewed_by`). */
export type ModerationReviewer = components["schemas"]["ModerationReviewer"];

/** Страница списка (items + курсор offset/limit + has_more). */
export type ModerationRequestPage =
  components["schemas"]["ModerationRequestPage"];

/** Результат решения по заявке (approve/reject). */
export type ModerationDecision = components["schemas"]["ModerationDecision"];

/** Допустимое значение сортировки (`submitted_at:asc|desc`) — из спека. */
export type ModerationSort = NonNullable<
  NonNullable<
    paths["/api/admin/moderation/requests"]["get"]["parameters"]["query"]
  >["sort"]
>;

/** Параметры списка (вкладка/фильтры/поиск/сортировка/пагинация). */
export interface ModerationListParams {
  /** Статус заявок для выбранной вкладки. */
  status?: ModerationStatus;
  /** Фильтр по ролям (OR): мастера и/или салоны. */
  role?: ModerationSubjectType[];
  /** Фильтр по городам (OR). */
  city?: string[];
  query?: string;
  offset?: number;
  limit?: number;
  sort?: ModerationSort;
}

/** Ключи запросов TanStack Query для очереди модерации. */
export const moderationKeys = {
  all: ["moderation"] as const,
  list: (params: ModerationListParams) =>
    [...moderationKeys.all, "list", params] as const,
};

/**
 * Список заявок модерации с пагинацией.
 * `GET /api/admin/moderation/requests`, раздел прав `MASTERS_SALONS: READ`.
 */
export const getModerationRequests = async (
  params: ModerationListParams,
): Promise<ModerationRequestPage> => {
  const res = await api.GET("/api/admin/moderation/requests", {
    params: { query: params },
  });
  return unwrap(res)!;
};

/**
 * Одобрить заявку (тело не требуется).
 * `POST /api/admin/moderation/requests/{requestId}/approve`, права `MASTERS_SALONS: FULL`.
 */
export const approveModerationRequest = async (
  requestId: number,
): Promise<ModerationDecision> => {
  const res = await api.POST(
    "/api/admin/moderation/requests/{requestId}/approve",
    { params: { path: { requestId } } },
  );
  return unwrap(res)!;
};

/**
 * Отклонить заявку с обязательным комментарием (1–1000 символов).
 * `POST /api/admin/moderation/requests/{requestId}/reject`, права `MASTERS_SALONS: FULL`.
 */
export const rejectModerationRequest = async (
  requestId: number,
  comment: string,
): Promise<ModerationDecision> => {
  const res = await api.POST(
    "/api/admin/moderation/requests/{requestId}/reject",
    { params: { path: { requestId } }, body: { comment } },
  );
  return unwrap(res)!;
};

/* ------------------------------------------------- хуки React Query */

/**
 * Список заявок модерации. Пока грузится следующая страница/вкладка — держит
 * предыдущие данные (`keepPreviousData`), чтобы таблица не мигала.
 */
export const useModerationRequests = (params: ModerationListParams) =>
  useQuery({
    queryKey: moderationKeys.list(params),
    queryFn: () => getModerationRequests(params),
    placeholderData: keepPreviousData,
  });

/** Одобрение заявки; при успехе обновляет все вкладки очереди. */
export const useApproveModerationRequest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (requestId: number) => approveModerationRequest(requestId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: moderationKeys.all });
    },
  });
};

/** Отклонение заявки с комментарием; при успехе обновляет все вкладки очереди. */
export const useRejectModerationRequest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ requestId, comment }: { requestId: number; comment: string }) =>
      rejectModerationRequest(requestId, comment),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: moderationKeys.all });
    },
  });
};
