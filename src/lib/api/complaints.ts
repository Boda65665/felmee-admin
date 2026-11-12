import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { api, unwrap } from "./client";
import type { components } from "./schema";

/** Статистика жалоб за период (значения + дельты к прошлому периоду). */
export type ComplaintStats = components["schemas"]["ComplaintStats"];

/** Один элемент списка жалоб. */
export type ComplaintListItem = components["schemas"]["ComplaintListItem"];

/** Страница списка жалоб (items + курсор offset/limit + has_more). */
export type ComplaintPage = components["schemas"]["ComplaintPage"];

/** Детали жалобы (то же, что элемент списка + доступные решения). */
export type ComplaintDetails = components["schemas"]["ComplaintDetails"];

/** Снапшот отзыва на момент создания жалобы. */
export type ComplaintReviewSnapshot =
  components["schemas"]["ComplaintReviewSnapshot"];

/** Снапшот услуги на момент создания жалобы. */
export type ComplaintServiceSnapshot =
  components["schemas"]["ComplaintServiceSnapshot"];

/** Статус жалобы (OPEN/CLOSED). */
export type ComplaintStatus = components["schemas"]["ComplaintStatus"];

/** Тип объекта жалобы (USER/MASTER/SALON/SERVICE/REVIEW). */
export type ComplaintSubjectType =
  components["schemas"]["ComplaintSubjectType"];

/** Вариант решения по жалобе. */
export type ComplaintResolution = components["schemas"]["ComplaintResolution"];

/** Тело вынесения решения по жалобе. */
export type ResolveComplaintBody =
  components["schemas"]["ResolveComplaintBody"];

/** Шаблон решения: дефолтные тексты заявителю/адресату/комментария. */
export type ComplaintResolutionTemplate =
  components["schemas"]["ComplaintResolutionTemplate"];

/** Параметры статистики. `from`/`to` — даты `YYYY-MM-DD` (обязательны). */
export interface ComplaintsStatsParams {
  from: string;
  to: string;
}

/** Параметры списка жалоб (фильтры/поиск/пагинация). */
export interface ComplaintsListParams {
  from: string;
  to: string;
  /** Статус (OPEN/CLOSED) — соответствует табам «Открытые»/«Закрытые». */
  status?: ComplaintStatus;
  /** Фильтр по типам объекта (OR). */
  type?: ComplaintSubjectType[];
  query?: string;
  offset?: number;
  limit?: number;
}

/** Ключи запросов TanStack Query для раздела «Жалобы». */
export const complaintsKeys = {
  all: ["complaints"] as const,
  stats: (params: ComplaintsStatsParams) =>
    [...complaintsKeys.all, "stats", params] as const,
  list: (params: ComplaintsListParams) =>
    [...complaintsKeys.all, "list", params] as const,
  detail: (id: number) => [...complaintsKeys.all, "detail", id] as const,
  templates: (id: number) =>
    [...complaintsKeys.all, "templates", id] as const,
};

/**
 * Статистика жалоб за период.
 * `GET /api/admin/complaints/stats`, раздел прав `COMPLAINTS: READ`.
 */
export const getComplaintsStats = async (
  params: ComplaintsStatsParams,
): Promise<ComplaintStats> => {
  const res = await api.GET("/api/admin/complaints/stats", {
    params: { query: params },
  });
  // `data` в спеке помечен опциональным, но на success всегда присутствует.
  return unwrap(res)!;
};

/**
 * Список жалоб с пагинацией.
 * `GET /api/admin/complaints`, раздел прав `COMPLAINTS: READ`.
 */
export const getComplaints = async (
  params: ComplaintsListParams,
): Promise<ComplaintPage> => {
  const res = await api.GET("/api/admin/complaints", {
    params: { query: params },
  });
  // `data` в спеке помечен опциональным, но на success всегда присутствует.
  return unwrap(res)!;
};

/**
 * Детали одной жалобы (в т.ч. `available_resolutions` для формы решения).
 * `GET /api/admin/complaints/{complaintId}`, раздел прав `COMPLAINTS: READ`.
 */
export const getComplaint = async (
  complaintId: number,
): Promise<ComplaintDetails> => {
  const res = await api.GET("/api/admin/complaints/{complaintId}", {
    params: { path: { complaintId } },
  });
  return unwrap(res)!;
};

/**
 * Шаблоны решений по жалобе — дефолтные тексты под каждое допустимое решение.
 * `GET /api/admin/complaints/{complaintId}/resolution-templates`. Для закрытой
 * жалобы массив пуст; для открытой — только допустимые сейчас решения.
 */
export const getResolutionTemplates = async (
  complaintId: number,
): Promise<ComplaintResolutionTemplate[]> => {
  const res = await api.GET(
    "/api/admin/complaints/{complaintId}/resolution-templates",
    { params: { path: { complaintId } } },
  );
  return unwrap(res)!.items ?? [];
};

/**
 * Вынести решение по жалобе.
 * `POST /api/admin/complaints/{complaintId}/resolve`, раздел прав `COMPLAINTS: FULL`.
 */
export const resolveComplaint = async (
  complaintId: number,
  body: ResolveComplaintBody,
): Promise<void> => {
  const res = await api.POST("/api/admin/complaints/{complaintId}/resolve", {
    params: { path: { complaintId } },
    body,
  });
  unwrap(res);
};

/* ------------------------------------------------- хуки React Query */

/** Статистика жалоб за период. */
export const useComplaintsStats = (params: ComplaintsStatsParams) =>
  useQuery({
    queryKey: complaintsKeys.stats(params),
    queryFn: () => getComplaintsStats(params),
  });

/**
 * Список жалоб. Пока грузится следующая страница/фильтр — держит предыдущие
 * данные (`keepPreviousData`), чтобы список не мигал.
 */
export const useComplaints = (params: ComplaintsListParams) =>
  useQuery({
    queryKey: complaintsKeys.list(params),
    queryFn: () => getComplaints(params),
    placeholderData: keepPreviousData,
  });

/** Детали жалобы. Запрос не идёт, пока `complaintId` не задан. */
export const useComplaint = (complaintId: number | null) =>
  useQuery({
    queryKey: complaintsKeys.detail(complaintId ?? 0),
    queryFn: () => getComplaint(complaintId as number),
    enabled: complaintId != null,
  });

/** Шаблоны решений по жалобе. Запрос не идёт, пока `complaintId` не задан. */
export const useResolutionTemplates = (complaintId: number | null) =>
  useQuery({
    queryKey: complaintsKeys.templates(complaintId ?? 0),
    queryFn: () => getResolutionTemplates(complaintId as number),
    enabled: complaintId != null,
  });

/** Вынесение решения; при успехе обновляет список, статистику и деталь. */
export const useResolveComplaint = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: ResolveComplaintBody }) =>
      resolveComplaint(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: complaintsKeys.all });
    },
  });
};
