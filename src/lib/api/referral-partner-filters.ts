import { uniqueBy } from "@/lib/infinite-scroll";
import { getReferralPartners, type ReferralPartnersParams, type ReferralLevelCode, type ReferralPartnerStatus } from "./referral";

export type ReferralPartnersFilters = Omit<ReferralPartnersParams, "offset" | "client_level_code" | "business_level_code" | "status"> & {
  statuses?: ReferralPartnerStatus[];
  client_level_codes?: ReferralLevelCode[];
  business_level_codes?: ReferralLevelCode[];
};

/** Each API request supports one level per line; combine disjoint selections with OR. */
export async function getReferralPartnersForLevels(params: ReferralPartnersFilters, offsets: (number | null)[] = []) {
  const { client_level_codes, business_level_codes, statuses, ...base } = params;
  const clients = client_level_codes?.length ? [...new Set(client_level_codes)].sort() : [undefined];
  const businesses = business_level_codes?.length ? [...new Set(business_level_codes)].sort() : [undefined];
  const states = statuses?.length ? [...new Set(statuses)].sort() : [undefined];
  const filters = clients.flatMap(client => businesses.flatMap(business => states.map(status => ({ client, business, status }))));
  const pages = await Promise.all(filters.map(({ client, business, status }, index) => offsets[index] === null
    ? undefined
    : getReferralPartners({ ...base, status, client_level_code: client, business_level_code: business, offset: offsets[index] ?? 0 })));
  const nextOffsets = pages.map((page, index) => {
    if (!page || page.items.length === 0) return null;
    const next = (offsets[index] ?? 0) + page.items.length;
    return next < page.total ? next : null;
  });
  return {
    items: uniqueBy(pages.flatMap(page => page?.items ?? []), item => item.referral_user_id),
    total: pages.reduce((total, page) => total + (page?.total ?? 0), 0),
    offset: 0,
    limit: base.limit ?? 20,
    nextOffsets,
  };
}
