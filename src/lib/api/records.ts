import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { api, unwrap } from "./client";
import type { components } from "./schema";

/** Статистика записей за период (значения + дельта к прошлому периоду). */
export type AdminRecordStatsData =
  components["schemas"]["AdminRecordStatsData"];

/** Один элемент списка записей. */
export type AdminRecordListItem =
  components["schemas"]["AdminRecordListItem"];

/** Страница списка записей (items + курсор offset/limit + has_more). */
export type AdminRecordListData =
  components["schemas"]["AdminRecordListData"];

/** Детали записи (шапка модалки «Информация по заказу»). */
export type AdminRecordDetailsData =
  components["schemas"]["AdminRecordDetailsData"];

/**
 * Статус записи в админ-API (`BOOKED | WAITING_ACTION | COMPLETED | CANCELED`).
 * Отличается от клиентского `RecordStatus`: внутренний `WAITING_FOR_PAYMENT`
 * в админку не публикуется, вместо него — `WAITING_ACTION`.
 */
export type RecordStatus = components["schemas"]["AdminRecordStatus"];

/** Параметры статистики. `from`/`to` — даты `YYYY-MM-DD` (обязательны). */
export interface RecordsStatsParams {
  from: string;
  to: string;
}

/** Параметры списка записей (поиск/фильтры/сортировка/пагинация). */
export interface RecordsListParams {
  from: string;
  to: string;
  query?: string;
  /** Фильтр по городам (OR). */
  city?: string[];
  /** Фильтр по статусам (OR). */
  status?: RecordStatus[];
  /** Нижняя граница даты оплаты (`YYYY-MM-DD`, включительно, TZ Europe/Minsk). */
  paid_from?: string;
  /** Верхняя граница даты оплаты (`YYYY-MM-DD`, включительно, TZ Europe/Minsk). */
  paid_to?: string;
  offset?: number;
  limit?: number;
  /** Сортировка вида `start_at:desc` (поля start_at|paid_at|service_price). */
  sort?: string[];
}

/** Ключи запросов TanStack Query для раздела «Записи». */
export const recordsKeys = {
  all: ["records"] as const,
  stats: (params: RecordsStatsParams) =>
    [...recordsKeys.all, "stats", params] as const,
  list: (params: RecordsListParams) =>
    [...recordsKeys.all, "list", params] as const,
  detail: (id: number) => [...recordsKeys.all, "detail", id] as const,
};

/**
 * Статистика записей за период.
 * `GET /api/admin/records/stats`, раздел прав `RECORDS: READ`.
 */
export const getRecordsStats = async (
  params: RecordsStatsParams,
): Promise<AdminRecordStatsData> => {
  const res = await api.GET("/api/admin/records/stats", {
    params: { query: params },
  });
  // `data` в спеке помечен опциональным, но на success всегда присутствует.
  return unwrap(res)!;
};

/**
 * Список записей с пагинацией.
 * `GET /api/admin/records`, раздел прав `RECORDS: READ`.
 */
export const getRecords = async (
  params: RecordsListParams,
): Promise<AdminRecordListData> => {
  const res = await api.GET("/api/admin/records", {
    params: { query: params },
  });
  // `data` в спеке помечен опциональным, но на success всегда присутствует.
  return unwrap(res)!;
};

/**
 * Детали одной записи.
 * `GET /api/admin/records/{recordId}`, раздел прав `RECORDS: READ`.
 */
export const getRecord = async (
  recordId: number,
): Promise<AdminRecordDetailsData> => {
  const res = await api.GET("/api/admin/records/{recordId}", {
    params: { path: { recordId } },
  });
  return unwrap(res)!;
};

/**
 * Отменить запись администратором с указанием причины.
 * `POST /api/admin/records/{recordId}/cancel`, раздел прав `RECORDS: FULL`.
 */
export const cancelRecord = async (
  recordId: number,
  reason: string,
): Promise<void> => {
  const res = await api.POST("/api/admin/records/{recordId}/cancel", {
    params: { path: { recordId } },
    body: { reason },
  });
  unwrap(res);
};

/* ------------------------------------------------- хуки React Query */

/** Статистика записей за период. */
export const useRecordsStats = (params: RecordsStatsParams) =>
  useQuery({
    queryKey: recordsKeys.stats(params),
    queryFn: () => getRecordsStats(params),
  });

/**
 * Список записей. Пока грузится следующая страница/фильтр — держит предыдущие
 * данные (`keepPreviousData`), чтобы таблица не мигала.
 */
export const useRecords = (params: RecordsListParams) =>
  useQuery({
    queryKey: recordsKeys.list(params),
    queryFn: () => getRecords(params),
    placeholderData: keepPreviousData,
  });

/** Детали записи. Запрос не идёт, пока `recordId` не задан. */
export const useRecord = (recordId: number | null) =>
  useQuery({
    queryKey: recordsKeys.detail(recordId ?? 0),
    queryFn: () => getRecord(recordId as number),
    enabled: recordId != null,
  });

/** Отмена записи; при успехе обновляет список и статистику. */
export const useCancelRecord = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) =>
      cancelRecord(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: recordsKeys.all });
    },
  });
};
