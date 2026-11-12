import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { api, unwrap } from "./client";
import type { components } from "./schema";

/** Статистика клиентов за период (значения + дельты к прошлому периоду). */
export type AdminClientStatsData =
  components["schemas"]["AdminClientStatsData"];

/** Один клиент в списке. */
export type AdminClientListItem =
  components["schemas"]["AdminClientListItem"];

/** Страница списка клиентов (items + курсор offset/limit + has_more). */
export type AdminClientListData =
  components["schemas"]["AdminClientListData"];

/** Статус клиента в API. */
export type AdminClientStatus = AdminClientListItem["status"];

/** Данные клиента (карточка/детали). */
export type AdminClientDetails =
  components["schemas"]["AdminClientDetails"];

/** Тело частичного обновления клиента (минимум одно поле). */
export type AdminClientUpdateRequest =
  components["schemas"]["AdminClientUpdateRequest"];

/** Один личный чат клиента в списке (dialog_id + имя собеседника). */
export type AdminClientChatItem =
  components["schemas"]["AdminClientChatItem"];

/** Страница списка чатов клиента (items + курсор offset/limit + has_more). */
export type AdminClientChatListData =
  components["schemas"]["AdminClientChatListData"];

/** История одного чата клиента (участник-клиент + сообщения + курсор). */
export type AdminClientChatHistoryData =
  components["schemas"]["AdminClientChatHistoryData"];

/** Одно сообщение в истории чата клиента. */
export type AdminClientChatMessage =
  components["schemas"]["AdminClientChatMessage"];

/** Параметры статистики. `from`/`to` — даты `YYYY-MM-DD` (обязательны). */
export interface ClientsStatsParams {
  from: string;
  to: string;
}

/** Параметры списка клиентов (поиск/фильтры/сортировка/пагинация). */
export interface ClientsListParams {
  from: string;
  to: string;
  query?: string;
  /** Фильтр по городам (OR). */
  city?: string[];
  /** Фильтр по статусам (OR). */
  status?: AdminClientStatus[];
  offset?: number;
  limit?: number;
  /** Сортировка вида `registered_at:desc` (до 3 полей). */
  sort?: string[];
}

/** Ключи запросов TanStack Query для раздела «Пользователи». */
export const clientsKeys = {
  all: ["clients"] as const,
  stats: (params: ClientsStatsParams) =>
    [...clientsKeys.all, "stats", params] as const,
  list: (params: ClientsListParams) =>
    [...clientsKeys.all, "list", params] as const,
  detail: (id: number) => [...clientsKeys.all, "detail", id] as const,
  chats: (clientId: number) =>
    [...clientsKeys.all, "chats", clientId] as const,
  chatMessages: (dialogId: number) =>
    [...clientsKeys.all, "chat-messages", dialogId] as const,
};

/**
 * Статистика клиентов за период.
 * `GET /api/admin/clients/stats`, раздел прав `CLIENTS: READ`.
 */
export const getClientsStats = async (
  params: ClientsStatsParams,
): Promise<AdminClientStatsData> => {
  const res = await api.GET("/api/admin/clients/stats", {
    params: { query: params },
  });
  // `data` в спеке помечен опциональным, но на success всегда присутствует.
  return unwrap(res)!;
};

/**
 * Список клиентов с пагинацией.
 * `GET /api/admin/clients`, раздел прав `CLIENTS: READ`.
 */
export const getClients = async (
  params: ClientsListParams,
): Promise<AdminClientListData> => {
  const res = await api.GET("/api/admin/clients", {
    params: { query: params },
  });
  // `data` в спеке помечен опциональным, но на success всегда присутствует.
  return unwrap(res)!;
};

/**
 * Данные одного клиента.
 * `GET /api/admin/clients/{id}`, раздел прав `CLIENTS: READ`.
 */
export const getClient = async (id: number): Promise<AdminClientDetails> => {
  const res = await api.GET("/api/admin/clients/{id}", {
    params: { path: { id } },
  });
  return unwrap(res)!;
};

/**
 * Изменить данные клиента (частично).
 * `PATCH /api/admin/clients/{id}`, раздел прав `CLIENTS: FULL`.
 */
export const updateClient = async (
  id: number,
  body: AdminClientUpdateRequest,
): Promise<AdminClientDetails> => {
  const res = await api.PATCH("/api/admin/clients/{id}", {
    params: { path: { id } },
    body,
  });
  return unwrap(res)!;
};

/**
 * Заблокировать клиента с указанием причины.
 * `POST /api/admin/clients/{id}/block`, раздел прав `CLIENTS: FULL`.
 */
export const blockClient = async (
  id: number,
  reason: string,
): Promise<void> => {
  const res = await api.POST("/api/admin/clients/{id}/block", {
    params: { path: { id } },
    body: { reason },
  });
  unwrap(res);
};

/**
 * Разблокировать клиента.
 * `POST /api/admin/clients/{id}/unblock`, раздел прав `CLIENTS: FULL`.
 */
export const unblockClient = async (id: number): Promise<void> => {
  const res = await api.POST("/api/admin/clients/{id}/unblock", {
    params: { path: { id } },
  });
  unwrap(res);
};

/**
 * Список личных чатов клиента (диалоги с мастерами/салонами), отсортирован
 * по времени последнего сообщения.
 * `GET /api/admin/clients/{clientId}/chats`, раздел прав `CLIENTS: READ`.
 */
export const getClientChats = async (
  clientId: number,
  params?: { offset?: number; limit?: number },
): Promise<AdminClientChatListData> => {
  const res = await api.GET("/api/admin/clients/{clientId}/chats", {
    params: { path: { clientId }, query: params },
  });
  return unwrap(res)!;
};

/**
 * История конкретного чата клиента с мастером/салоном (чаты с поддержкой
 * недоступны — бэкенд отдаёт `403`).
 * `GET /api/admin/clients/chats/{dialogId}/messages`, раздел прав `CLIENTS: READ`.
 */
export const getClientChatMessages = async (
  dialogId: number,
  params?: { beforeId?: number; offset?: number; limit?: number },
): Promise<AdminClientChatHistoryData> => {
  const res = await api.GET("/api/admin/clients/chats/{dialogId}/messages", {
    params: { path: { dialogId }, query: params },
  });
  return unwrap(res)!;
};

/* ------------------------------------------------- хуки React Query */

/** Статистика клиентов за период. */
export const useClientsStats = (params: ClientsStatsParams) =>
  useQuery({
    queryKey: clientsKeys.stats(params),
    queryFn: () => getClientsStats(params),
  });

/**
 * Список клиентов. Пока грузится следующая страница/фильтр — держит
 * предыдущие данные (`keepPreviousData`), чтобы таблица не мигала.
 */
export const useClients = (params: ClientsListParams) =>
  useQuery({
    queryKey: clientsKeys.list(params),
    queryFn: () => getClients(params),
    placeholderData: keepPreviousData,
  });

/** Данные клиента. Запрос не идёт, пока `id` не задан. */
export const useClient = (id: number | null) =>
  useQuery({
    queryKey: clientsKeys.detail(id ?? 0),
    queryFn: () => getClient(id as number),
    enabled: id != null,
  });

/** Список чатов клиента. Запрос не идёт, пока `clientId` не задан. */
export const useClientChats = (clientId: number | null) =>
  useQuery({
    queryKey: clientsKeys.chats(clientId ?? 0),
    queryFn: () => getClientChats(clientId as number),
    enabled: clientId != null,
  });

/** История выбранного чата клиента. Запрос не идёт, пока `dialogId` не задан. */
export const useClientChatMessages = (dialogId: number | null) =>
  useQuery({
    queryKey: clientsKeys.chatMessages(dialogId ?? 0),
    queryFn: () => getClientChatMessages(dialogId as number),
    enabled: dialogId != null,
  });

/** Изменение клиента; при успехе обновляет список и деталь. */
export const useUpdateClient = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: AdminClientUpdateRequest }) =>
      updateClient(id, body),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: clientsKeys.all });
      queryClient.setQueryData(clientsKeys.detail(updated.id), updated);
    },
  });
};

/** Блокировка клиента; при успехе обновляет список и статистику. */
export const useBlockClient = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) =>
      blockClient(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: clientsKeys.all });
    },
  });
};

/** Разблокировка клиента; при успехе обновляет список и статистику. */
export const useUnblockClient = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: unblockClient,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: clientsKeys.all });
    },
  });
};
