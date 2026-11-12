import { nextOffset, uniqueBy } from "@/lib/infinite-scroll";
import { getBusinessApplications, type BusinessApplicationsListParams, type BusinessType } from "./business-registry";

export type BusinessApplicationsFilters = Omit<BusinessApplicationsListParams, "offset" | "business_type"> & {
  business_types?: BusinessType[];
};

export async function getBusinessApplicationsForTypes(params: BusinessApplicationsFilters, offsets: (number | null)[] = []) {
  const { business_types, ...base } = params;
  const types = business_types?.length ? [...new Set(business_types)].sort() : [undefined];
  const pages = await Promise.all(types.map((business_type, index) => offsets[index] === null
    ? undefined
    : getBusinessApplications({ ...base, business_type, offset: offsets[index] ?? 0 })));
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
