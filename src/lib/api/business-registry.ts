import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { api, unwrap } from "./client";
import type { components } from "./schema";

/** Страница списка заявок (items + курсор offset/limit + has_more). */
export type BusinessApplicationPage =
  components["schemas"]["BusinessApplicationPage"];

/** Один элемент списка заявок Business Registry. */
export type BusinessApplicationListItem =
  components["schemas"]["BusinessApplicationListItem"];

/** Полная карточка заявки (партнёр + документы + реквизиты). */
export type BusinessApplicationCard =
  components["schemas"]["BusinessApplicationCard"];

/** Один загруженный документ в карточке заявки. */
export type BusinessApplicationDocument =
  BusinessApplicationCard["documents"][number];

/** Страница комментариев к заявке. */
export type BusinessApplicationCommentsPage =
  components["schemas"]["BusinessApplicationCommentsPage"];

/** Комментарий к заявке (автор + текст + дата). */
export type BusinessApplicationComment =
  components["schemas"]["BusinessApplicationComment"];

/** Тело решения по одному файлу (APPROVE / REQUEST_REUPLOAD + комментарий). */
export type BusinessApplicationDocumentDecision =
  components["schemas"]["BusinessApplicationDocumentDecision"];

/** Тело правки данных партнёра в заявке. */
export type BusinessApplicationPartnerUpdate =
  components["schemas"]["BusinessApplicationPartnerUpdate"];

/** Тело правки банковских реквизитов заявки. */
export type BusinessApplicationRequisitesUpdate =
  Partial<components["schemas"]["ReferralRequisitesRequest"]> & { comment?: string };

/** Only send changed fields. Blank strings are not a supported clearing operation. */
export function buildBusinessPatch<T extends Record<string, unknown>>(
  values: T,
  dirty: Partial<Record<keyof T, unknown>>,
): Partial<T> {
  return Object.fromEntries(Object.entries(values).flatMap(([key, value]) => {
    if (!dirty[key]) return [];
    const next = typeof value === "string" ? value.trim() : value;
    if (next === "" || next == null) return [];
    return [[key, next]];
  })) as Partial<T>;
}

/** Источник заявки — вкладка раздела (REFERRAL / BUSINESS). */
export type BusinessApplicationSource = BusinessApplicationListItem["source"];

/** Юридический статус бизнеса (SE — самозанятость, IE — ИП, LLC — ООО). */
export type BusinessType = BusinessApplicationListItem["business_type"];

/** Статус проверки заявки (новая / нужно уточнение / проверена). */
export type BusinessApplicationStatus =
  BusinessApplicationListItem["status"];

/** Статус одного загруженного документа. */
export type BusinessDocumentStatus = BusinessApplicationDocument["status"];

/** Ключ заявки — тройка, которой она адресуется в API. */
export interface BusinessApplicationKey {
  source: BusinessApplicationSource;
  businessType: BusinessType;
  businessEntityId: number;
}

/** Параметры списка заявок (фильтры/поиск/пагинация). */
export interface BusinessApplicationsListParams {
  /** Источник = активная вкладка раздела. Обязателен. */
  source: BusinessApplicationSource;
  /** Фильтр по юр. статусу. */
  business_type?: BusinessType;
  /** Фильтр по статусам проверки (OR). */
  statuses?: BusinessApplicationStatus[];
  /** Нижняя/верхняя границы даты подачи — `YYYY-MM-DD`. */
  submitted_from?: string;
  submitted_to?: string;
  /** Поиск по имени/ИНН. */
  search?: string;
  offset?: number;
  limit?: number;
}

/** Параметры показателей (`from`/`to` — даты `YYYY-MM-DD`). */
export interface BusinessRegistrySummaryParams {
  from: string;
  to: string;
}

/** Показатели раздела (активные/неактивные партнёры + начислено). */
export type BusinessRegistrySummary =
  components["schemas"]["AdminReferralPartnerSummary"];

/** Ключи запросов TanStack Query для раздела «Документы». */
export const businessRegistryKeys = {
  all: ["business-registry"] as const,
  summary: (params: BusinessRegistrySummaryParams) =>
    [...businessRegistryKeys.all, "summary", params] as const,
  list: (params: BusinessApplicationsListParams) =>
    [...businessRegistryKeys.all, "list", params] as const,
  detail: (key: BusinessApplicationKey) =>
    [...businessRegistryKeys.all, "detail", key] as const,
  comments: (key: BusinessApplicationKey) =>
    [...businessRegistryKeys.all, "comments", key] as const,
};

/**
 * Показатели реферальной системы за период (активные/неактивные партнёры,
 * начислено вознаграждений + дельты к прошлому периоду).
 * `GET /api/admin/referral/partners/summary`.
 */
export const getBusinessRegistrySummary = async (
  params: BusinessRegistrySummaryParams,
): Promise<BusinessRegistrySummary> => {
  const res = await api.GET("/api/admin/referral/partners/summary", {
    params: { query: params },
  });
  // `data` в спеке помечен опциональным, но на success всегда присутствует.
  return unwrap(res)!;
};

/**
 * Список заявок Business Registry с пагинацией.
 * `GET /api/admin/business-registry/applications`.
 */
export const getBusinessApplications = async (
  params: BusinessApplicationsListParams,
): Promise<BusinessApplicationPage> => {
  const res = await api.GET("/api/admin/business-registry/applications", {
    params: { query: params },
  });
  return unwrap(res)!;
};

/**
 * Полная карточка заявки (партнёр + документы + реквизиты).
 * `GET /api/admin/business-registry/applications/{source}/{businessType}/{businessEntityId}`.
 */
export const getBusinessApplication = async (
  key: BusinessApplicationKey,
): Promise<BusinessApplicationCard> => {
  const res = await api.GET(
    "/api/admin/business-registry/applications/{source}/{businessType}/{businessEntityId}",
    { params: { path: key } },
  );
  return unwrap(res)!;
};

/**
 * Комментарии к заявке.
 * `GET …/{source}/{businessType}/{businessEntityId}/comments`.
 */
export const getBusinessApplicationComments = async (
  key: BusinessApplicationKey,
  offset = 0,
  limit = 20,
): Promise<BusinessApplicationCommentsPage> => {
  const res = await api.GET(
    "/api/admin/business-registry/applications/{source}/{businessType}/{businessEntityId}/comments",
    { params: { path: key, query: { offset, limit } } },
  );
  return unwrap(res)!;
};

/**
 * Сохранить решение по одному файлу заявки (черновик до завершения проверки).
 * `PATCH …/documents/{fileId}/decision`.
 */
export const setDocumentDecision = async (
  key: BusinessApplicationKey,
  fileId: number,
  body: BusinessApplicationDocumentDecision,
): Promise<BusinessApplicationCard> => {
  const res = await api.PATCH(
    "/api/admin/business-registry/applications/{source}/{businessType}/{businessEntityId}/documents/{fileId}/decision",
    { params: { path: { ...key, fileId } }, body },
  );
  return unwrap(res)!;
};

/**
 * Завершить проверку документов заявки (без тела).
 * `POST …/documents/complete-review`.
 */
export const completeDocumentsReview = async (
  key: BusinessApplicationKey,
): Promise<BusinessApplicationCard> => {
  const res = await api.POST(
    "/api/admin/business-registry/applications/{source}/{businessType}/{businessEntityId}/documents/complete-review",
    { params: { path: key } },
  );
  return unwrap(res)!;
};

/**
 * Добавить загруженные администратором файлы в заявку.
 * `POST …/documents/attachments`.
 */
export const addDocumentAttachments = async (
  key: BusinessApplicationKey,
  fileIds: number[],
): Promise<BusinessApplicationCard> => {
  const res = await api.POST(
    "/api/admin/business-registry/applications/{source}/{businessType}/{businessEntityId}/documents/attachments",
    { params: { path: key }, body: { file_ids: fileIds } },
  );
  return unwrap(res)!;
};

/**
 * Изменить данные партнёра в заявке (в т.ч. решение по заявке через комментарий).
 * `PATCH …/partner`.
 */
export const updateBusinessPartner = async (
  key: BusinessApplicationKey,
  body: BusinessApplicationPartnerUpdate,
): Promise<BusinessApplicationCard> => {
  const res = await api.PATCH(
    "/api/admin/business-registry/applications/{source}/{businessType}/{businessEntityId}/partner",
    { params: { path: key }, body },
  );
  return unwrap(res)!;
};

/**
 * Изменить банковские реквизиты заявки.
 * `PATCH …/requisites`.
 */
export const updateBusinessRequisites = async (
  key: BusinessApplicationKey,
  body: BusinessApplicationRequisitesUpdate,
): Promise<BusinessApplicationCard> => {
  const res = await api.PATCH(
    "/api/admin/business-registry/applications/{source}/{businessType}/{businessEntityId}/requisites",
    { params: { path: key }, body },
  );
  return unwrap(res)!;
};

/* ------------------------------------------------- хуки React Query */

/** Показатели раздела за период. */
export const useBusinessRegistrySummary = (
  params: BusinessRegistrySummaryParams,
) =>
  useQuery({
    queryKey: businessRegistryKeys.summary(params),
    queryFn: () => getBusinessRegistrySummary(params),
  });

/**
 * Список заявок. Пока грузится следующая страница/фильтр — держит предыдущие
 * данные (`keepPreviousData`), чтобы список не мигал.
 */
export const useBusinessApplications = (
  params: BusinessApplicationsListParams,
) =>
  useQuery({
    queryKey: businessRegistryKeys.list(params),
    queryFn: () => getBusinessApplications(params),
    placeholderData: keepPreviousData,
  });

/** Карточка заявки. Запрос не идёт, пока ключ не задан. */
export const useBusinessApplication = (key: BusinessApplicationKey | null) =>
  useQuery({
    queryKey: businessRegistryKeys.detail(key as BusinessApplicationKey),
    queryFn: () => getBusinessApplication(key as BusinessApplicationKey),
    enabled: key != null,
  });

/** Комментарии к заявке. Запрос не идёт, пока ключ не задан. */
export const useBusinessApplicationComments = (
  key: BusinessApplicationKey | null,
  offset = 0,
) =>
  useQuery({
    queryKey: [...businessRegistryKeys.comments(key as BusinessApplicationKey), offset],
    queryFn: () => getBusinessApplicationComments(key as BusinessApplicationKey, offset),
    enabled: key != null,
  });

/**
 * Записать мутацию карточки в кэш и инвалидировать список/показатели.
 * Все мутации раздела возвращают свежую карточку — кладём её в `detail`,
 * чтобы модалка обновилась без лишнего перезапроса.
 */
const useCardMutation = <V>(
  mutationFn: (vars: V & { key: BusinessApplicationKey }) => Promise<BusinessApplicationCard>,
) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (card) => {
      // Ключ берём из самой карточки, а не из `vars.key`: при правке
      // `business_type` заявка «переезжает» на новый ключ (part пути), и кэш
      // надо класть под актуальный — иначе модалка после смены типа мигнёт.
      queryClient.setQueryData(
        businessRegistryKeys.detail({
          source: card.source,
          businessType: card.business_type,
          businessEntityId: card.business_entity_id,
        }),
        card,
      );
      queryClient.invalidateQueries({ queryKey: businessRegistryKeys.all });
    },
  });
};

/** Решение по одному файлу. */
export const useSetDocumentDecision = () =>
  useCardMutation<{ fileId: number; body: BusinessApplicationDocumentDecision }>(
    ({ key, fileId, body }) => setDocumentDecision(key, fileId, body),
  );

/** Завершение проверки документов. */
export const useCompleteDocumentsReview = () =>
  useCardMutation<Record<never, never>>(({ key }) =>
    completeDocumentsReview(key),
  );

/** Догрузка файлов администратором. */
export const useAddDocumentAttachments = () =>
  useCardMutation<{ fileIds: number[] }>(({ key, fileIds }) =>
    addDocumentAttachments(key, fileIds),
  );

/** Правка данных партнёра / решение по заявке. */
export const useUpdateBusinessPartner = () =>
  useCardMutation<{ body: BusinessApplicationPartnerUpdate }>(
    ({ key, body }) => updateBusinessPartner(key, body),
  );

/** Правка банковских реквизитов. */
export const useUpdateBusinessRequisites = () =>
  useCardMutation<{ body: BusinessApplicationRequisitesUpdate }>(
    ({ key, body }) => updateBusinessRequisites(key, body),
  );

export const requestBusinessBankVerification = async (key: BusinessApplicationKey) => {
  const response = await api.POST(
    "/api/admin/business-registry/applications/{source}/{businessType}/{businessEntityId}/bank-verification",
    { params: { path: key } },
  );
  return unwrap(response)!;
};

export const useRequestBusinessBankVerification = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: requestBusinessBankVerification,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: businessRegistryKeys.all }),
  });
};
