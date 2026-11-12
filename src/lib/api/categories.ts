import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, unwrap } from "./client";
import type { components } from "./schema";

/** Корневая категория в списке админ-панели (со счётчиками детей и услуг). */
export type AdminCategoryListItem =
  components["schemas"]["AdminCategoryListItem"];

/** Тело создания категории (имя обязательно; обложка и подкатегории — опц.). */
export type AdminCreateCategoryRequest =
  components["schemas"]["AdminCreateCategoryRequest"];

/**
 * Поля актуального PATCH. Генератор превращает anyOf с required-only
 * ветками в unknown, поэтому форму тела фиксируем явно.
 */
export interface AdminUpdateCategoryRequest {
  name?: string | null;
  image_id?: number | null;
  subcategories?: AdminCategorySubcategoryUpdate[] | null;
}

/** Элемент полного списка подкатегорий в теле `PATCH` категории. */
export type AdminCategorySubcategoryUpdate =
  components["schemas"]["AdminCategorySubcategoryUpdate"];

/** Ключи запросов TanStack Query для раздела «Категории». */
export const categoriesKeys = {
  all: ["categories"] as const,
  list: () => [...categoriesKeys.all, "list"] as const,
  subcategories: (categoryId: number) =>
    [...categoriesKeys.all, "subcategories", categoryId] as const,
};

/**
 * Корневые категории для админ-панели (без пагинации).
 * `GET /api/admin/categories`, раздел прав `CATEGORIES: READ`.
 */
export const listCategories = async (): Promise<AdminCategoryListItem[]> => {
  const res = await api.GET("/api/admin/categories");
  return unwrap(res) ?? [];
};

/**
 * Прямые подкатегории категории (со своими `id` — нужны для `category_id`
 * при редактировании). `GET /api/admin/categories/{categoryId}/subcategories`.
 */
export const getSubcategories = async (
  categoryId: number,
): Promise<AdminCategoryListItem[]> => {
  const res = await api.GET("/api/admin/categories/{categoryId}/subcategories", {
    params: { path: { categoryId } },
  });
  return unwrap(res) ?? [];
};

/**
 * Создать категорию (опц. с подкатегориями — их порядок определяется индексом).
 * `POST /api/admin/categories`, раздел прав `CATEGORIES: FULL`.
 */
export const createCategory = async (body: AdminCreateCategoryRequest) => {
  const res = await api.POST("/api/admin/categories", { body });
  return unwrap(res);
};

/**
 * Изменить категорию. `subcategories`, если передан, — полный желаемый список
 * (отсутствующие удаляются, если не заняты услугами).
 * `PATCH /api/admin/categories/{categoryId}`, раздел прав `CATEGORIES: FULL`.
 */
export const updateCategory = async (
  categoryId: number,
  body: AdminUpdateCategoryRequest,
) => {
  const res = await api.PATCH("/api/admin/categories/{categoryId}", {
    params: { path: { categoryId } },
    body,
  });
  return unwrap(res);
};

/**
 * Удалить категорию. Бэк отдаёт `409`, если в категории есть услуги.
 * `DELETE /api/admin/categories/{categoryId}`, раздел прав `CATEGORIES: FULL`.
 */
export const deleteCategory = async (categoryId: number): Promise<void> => {
  const res = await api.DELETE("/api/admin/categories/{categoryId}", {
    params: { path: { categoryId } },
  });
  unwrap(res);
};

/* ------------------------------------------------- хуки React Query */

/** Список корневых категорий. */
export const useCategories = () =>
  useQuery({
    queryKey: categoriesKeys.list(),
    queryFn: listCategories,
  });

/** Подкатегории категории. Запрос не идёт, пока `categoryId` не задан. */
export const useSubcategories = (categoryId: number | null) =>
  useQuery({
    queryKey: categoriesKeys.subcategories(categoryId ?? 0),
    queryFn: () => getSubcategories(categoryId as number),
    enabled: categoryId != null,
  });

/** Создание категории; при успехе обновляет список. */
export const useCreateCategory = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: categoriesKeys.list() });
    },
  });
};

/** Изменение категории; при успехе обновляет список. */
export const useUpdateCategory = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      categoryId,
      body,
    }: {
      categoryId: number;
      body: AdminUpdateCategoryRequest;
    }) => updateCategory(categoryId, body),
    onSuccess: (_data, { categoryId }) => {
      queryClient.invalidateQueries({ queryKey: categoriesKeys.list() });
      queryClient.invalidateQueries({
        queryKey: categoriesKeys.subcategories(categoryId),
      });
    },
  });
};

/** Удаление категории; при успехе обновляет список. */
export const useDeleteCategory = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: categoriesKeys.list() });
    },
  });
};
