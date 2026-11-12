import { useQuery } from "@tanstack/react-query";

import { api, unwrap } from "./client";
import type { components } from "./schema";

/** Тип блокируемого объекта — определяет набор причин. */
export type BlockReasonTarget = "CLIENT" | "MASTER" | "SALON";

/** Одна причина блокировки: название (уходит в endpoint) + пояснение для UI. */
export type AdminBlockReason = components["schemas"]["AdminBlockReason"];

/** Ключи запросов TanStack Query для справочника причин блокировки. */
export const blockReasonsKeys = {
  all: ["block-reasons"] as const,
  byTarget: (target: BlockReasonTarget) =>
    [...blockReasonsKeys.all, target] as const,
};

/**
 * Каталог возможных причин блокировки для клиента/мастера/салона.
 * `GET /api/admin/block-reasons?target=…`, роль `ADMIN`. `OTHER`/«Другая
 * причина» бэкенд не возвращает — вариант «Другое» добавляем в UI.
 */
export const getBlockReasons = async (
  target: BlockReasonTarget,
): Promise<AdminBlockReason[]> => {
  const res = await api.GET("/api/admin/block-reasons", {
    params: { query: { target } },
  });
  return unwrap(res)?.items ?? [];
};

/** Причины блокировки для указанного типа объекта. */
export const useBlockReasons = (target: BlockReasonTarget) =>
  useQuery({
    queryKey: blockReasonsKeys.byTarget(target),
    queryFn: () => getBlockReasons(target),
    // Справочник статичный — не перезапрашиваем при каждом открытии модалки.
    staleTime: Infinity,
  });
