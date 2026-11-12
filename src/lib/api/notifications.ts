import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { api, unwrap } from "./client";
import type { components, paths } from "./schema";

/** Уведомление админки (полная запись). */
export type AdminNotification = components["schemas"]["AdminNotification"];

/** Страница списка (items + курсор offset/limit + has_more). */
export type AdminNotificationPage =
  components["schemas"]["AdminNotificationPage"];

/** Тело создания уведомления. */
export type CreateAdminNotificationBody =
  components["schemas"]["CreateAdminNotificationBody"];

/** Тело частичного обновления уведомления. */
export type UpdateAdminNotificationBody =
  components["schemas"]["UpdateAdminNotificationBody"];

/** Режим исполнения: `CONTINUOUS` (Общие) / `SCHEDULED_ONCE` (Рассылки). */
export type NotificationExecutionMode =
  components["schemas"]["NotificationExecutionMode"];

/** Событие-триггер (`USER_REGISTERED`, `RECORD_CREATED` …). */
export type NotificationEvent = components["schemas"]["NotificationEvent"];

/** Тайминг триггера: `IMMEDIATELY` / `AFTER` / `BEFORE`. */
export type NotificationTriggerTiming =
  components["schemas"]["NotificationTriggerTiming"];

/** Единица задержки: `MINUTES` / `HOURS` / `DAYS`. */
export type NotificationDelayUnit =
  components["schemas"]["NotificationDelayUnit"];

/** Оператор условия: `OCCURRED` / `NOT_OCCURRED`. */
export type NotificationConditionOperator =
  components["schemas"]["NotificationConditionOperator"];

/** Аудитория: `ALL` / `CLIENTS` / `MASTERS` / `SALONS`. */
export type NotificationAudience = components["schemas"]["NotificationAudience"];

/** Канал доставки: `IN_APP` / `PUSH` / `EMAIL`. */
export type NotificationChannel = components["schemas"]["NotificationChannel"];

/** Параметры списка (вкладка/поиск/пагинация). */
export interface NotificationsListParams {
  /** Режим для выбранной вкладки: CONTINUOUS (Общие) / SCHEDULED_ONCE (Рассылки). */
  mode?: NotificationExecutionMode;
  query?: string;
  offset?: number;
  limit?: number;
}

/** Ключи запросов TanStack Query для раздела «Уведомления». */
export const notificationsKeys = {
  all: ["notifications"] as const,
  list: (params: NotificationsListParams) =>
    [...notificationsKeys.all, "list", params] as const,
  detail: (id: number) => [...notificationsKeys.all, "detail", id] as const,
};

/**
 * Список уведомлений с пагинацией.
 * `GET /api/admin/notifications`, раздел прав `NOTIFICATIONS: READ`.
 */
export const getNotifications = async (
  params: NotificationsListParams,
): Promise<AdminNotificationPage> => {
  const res = await api.GET("/api/admin/notifications", {
    params: {
      query: params as NonNullable<
        paths["/api/admin/notifications"]["get"]["parameters"]["query"]
      >,
    },
  });
  return unwrap(res)!;
};

/**
 * Одно уведомление по id.
 * `GET /api/admin/notifications/{id}`, раздел прав `NOTIFICATIONS: READ`.
 */
export const getNotification = async (
  id: number,
): Promise<AdminNotification> => {
  const res = await api.GET("/api/admin/notifications/{id}", {
    params: { path: { id } },
  });
  return unwrap(res)!;
};

/**
 * Создать уведомление.
 * `POST /api/admin/notifications`, раздел прав `NOTIFICATIONS: FULL`.
 */
export const createNotification = async (
  body: CreateAdminNotificationBody,
): Promise<AdminNotification> => {
  const res = await api.POST("/api/admin/notifications", { body });
  return unwrap(res)!;
};

/**
 * Обновить уведомление (частично; передаётся хотя бы одно поле).
 * `PATCH /api/admin/notifications/{id}`, раздел прав `NOTIFICATIONS: FULL`.
 */
export const updateNotification = async (
  id: number,
  body: UpdateAdminNotificationBody,
): Promise<AdminNotification> => {
  const res = await api.PATCH("/api/admin/notifications/{id}", {
    params: { path: { id } },
    body,
  });
  return unwrap(res)!;
};

/**
 * Удалить уведомление.
 * `DELETE /api/admin/notifications/{id}`, раздел прав `NOTIFICATIONS: FULL`.
 */
export const deleteNotification = async (id: number): Promise<void> => {
  unwrap(
    await api.DELETE("/api/admin/notifications/{id}", {
      params: { path: { id } },
    }),
  );
};

/* ------------------------------------------------- хуки React Query */

/**
 * Список уведомлений. Пока грузится следующая страница/вкладка — держит
 * предыдущие данные (`keepPreviousData`), чтобы таблица не мигала.
 */
export const useNotifications = (params: NotificationsListParams) =>
  useQuery({
    queryKey: notificationsKeys.list(params),
    queryFn: () => getNotifications(params),
    placeholderData: keepPreviousData,
  });

/** Одно уведомление; запрос идёт только при заданном `id`. */
export const useNotification = (id: number | null) =>
  useQuery({
    queryKey: notificationsKeys.detail(id ?? 0),
    queryFn: () => getNotification(id as number),
    enabled: id != null,
  });

/** Создание уведомления; при успехе обновляет списки. */
export const useCreateNotification = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateAdminNotificationBody) => createNotification(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationsKeys.all });
    },
  });
};

/** Обновление уведомления; при успехе обновляет списки. */
export const useUpdateNotification = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: number;
      body: UpdateAdminNotificationBody;
    }) => updateNotification(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationsKeys.all });
    },
  });
};

/** Удаление уведомления; при успехе обновляет списки. */
export const useDeleteNotification = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteNotification(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationsKeys.all });
    },
  });
};
