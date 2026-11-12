import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { api, unwrap } from "./client";
import type { components, paths } from "./schema";

/** Допустимое значение сортировки (напр. `rating:desc`) — из спека. */
export type MasterSalonSort = NonNullable<
  NonNullable<
    paths["/api/admin/masters-salons"]["get"]["parameters"]["query"]
  >["sort"]
>[number];

/** Один мастер/салон в списке. */
export type AdminMasterSalonListItem =
  components["schemas"]["AdminMasterSalonListItem"];

/** Страница списка (items + курсор offset/limit + has_more). */
export type AdminMasterSalonListData =
  components["schemas"]["AdminMasterSalonListData"];

/** Статистика мастеров и салонов за период. */
export type AdminMasterSalonStatsData =
  components["schemas"]["AdminMasterSalonStatsData"];

/** Профиль мастера (детали). */
export type AdminMasterProfile = components["schemas"]["AdminMasterProfile"];

/** Профиль салона (детали). */
export type AdminSalonProfile = components["schemas"]["AdminSalonProfile"];

/** Профиль мастера/салона (детали) — общая часть содержит `blocked_by`. */
export type AdminProviderProfile = AdminMasterProfile | AdminSalonProfile;

/** Тело частичного обновления мастера (минимум одно поле). */
export type AdminMasterUpdateRequest =
  components["schemas"]["AdminMasterUpdateRequest"];

/** Тело частичного обновления салона (минимум одно поле). */
export type AdminSalonUpdateRequest =
  components["schemas"]["AdminSalonUpdateRequest"];

/** Роль аккаунта в API. */
export type MasterSalonRole = AdminMasterSalonListItem["role"];

/** Статус аккаунта в API. */
export type MasterSalonStatus = AdminMasterSalonListItem["status"];

/** Параметры статистики. `from`/`to` — даты `YYYY-MM-DD` (обязательны). */
export interface MasterSalonStatsParams {
  from: string;
  to: string;
}

/** Параметры списка (поиск/фильтры/сортировка/пагинация). */
export interface MasterSalonListParams {
  from: string;
  to: string;
  query?: string;
  /** Фильтр по городам (OR). */
  city?: string[];
  /** Фильтр по ролям (OR). */
  role?: MasterSalonRole[];
  /** Фильтр по статусам (OR). */
  status?: MasterSalonStatus[];
  offset?: number;
  limit?: number;
  /** Сортировка вида `rating:desc` (rating|reviews_count|income_amount|registered_at). */
  sort?: MasterSalonSort[];
}

/** Ключи запросов TanStack Query для раздела «Мастера и салоны». */
export const mastersSalonsKeys = {
  all: ["masters-salons"] as const,
  stats: (params: MasterSalonStatsParams) =>
    [...mastersSalonsKeys.all, "stats", params] as const,
  list: (params: MasterSalonListParams) =>
    [...mastersSalonsKeys.all, "list", params] as const,
  profile: (role: MasterSalonRole, id: number) =>
    [...mastersSalonsKeys.all, "profile", role, id] as const,
};

/**
 * Статистика мастеров и салонов за период.
 * `GET /api/admin/masters-salons/stats`, раздел прав `MASTERS_SALONS: READ`.
 */
export const getMasterSalonStats = async (
  params: MasterSalonStatsParams,
): Promise<AdminMasterSalonStatsData> => {
  const res = await api.GET("/api/admin/masters-salons/stats", {
    params: { query: params },
  });
  // `data` в спеке помечен опциональным, но на success всегда присутствует.
  return unwrap(res)!;
};

/**
 * Список мастеров и салонов с пагинацией.
 * `GET /api/admin/masters-salons`, раздел прав `MASTERS_SALONS: READ`.
 */
export const getMastersSalons = async (
  params: MasterSalonListParams,
): Promise<AdminMasterSalonListData> => {
  const res = await api.GET("/api/admin/masters-salons", {
    params: { query: params },
  });
  return unwrap(res)!;
};

/**
 * Профиль мастера/салона (детали). Эндпоинт зависит от роли. Используется для
 * данных, которых нет в списке (напр. `blocked_by` — менеджер блокировки).
 * `GET /api/admin/{masters|salons}/{id}`, раздел прав `MASTERS_SALONS: READ`.
 */
export const getProviderProfile = async (
  id: number,
  role: MasterSalonRole,
): Promise<AdminProviderProfile> => {
  if (role === "SALON") {
    return unwrap(
      await api.GET("/api/admin/salons/{id}", { params: { path: { id } } }),
    )!;
  }
  return unwrap(
    await api.GET("/api/admin/masters/{id}", { params: { path: { id } } }),
  )!;
};

/** Корневые категории, которые ещё не назначены выбранному профилю. */
export const useAvailableProviderCategories = (
  id: number | null,
  role: MasterSalonRole,
) =>
  useQuery({
    queryKey: [...mastersSalonsKeys.all, "available-categories", role, id],
    enabled: id != null,
    queryFn: async () => {
      const params = { path: { id: id as number } };
      const result = role === "SALON"
        ? await api.GET("/api/admin/salons/{id}/available-categories", { params })
        : await api.GET("/api/admin/masters/{id}/available-categories", { params });
      return (unwrap(result) ?? []).map((category) => ({
        id: category.category_id,
        name: category.name,
      }));
    },
  });

/**
 * Заблокировать мастера/салон с указанием причины. Эндпоинт зависит от роли.
 * `POST /api/admin/{masters|salons}/{id}/block`, раздел прав `MASTERS_SALONS: FULL`.
 */
export const blockProvider = async (
  id: number,
  role: MasterSalonRole,
  reason: string,
): Promise<void> => {
  if (role === "SALON") {
    unwrap(
      await api.POST("/api/admin/salons/{id}/block", {
        params: { path: { id } },
        body: { reason },
      }),
    );
  } else {
    unwrap(
      await api.POST("/api/admin/masters/{id}/block", {
        params: { path: { id } },
        body: { reason },
      }),
    );
  }
};

/**
 * Разблокировать мастера/салон. Эндпоинт зависит от роли.
 * `POST /api/admin/{masters|salons}/{id}/unblock`, раздел прав `MASTERS_SALONS: FULL`.
 */
export const unblockProvider = async (
  id: number,
  role: MasterSalonRole,
): Promise<void> => {
  if (role === "SALON") {
    unwrap(
      await api.POST("/api/admin/salons/{id}/unblock", {
        params: { path: { id } },
      }),
    );
  } else {
    unwrap(
      await api.POST("/api/admin/masters/{id}/unblock", {
        params: { path: { id } },
      }),
    );
  }
};

/**
 * Изменить профиль мастера (частично).
 * `PATCH /api/admin/masters/{id}`, раздел прав `MASTERS_SALONS: FULL`.
 */
export const updateMaster = async (
  id: number,
  body: AdminMasterUpdateRequest,
): Promise<AdminMasterProfile> => {
  const res = await api.PATCH("/api/admin/masters/{id}", {
    params: { path: { id } },
    body,
  });
  return unwrap(res)!;
};

/**
 * Изменить профиль салона (частично).
 * `PATCH /api/admin/salons/{id}`, раздел прав `MASTERS_SALONS: FULL`.
 */
export const updateSalon = async (
  id: number,
  body: AdminSalonUpdateRequest,
): Promise<AdminSalonProfile> => {
  const res = await api.PATCH("/api/admin/salons/{id}", {
    params: { path: { id } },
    body,
  });
  return unwrap(res)!;
};

/* ------------------------------------------------- хуки React Query */

/** Статистика мастеров и салонов за период. */
export const useMasterSalonStats = (params: MasterSalonStatsParams) =>
  useQuery({
    queryKey: mastersSalonsKeys.stats(params),
    queryFn: () => getMasterSalonStats(params),
  });

/**
 * Список мастеров и салонов. Пока грузится следующая страница/фильтр — держит
 * предыдущие данные (`keepPreviousData`), чтобы таблица не мигала.
 */
export const useMastersSalons = (params: MasterSalonListParams) =>
  useQuery({
    queryKey: mastersSalonsKeys.list(params),
    queryFn: () => getMastersSalons(params),
    placeholderData: keepPreviousData,
  });

/**
 * Профиль мастера/салона. Запрос не идёт, пока не заданы `id` и `role`
 * (напр. открыта модалка разблокировки конкретной строки).
 */
export const useProviderProfile = (
  id: number | null,
  role: MasterSalonRole | null,
) =>
  useQuery({
    queryKey: mastersSalonsKeys.profile(role ?? "MASTER", id ?? 0),
    queryFn: () => getProviderProfile(id as number, role as MasterSalonRole),
    enabled: id != null && role != null,
  });

/** Блокировка мастера/салона; при успехе обновляет список и статистику. */
export const useBlockProvider = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      role,
      reason,
    }: {
      id: number;
      role: MasterSalonRole;
      reason: string;
    }) => blockProvider(id, role, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: mastersSalonsKeys.all });
    },
  });
};

/** Разблокировка мастера/салона; при успехе обновляет список и статистику. */
export const useUnblockProvider = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, role }: { id: number; role: MasterSalonRole }) =>
      unblockProvider(id, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: mastersSalonsKeys.all });
    },
  });
};

/** Изменение профиля мастера; при успехе обновляет профиль и список. */
export const useUpdateMaster = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: AdminMasterUpdateRequest }) =>
      updateMaster(id, body),
    onSuccess: (updated, { id }) => {
      queryClient.invalidateQueries({ queryKey: mastersSalonsKeys.all });
      queryClient.setQueryData(
        mastersSalonsKeys.profile("MASTER", id),
        updated,
      );
    },
  });
};

/** Изменение профиля салона; при успехе обновляет профиль и список. */
export const useUpdateSalon = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: AdminSalonUpdateRequest }) =>
      updateSalon(id, body),
    onSuccess: (updated, { id }) => {
      queryClient.invalidateQueries({ queryKey: mastersSalonsKeys.all });
      queryClient.setQueryData(mastersSalonsKeys.profile("SALON", id), updated);
    },
  });
};
