import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { api, unwrap } from "./client";
import type { components } from "./schema";

/** Обращение в поддержку (элемент списка и деталь). */
export type AdminSupportChat = components["schemas"]["AdminSupportChat"];

/** Страница списка обращений (chats + курсор offset/limit + has_more). */
export type AdminSupportChatList =
  components["schemas"]["AdminSupportChatList"];

/** Страница сообщений обращения. */
export type SupportMessagePage = components["schemas"]["SupportMessagePage"];

/** Одно сообщение переписки. */
export type MessageResponse = components["schemas"]["MessageResponse"];

/** Тело отправки сообщения от имени поддержки. */
export type SupportSendMessageBody =
  components["schemas"]["SupportSendMessageBody"];

/** Статус обращения (OPEN/CLOSED). */
export type SupportCaseStatus = components["schemas"]["SupportCaseStatus"];

/** Параметры списка обращений (поиск/фильтр/пагинация). */
export interface SupportChatsParams {
  query?: string;
  status?: SupportCaseStatus;
  /** Только непрочитанные. */
  unread?: boolean;
  offset?: number;
  limit?: number;
}

/** Параметры страницы сообщений (курсор `before_id` для догрузки старых). */
export interface SupportMessagesParams {
  before_id?: number;
  offset?: number;
  limit?: number;
}

/** Ключи запросов TanStack Query для раздела «Обращения». */
export const supportKeys = {
  all: ["support-chats"] as const,
  list: (params: SupportChatsParams) =>
    [...supportKeys.all, "list", params] as const,
  detail: (dialogId: number) =>
    [...supportKeys.all, "detail", dialogId] as const,
  messages: (dialogId: number, params: SupportMessagesParams) =>
    [...supportKeys.all, "messages", dialogId, params] as const,
};

/**
 * Список обращений в поддержку.
 * `GET /api/admin/support/chats`, раздел прав `SUPPORT: READ`.
 */
export const getSupportChats = async (
  params: SupportChatsParams,
): Promise<AdminSupportChatList> => {
  const res = await api.GET("/api/admin/support/chats", {
    params: { query: params },
  });
  return unwrap(res)!;
};

/**
 * Одно обращение.
 * `GET /api/admin/support/chats/{dialogId}`, раздел прав `SUPPORT: READ`.
 */
export const getSupportChat = async (
  dialogId: number,
): Promise<AdminSupportChat> => {
  const res = await api.GET("/api/admin/support/chats/{dialogId}", {
    params: { path: { dialogId } },
  });
  return unwrap(res)!;
};

/**
 * Сообщения обращения (курсорная догрузка через `before_id`).
 * `GET /api/admin/support/chats/{dialogId}/messages`, раздел прав `SUPPORT: READ`.
 */
export const getSupportMessages = async (
  dialogId: number,
  params: SupportMessagesParams = {},
): Promise<SupportMessagePage> => {
  const res = await api.GET("/api/admin/support/chats/{dialogId}/messages", {
    params: { path: { dialogId }, query: params },
  });
  return unwrap(res)!;
};

/**
 * Отправить сообщение от имени поддержки (текст и/или файлы).
 * `POST /api/admin/support/chats/{dialogId}/messages/send`, раздел прав `SUPPORT: FULL`.
 */
export const sendSupportMessage = async (
  dialogId: number,
  body: SupportSendMessageBody,
): Promise<void> => {
  const res = await api.POST(
    "/api/admin/support/chats/{dialogId}/messages/send",
    { params: { path: { dialogId } }, body },
  );
  unwrap(res);
};

/**
 * Отметить сообщения обращения прочитанными (до `last_message_id`).
 * `POST /api/admin/support/chats/{dialogId}/read`, раздел прав `SUPPORT: READ`.
 */
export const markSupportRead = async (
  dialogId: number,
  lastMessageId: number,
): Promise<void> => {
  const res = await api.POST("/api/admin/support/chats/{dialogId}/read", {
    params: { path: { dialogId } },
    body: { last_message_id: lastMessageId },
  });
  unwrap(res);
};

/**
 * Повторно открыть закрытое обращение.
 * `POST /api/admin/support/chats/{dialogId}/open`, раздел прав `SUPPORT: FULL`.
 */
export const reopenSupportChat = async (
  dialogId: number,
): Promise<AdminSupportChat> => {
  const res = await api.POST("/api/admin/support/chats/{dialogId}/open", {
    params: { path: { dialogId } },
  });
  return unwrap(res)!;
};

/**
 * Закрыть обращение (прямое закрытие админом).
 * `POST /api/admin/support/chats/{dialogId}/close`, раздел прав `SUPPORT: FULL`.
 */
export const closeSupportChat = async (
  dialogId: number,
): Promise<AdminSupportChat> => {
  const res = await api.POST("/api/admin/support/chats/{dialogId}/close", {
    params: { path: { dialogId } },
  });
  return unwrap(res)!;
};

/* ------------------------------------------------- хуки React Query */

/**
 * Список обращений. Пока грузится следующая страница/фильтр — держит предыдущие
 * данные (`keepPreviousData`), чтобы список не мигал.
 */
export const useSupportChats = (params: SupportChatsParams) =>
  useQuery({
    queryKey: supportKeys.list(params),
    queryFn: () => getSupportChats(params),
    placeholderData: keepPreviousData,
  });

/** Одно обращение. Запрос не идёт, пока `dialogId` не задан. */
export const useSupportChat = (dialogId: number | null) =>
  useQuery({
    queryKey: supportKeys.detail(dialogId ?? 0),
    queryFn: () => getSupportChat(dialogId as number),
    enabled: dialogId != null,
  });

/** Сообщения обращения. Запрос не идёт, пока `dialogId` не задан. */
export const useSupportMessages = (
  dialogId: number | null,
  params: SupportMessagesParams = {},
) =>
  useQuery({
    queryKey: supportKeys.messages(dialogId ?? 0, params),
    queryFn: () => getSupportMessages(dialogId as number, params),
    enabled: dialogId != null,
  });

/** Отправка сообщения; при успехе обновляет сообщения, обращение и список. */
export const useSendSupportMessage = (dialogId: number) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: SupportSendMessageBody) =>
      sendSupportMessage(dialogId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: supportKeys.all });
    },
  });
};

/** Отметка прочтения; при успехе обновляет обращение и список (сбрасывает счётчик). */
export const useMarkSupportRead = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      dialogId,
      lastMessageId,
    }: {
      dialogId: number;
      lastMessageId: number;
    }) => markSupportRead(dialogId, lastMessageId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: supportKeys.all });
    },
  });
};

/** Повторное открытие обращения; при успехе обновляет обращение и список. */
export const useReopenSupportChat = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: reopenSupportChat,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: supportKeys.all });
    },
  });
};

/** Закрытие обращения; при успехе обновляет обращение и список. */
export const useCloseSupportChat = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: closeSupportChat,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: supportKeys.all });
    },
  });
};
