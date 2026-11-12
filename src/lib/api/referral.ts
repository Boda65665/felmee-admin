import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { api, unwrap } from "./client";
import type { components } from "./schema";

/** Статистика реферальной программы за период. */
export type AdminReferralStatsData =
  components["schemas"]["AdminReferralStatsData"];

/** Правило реферальной программы (условие + награда). */
export type AdminReferralRule = components["schemas"]["AdminReferralRule"];

/** Тип получателя награды (CLIENT — «Друзья», BUSINESS — «Мастера»). */
export type ReferralTargetType = AdminReferralRule["target_type"];

/** Интервал вознаграждения (ALL_SERVICES / NEXT_SERVICE). */
export type ReferralRewardInterval = AdminReferralRule["reward_interval"];

/** Тело изменения награды правила (процент + интервал). */
export type AdminReferralRuleUpdate =
  components["schemas"]["AdminReferralRuleUpdate"];

/** Данные графика «Выгода программы лояльности» (дневные точки в ₽). */
export type AdminReferralProfitData =
  components["schemas"]["AdminReferralProfitData"];

/** Показатели реферальной системы за период (summary). */
export type AdminReferralPartnerSummary =
  components["schemas"]["AdminReferralPartnerSummary"];

/** Страница списка партнёров (items + total + offset/limit). */
export type AdminReferralPartnerPage =
  components["schemas"]["AdminReferralPartnerPage"];

/** Один партнёр в списке. */
export type AdminReferralPartnerItem =
  components["schemas"]["AdminReferralPartnerItem"];

/** Карточка партнёра (item + business_type/activated_at + приглашённые). */
export type AdminReferralPartnerCard =
  components["schemas"]["AdminReferralPartnerCard"];

/** Приглашённый реферал в карточке партнёра. */
export type AdminReferralInvitee =
  components["schemas"]["AdminReferralInvitee"];

/** Один уровень реферальной системы (код/название/ставка). */
export type AdminReferralSystemLevel =
  components["schemas"]["AdminReferralSystemLevel"];

/** Статус партнёра (ACTIVE | INACTIVE). */
export type ReferralPartnerStatus = AdminReferralPartnerItem["status"];

/** Код уровня линии (4 значения из enum параметров `*_level_code`). */
export type ReferralLevelCode =
  | "START"
  | "DEVELOPMENT"
  | "PROFESSIONAL"
  | "STRATEGIC";

/** Линия реферальной программы. */
export type ReferralTarget = "CLIENT" | "BUSINESS";

/** Данные ставок уровней: клиентская и бизнес-линии. */
export interface AdminReferralSystemLevelsData {
  client_line: { levels: AdminReferralSystemLevel[] };
  business_line: { levels: AdminReferralSystemLevel[] };
}

/** Параметры списка партнёров (период/поиск/фильтры/пагинация). */
export interface ReferralPartnersParams {
  from: string;
  to: string;
  search?: string;
  status?: ReferralPartnerStatus;
  client_level_code?: ReferralLevelCode;
  business_level_code?: ReferralLevelCode;
  offset?: number;
  limit?: number;
}

/** Параметры карточки партнёра (период + пагинация приглашённых). */
export interface ReferralPartnerCardParams {
  from?: string;
  to?: string;
  offset?: number;
  limit?: number;
}

/** Параметры статистики/графика. `from`/`to` — даты `YYYY-MM-DD` (обязательны). */
export interface ReferralPeriodParams {
  from: string;
  to: string;
}

/** Ключи запросов TanStack Query для раздела «Программа лояльности». */
export const referralKeys = {
  all: ["referral"] as const,
  stats: (params: ReferralPeriodParams) =>
    [...referralKeys.all, "stats", params] as const,
  rules: () => [...referralKeys.all, "rules"] as const,
  profit: (params: ReferralPeriodParams) =>
    [...referralKeys.all, "profit", params] as const,
  partnersSummary: (params: ReferralPeriodParams) =>
    [...referralKeys.all, "partners-summary", params] as const,
  partners: (params: ReferralPartnersParams) =>
    [...referralKeys.all, "partners", params] as const,
  partnerCard: (id: number, params: ReferralPartnerCardParams) =>
    [...referralKeys.all, "partner-card", id, params] as const,
  levels: () => [...referralKeys.all, "levels"] as const,
};

/**
 * Статистика реферальной программы за период.
 * `GET /api/admin/referral/stats`, раздел прав `LOYALTY: READ`.
 */
export const getReferralStats = async (
  params: ReferralPeriodParams,
): Promise<AdminReferralStatsData> => {
  const res = await api.GET("/api/admin/referral/stats", {
    params: { query: params },
  });
  // `data` в спеке помечен опциональным, но на success всегда присутствует.
  return unwrap(res)!;
};

/**
 * Правила реферальной программы. Наружу возвращаем плоский список правил
 * (пагинация не нужна). По спеку эндпоинт отдаёт пагинированный конверт
 * `{ items, … }`, но на всякий случай поддерживаем и плоский массив `data` —
 * иначе рассинхрон спек↔бэк молча давал бы пустой список.
 * `GET /api/admin/referral/rules`, раздел прав `REFERRAL_PROGRAM: READ`.
 */
export const getReferralRules = async (): Promise<AdminReferralRule[]> => {
  const res = await api.GET("/api/admin/referral/rules");
  const data = unwrap(res);
  return Array.isArray(data) ? data : (data?.items ?? []);
};

/**
 * Изменить награду правила (процент + интервал).
 * `PATCH /api/admin/referral/rules/{ruleId}`, раздел прав `LOYALTY: FULL`.
 */
export const updateReferralRule = async (
  ruleId: number,
  body: AdminReferralRuleUpdate,
): Promise<AdminReferralRule> => {
  const res = await api.PATCH("/api/admin/referral/rules/{ruleId}", {
    params: { path: { ruleId } },
    body,
  });
  return unwrap(res)!;
};

/**
 * Данные графика выгоды реферальной системы за период.
 * `GET /api/admin/referral/profit`, раздел прав `LOYALTY: READ`.
 */
export const getReferralProfit = async (
  params: ReferralPeriodParams,
): Promise<AdminReferralProfitData> => {
  const res = await api.GET("/api/admin/referral/profit", {
    params: { query: params },
  });
  return unwrap(res)!;
};

/* ------------------------------------------------- хуки React Query */

/** Статистика реферальной программы за период. */
export const useReferralStats = (params: ReferralPeriodParams) =>
  useQuery({
    queryKey: referralKeys.stats(params),
    queryFn: () => getReferralStats(params),
  });

/** Правила реферальной программы. */
export const useReferralRules = () =>
  useQuery({
    queryKey: referralKeys.rules(),
    queryFn: getReferralRules,
  });

/** Данные графика выгоды за период. */
export const useReferralProfit = (params: ReferralPeriodParams) =>
  useQuery({
    queryKey: referralKeys.profit(params),
    queryFn: () => getReferralProfit(params),
  });

/** Изменение награды правила; при успехе обновляет список правил. */
export const useUpdateReferralRule = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      ruleId,
      body,
    }: {
      ruleId: number;
      body: AdminReferralRuleUpdate;
    }) => updateReferralRule(ruleId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: referralKeys.rules() });
    },
  });
};

/* ------------------------------------------ admin-эндпоинты рефералки */

/**
 * Показатели реферальной системы за период.
 * `GET /api/admin/referral/partners/summary`.
 */
export const getReferralPartnerSummary = async (
  params: ReferralPeriodParams,
): Promise<AdminReferralPartnerSummary> => {
  const res = await api.GET("/api/admin/referral/partners/summary", {
    params: { query: params },
  });
  return unwrap(res)!;
};

/**
 * Список партнёров с пагинацией/фильтрами.
 * `GET /api/admin/referral/partners`.
 */
export const getReferralPartners = async (
  params: ReferralPartnersParams,
): Promise<AdminReferralPartnerPage> => {
  const res = await api.GET("/api/admin/referral/partners", {
    params: { query: params },
  });
  return unwrap(res)!;
};

/**
 * Карточка партнёра и приглашённые.
 * `GET /api/admin/referral/partners/{referral_user_id}`.
 */
export const getReferralPartnerCard = async (
  id: number,
  params: ReferralPartnerCardParams = {},
): Promise<AdminReferralPartnerCard> => {
  const res = await api.GET("/api/admin/referral/partners/{referral_user_id}", {
    params: { path: { referral_user_id: id }, query: params },
  });
  return unwrap(res)!;
};

/**
 * Ставки уровней реферальной системы (клиентская и бизнес-линии).
 * `GET /api/admin/referral/levels`.
 */
export const getReferralSystemLevels =
  async (): Promise<AdminReferralSystemLevelsData> => {
    const res = await api.GET("/api/admin/referral/levels");
    return unwrap(res)! as AdminReferralSystemLevelsData;
  };

/**
 * Изменить ставку одного уровня линии.
 * `PATCH /api/admin/referral/levels/{targetType}/{levelCode}`.
 */
export const updateReferralLevelRate = async (
  targetType: ReferralTarget,
  levelCode: string,
  reward_percent: number,
): Promise<AdminReferralSystemLevel> => {
  const res = await api.PATCH(
    "/api/admin/referral/levels/{targetType}/{levelCode}",
    { params: { path: { targetType, levelCode } }, body: { reward_percent } },
  );
  return unwrap(res)!;
};

/** Показатели реферальной системы за период. */
export const useReferralPartnerSummary = (params: ReferralPeriodParams) =>
  useQuery({
    queryKey: referralKeys.partnersSummary(params),
    queryFn: () => getReferralPartnerSummary(params),
  });

/** Список партнёров (keepPreviousData — без мигания при пагинации). */
export const useReferralPartners = (params: ReferralPartnersParams) =>
  useQuery({
    queryKey: referralKeys.partners(params),
    queryFn: () => getReferralPartners(params),
    placeholderData: keepPreviousData,
  });

/** Карточка партнёра; включается только при наличии id. */
export const useReferralPartnerCard = (
  id: number | null,
  params: ReferralPartnerCardParams = {},
) =>
  useQuery({
    queryKey: referralKeys.partnerCard(id ?? 0, params),
    queryFn: () => getReferralPartnerCard(id!, params),
    enabled: id != null,
  });

/** Ставки уровней реферальной системы. */
export const useReferralSystemLevels = () =>
  useQuery({
    queryKey: referralKeys.levels(),
    queryFn: getReferralSystemLevels,
  });

/** Изменить ставку уровня; при успехе инвалидирует ставки. */
export const useUpdateReferralLevelRate = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      targetType,
      levelCode,
      reward_percent,
    }: {
      targetType: ReferralTarget;
      levelCode: string;
      reward_percent: number;
    }) => updateReferralLevelRate(targetType, levelCode, reward_percent),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: referralKeys.levels() });
    },
  });
};
