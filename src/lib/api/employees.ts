import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { api, unwrap } from "./client";
import type { components } from "./schema";

/** Сотрудник админ-панели в списке (без телефона — тот приходит в детали). */
export type AdminEmployeeListItem =
  components["schemas"]["AdminEmployeeListItem"];

/** Сотрудник целиком (с телефоном) — ответ создания/детали. */
export type AdminEmployee = components["schemas"]["AdminEmployee"];

/** Тело создания сотрудника. */
export type CreateAdminEmployeeBody =
  components["schemas"]["CreateAdminEmployeeBody"];

/** Тело изменения сотрудника (все поля необязательны). */
export type UpdateAdminEmployeeBody =
  components["schemas"]["UpdateAdminEmployeeBody"];

/** Одно право сотрудника: раздел (enum + подпись) и уровень доступа. */
export type AdminEmployeePermission =
  components["schemas"]["AdminEmployeePermission"];

/** Тело изменения права одного раздела. */
export type AdminEmployeePermissionUpdate =
  components["schemas"]["AdminEmployeePermissionUpdate"];

/** Раздел панели (enum-код) и уровень доступа. */
export type AdminPanelSection = components["schemas"]["AdminPanelSection"];
export type AdminPanelPermissionLevel =
  components["schemas"]["AdminPanelPermissionLevel"];

/** Ключи запросов TanStack Query для раздела «Роли». */
export const employeesKeys = {
  all: ["employees"] as const,
  list: () => [...employeesKeys.all, "list"] as const,
  detail: (userId: number) => [...employeesKeys.all, "detail", userId] as const,
  permissions: (userId: number) =>
    [...employeesKeys.all, "permissions", userId] as const,
  myPermissions: () => [...employeesKeys.all, "my-permissions"] as const,
};

/**
 * Список действующих сотрудников админ-панели (без пагинации).
 * `GET /api/admin/employees`, раздел прав `ROLES: READ`.
 */
export const listEmployees = async (): Promise<AdminEmployeeListItem[]> => {
  const res = await api.GET("/api/admin/employees");
  return unwrap(res);
};

/**
 * Создать сотрудника админ-панели (или восстановить удалённого по телефону).
 * `POST /api/admin/employees`, раздел прав `ROLES: FULL`.
 */
export const createEmployee = async (
  body: CreateAdminEmployeeBody,
): Promise<AdminEmployee> => {
  const res = await api.POST("/api/admin/employees", { body });
  return unwrap(res);
};

/**
 * Данные одного сотрудника (с телефоном).
 * `GET /api/admin/employees/{userId}`, раздел прав `ROLES: READ`.
 */
export const getEmployee = async (userId: number): Promise<AdminEmployee> => {
  const res = await api.GET("/api/admin/employees/{userId}", {
    params: { path: { userId } },
  });
  return unwrap(res);
};

/**
 * Изменить данные сотрудника.
 * `PATCH /api/admin/employees/{userId}`, раздел прав `ROLES: FULL`.
 */
export const updateEmployee = async (
  userId: number,
  body: UpdateAdminEmployeeBody,
): Promise<AdminEmployee> => {
  const res = await api.PATCH("/api/admin/employees/{userId}", {
    params: { path: { userId } },
    body,
  });
  return unwrap(res);
};

/**
 * Удалить сотрудника (снимает роль ADMIN и права, запись остаётся для аудита).
 * `DELETE /api/admin/employees/{userId}`, раздел прав `ROLES: FULL`.
 */
export const deleteEmployee = async (userId: number): Promise<void> => {
  const res = await api.DELETE("/api/admin/employees/{userId}", {
    params: { path: { userId } },
  });
  unwrap(res);
};

/**
 * Права сотрудника по всем разделам панели.
 * `GET /api/admin/employees/{userId}/permissions`, раздел прав `ROLES: READ`.
 * Возвращает все разделы; отсутствие права представлено уровнем `NONE`.
 */
export const getEmployeePermissions = async (
  userId: number,
): Promise<AdminEmployeePermission[]> => {
  const res = await api.GET("/api/admin/employees/{userId}/permissions", {
    params: { path: { userId } },
  });
  return unwrap(res).permissions;
};

/**
 * Права текущего пользователя по всем разделам панели.
 * `GET /api/admin/employees/me/permissions`. Используется для фильтрации меню
 * и маршрутов: раздел с уровнем `NONE` пользователю не показывается.
 */
export const getMyPermissions = async (): Promise<AdminEmployeePermission[]> => {
  const res = await api.GET("/api/admin/employees/me/permissions", {});
  return unwrap(res).permissions;
};

/**
 * Изменить право сотрудника для одного раздела (остальные не трогает).
 * `PUT /api/admin/employees/{userId}/permissions`, раздел прав `ROLES: FULL`.
 * Возвращает полный обновлённый набор прав сотрудника.
 */
export const setEmployeePermission = async (
  userId: number,
  body: AdminEmployeePermissionUpdate,
): Promise<AdminEmployeePermission[]> => {
  const res = await api.PUT("/api/admin/employees/{userId}/permissions", {
    params: { path: { userId } },
    body,
  });
  return unwrap(res).permissions;
};

/* ------------------------------------------------- хуки React Query */

/** Список сотрудников админ-панели. */
export const useEmployees = () =>
  useQuery({
    queryKey: employeesKeys.list(),
    queryFn: listEmployees,
  });

/** Данные сотрудника (с телефоном). Запрос не идёт, пока `userId` не задан. */
export const useEmployee = (userId: number | null) =>
  useQuery({
    queryKey: employeesKeys.detail(userId ?? 0),
    queryFn: () => getEmployee(userId as number),
    enabled: userId != null,
  });

/** Права сотрудника по разделам. Запрос не идёт, пока `userId` не задан. */
export const useEmployeePermissions = (userId: number | null) =>
  useQuery({
    queryKey: employeesKeys.permissions(userId ?? 0),
    queryFn: () => getEmployeePermissions(userId as number),
    enabled: userId != null,
  });

/** Права текущего пользователя (для фильтрации меню/маршрутов). */
export const useMyPermissions = (enabled = true) =>
  useQuery({
    queryKey: employeesKeys.myPermissions(),
    queryFn: getMyPermissions,
    enabled,
    staleTime: 5 * 60 * 1000,
  });

/** Создание сотрудника; при успехе обновляет список. */
export const useCreateEmployee = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createEmployee,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: employeesKeys.list() });
    },
  });
};

/** Изменение сотрудника; при успехе обновляет список и его детали. */
export const useUpdateEmployee = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      userId,
      body,
    }: {
      userId: number;
      body: UpdateAdminEmployeeBody;
    }) => updateEmployee(userId, body),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: employeesKeys.list() });
      queryClient.invalidateQueries({
        queryKey: employeesKeys.detail(updated.user_id),
      });
    },
  });
};

/** Удаление сотрудника; при успехе обновляет список. */
export const useDeleteEmployee = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteEmployee,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: employeesKeys.list() });
    },
  });
};

/**
 * Изменение права одного раздела. Оптимистично правит кэш прав до ответа,
 * при ошибке откатывает, а при успехе синхронизирует ответом сервера.
 */
export const useSetEmployeePermission = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      userId,
      section,
      accessLevel,
    }: {
      userId: number;
      section: AdminPanelSection;
      accessLevel: AdminPanelPermissionLevel;
    }) => setEmployeePermission(userId, { section, access_level: accessLevel }),

    onMutate: async ({ userId, section, accessLevel }) => {
      const key = employeesKeys.permissions(userId);
      await queryClient.cancelQueries({ queryKey: key });
      const previous =
        queryClient.getQueryData<AdminEmployeePermission[]>(key);
      queryClient.setQueryData<AdminEmployeePermission[]>(key, (old) =>
        old?.map((perm) =>
          perm.section === section
            ? { ...perm, access_level: accessLevel }
            : perm,
        ),
      );
      return { key, previous };
    },

    onError: (_error, _vars, context) => {
      if (context) {
        queryClient.setQueryData(context.key, context.previous);
      }
    },

    onSuccess: (permissions, { userId }) => {
      queryClient.setQueryData(
        employeesKeys.permissions(userId),
        permissions,
      );
    },
  });
};
