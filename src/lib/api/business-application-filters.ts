import { nextOffset, uniqueBy } from "@/lib/infinite-scroll";
import { BUSINESS_BANK_META } from "@/lib/business-bank-status";
import { getBusinessApplications, type BusinessApplicationsListParams, type BusinessType, type BusinessBankStatus } from "./business-registry";

export type BusinessApplicationsFilters = Omit<BusinessApplicationsListParams, "offset" | "business_type" | "bank_status"> & {
  business_types?: BusinessType[];
  bank_statuses?: BusinessBankStatus[];
};

/** API принимает по одному типу и статусу банка; выбранные сочетания объединяются по OR. */
export async function getBusinessApplicationsForTypes(params: BusinessApplicationsFilters, offsets: (number | null)[] = []) {
  const { business_types, bank_statuses, ...base } = params;
  const types = business_types?.length ? [...new Set(business_types)].sort() : [undefined];
  const selectedBanks = [...new Set(bank_statuses ?? [])].sort();
  const banks = selectedBanks.length && selectedBanks.length < Object.keys(BUSINESS_BANK_META).length ? selectedBanks : [undefined];
  const filters = types.flatMap(business_type => banks.map(bank_status => ({ business_type, bank_status })));
  const pages = await Promise.all(filters.map(({ business_type, bank_status }, index) => offsets[index] === null
    ? undefined
    : getBusinessApplications({ ...base, business_type, bank_status, offset: offsets[index] ?? 0 })));
  const nextOffsets = pages.map((page, index) => page
    ? nextOffset(page, page.items.length, offsets[index] ?? 0) ?? null
    : null);
  return {
    items: uniqueBy(pages.flatMap(page => page?.items ?? []), item => `${item.source}:${item.business_type}:${item.business_entity_id}`),
    total: pages.reduce((total, page) => total + (page?.total ?? 0), 0),
    offset: 0,
    limit: base.limit ?? 20,
    has_more: nextOffsets.some(offset => offset !== null),
    nextOffsets,
  };
}
