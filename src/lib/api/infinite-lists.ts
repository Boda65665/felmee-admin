import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { nextOffset, uniqueBy } from "@/lib/infinite-scroll";
import { getClients, clientsKeys, type ClientsListParams } from "./clients";
import { getMastersSalons, mastersSalonsKeys, type MasterSalonListParams } from "./masters-salons";
import { getModerationRequests, moderationKeys, type ModerationListParams } from "./moderation";
import { getRecords, recordsKeys, type RecordsListParams } from "./records";
import { getActionHistory, actionHistoryKeys, type ActionHistoryParams } from "./action-history";
import { businessRegistryKeys } from "./business-registry";
import { getBusinessApplicationsForTypes, type BusinessApplicationsFilters } from "./business-application-filters";
import { getNotifications, notificationsKeys, type NotificationsListParams } from "./notifications";
import { getReferralPartnerCard, referralKeys, type ReferralPartnerCardParams } from "./referral";
import { getReferralPartnersForLevels, type ReferralPartnersFilters } from "./referral-partner-filters";
import { getBusinessApplicationComments, type BusinessApplicationKey } from "./business-registry";
import { getSupportChats, supportKeys, type SupportChatsParams } from "./support";
import { getComplaints, complaintsKeys, type ComplaintsListParams } from "./complaints";

export const useInfiniteComplaints = (params: Omit<ComplaintsListParams, "offset">) =>
  useInfiniteQuery({
    queryKey: [...complaintsKeys.all, "infinite", params],
    placeholderData: keepPreviousData,
    initialPageParam: 0,
    gcTime: 0,
    queryFn: ({ pageParam }) => getComplaints({ ...params, offset: pageParam }),
    getNextPageParam: (page, _pages, offset) => nextOffset(page, page.items.length, offset),
    select: ({ pages }) => ({
      ...pages[0],
      items: uniqueBy(pages.flatMap((page) => page.items), (item) => item.complaint_id),
    }),
  });

export const useInfiniteClients = (params: Omit<ClientsListParams, "offset">) =>
  useInfiniteQuery({
    queryKey: [...clientsKeys.all, "infinite", params],
    placeholderData: keepPreviousData,
    initialPageParam: 0,
    gcTime: 0,
    queryFn: ({ pageParam }) => getClients({ ...params, offset: pageParam }),
    getNextPageParam: (page, _pages, offset) => nextOffset(page, page.items.length, offset),
    select: ({ pages }) => ({
      ...pages[0],
      items: uniqueBy(pages.flatMap((page) => page.items), (item) => item.id),
    }),
  });


export const useInfiniteMastersSalons = (params: Omit<MasterSalonListParams, "offset">) =>
  useInfiniteQuery({
    queryKey: [...mastersSalonsKeys.all, "infinite", params],
    placeholderData: keepPreviousData,
    initialPageParam: 0,
    gcTime: 0,
    queryFn: ({ pageParam }) => getMastersSalons({ ...params, offset: pageParam }),
    getNextPageParam: (page, _pages, offset) => nextOffset(page, page.items.length, offset),
    select: ({ pages }) => ({
      ...pages[0],
      items: uniqueBy(pages.flatMap((page) => page.items), (item) => `${item.role}:${item.id}`),
    }),
  });


export const useInfiniteModerationRequests = (params: Omit<ModerationListParams, "offset">) =>
  useInfiniteQuery({
    queryKey: [...moderationKeys.all, "infinite", params],
    placeholderData: keepPreviousData,
    initialPageParam: 0,
    gcTime: 0,
    queryFn: ({ pageParam }) => getModerationRequests({ ...params, offset: pageParam }),
    getNextPageParam: (page, _pages, offset) => nextOffset(page, page.items.length, offset),
    select: ({ pages }) => ({
      ...pages[0],
      items: uniqueBy(pages.flatMap((page) => page.items), (item) => item.request_id),
    }),
  });


export const useInfiniteRecords = (params: Omit<RecordsListParams, "offset">) =>
  useInfiniteQuery({
    queryKey: [...recordsKeys.all, "infinite", params],
    placeholderData: keepPreviousData,
    initialPageParam: 0,
    gcTime: 0,
    queryFn: ({ pageParam }) => getRecords({ ...params, offset: pageParam }),
    getNextPageParam: (page, _pages, offset) => nextOffset(page, page.items.length, offset),
    select: ({ pages }) => ({
      ...pages[0],
      items: uniqueBy(pages.flatMap((page) => page.items), (item) => item.record_id),
    }),
  });

export const useInfiniteBusinessComments = (key: BusinessApplicationKey | null) =>
  useInfiniteQuery({
    queryKey: [...businessRegistryKeys.all, "infinite-comments", key],
    initialPageParam: 0,
    enabled: key != null,
    gcTime: 0,
    queryFn: ({ pageParam }) => getBusinessApplicationComments(key!, pageParam),
    getNextPageParam: (page, _pages, offset) => nextOffset(page, page.items.length, offset),
    select: ({ pages }) => ({
      ...pages[0],
      items: uniqueBy(pages.flatMap((page) => page.items), (item) => item.id),
    }),
  });

export const useInfiniteReferralPartnerCard = (
  id: number | null,
  params: Omit<ReferralPartnerCardParams, "offset">,
) => useInfiniteQuery({
  queryKey: [...referralKeys.all, "infinite-card", id, params],
  initialPageParam: 0,
  enabled: id != null,
  gcTime: 0,
  queryFn: ({ pageParam }) => getReferralPartnerCard(id!, { ...params, offset: pageParam }),
  getNextPageParam: (page, _pages, offset) => nextOffset(page.referrals, page.referrals.items.length, offset),
  select: ({ pages }) => ({
    ...pages[0],
    referrals: {
      ...pages[0].referrals,
      items: uniqueBy(pages.flatMap((page) => page.referrals.items), (item) => item.referral_id),
    },
  }),
});


export const useInfiniteActionHistory = (params: Omit<ActionHistoryParams, "offset">) =>
  useInfiniteQuery({
    queryKey: [...actionHistoryKeys.all, "infinite", params],
    initialPageParam: 0,
    gcTime: 0,
    queryFn: ({ pageParam }) => getActionHistory({ ...params, offset: pageParam }),
    getNextPageParam: (page, _pages, offset) => nextOffset(page, page.items.length, offset),
    select: ({ pages }) => ({
      ...pages[0],
      items: uniqueBy(pages.flatMap((page) => page.items), (item) => item.id),
    }),
  });


export const useInfiniteBusinessApplications = (params: BusinessApplicationsFilters) =>
  useInfiniteQuery({
    queryKey: [...businessRegistryKeys.all, "infinite", params],
    placeholderData: keepPreviousData,
    initialPageParam: [] as (number | null)[],
    gcTime: 0,
    queryFn: ({ pageParam }) => getBusinessApplicationsForTypes(params, pageParam),
    getNextPageParam: (page) => page.nextOffsets.some(offset => offset !== null) ? page.nextOffsets : undefined,
    select: ({ pages }) => ({
      ...pages[0],
      items: uniqueBy(pages.flatMap((page) => page.items), (item) => `${item.source}:${item.business_type}:${item.business_entity_id}`),
    }),
  });


export const useInfiniteNotifications = (params: Omit<NotificationsListParams, "offset">) =>
  useInfiniteQuery({
    queryKey: [...notificationsKeys.all, "infinite", params],
    initialPageParam: 0,
    gcTime: 0,
    queryFn: ({ pageParam }) => getNotifications({ ...params, offset: pageParam }),
    getNextPageParam: (page, _pages, offset) => nextOffset(page, page.items.length, offset),
    select: ({ pages }) => ({
      ...pages[0],
      items: uniqueBy(pages.flatMap((page) => page.items), (item) => item.id),
    }),
  });


export const useInfiniteReferralPartners = (params: ReferralPartnersFilters) =>
  useInfiniteQuery({
    queryKey: [...referralKeys.all, "infinite", params],
    placeholderData: keepPreviousData,
    initialPageParam: [] as (number | null)[],
    gcTime: 0,
    queryFn: ({ pageParam }) => getReferralPartnersForLevels(params, pageParam),
    getNextPageParam: (page) => page.nextOffsets.some(offset => offset !== null) ? page.nextOffsets : undefined,
    select: ({ pages }) => ({
      ...pages[0],
      items: uniqueBy(pages.flatMap((page) => page.items), (item) => item.referral_user_id),
    }),
  });


export const useInfiniteSupportChats = (params: Omit<SupportChatsParams, "offset">) =>
  useInfiniteQuery({
    queryKey: [...supportKeys.all, "infinite", params],
    initialPageParam: 0,
    gcTime: 0,
    queryFn: ({ pageParam }) => getSupportChats({ ...params, offset: pageParam }),
    getNextPageParam: (page, _pages, offset) => nextOffset(page, page.chats.length, offset),
    select: ({ pages }) => ({
      ...pages[0],
      chats: uniqueBy(pages.flatMap((page) => page.chats), (item) => item.dialog_id),
    }),
  });
