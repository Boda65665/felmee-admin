import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Client } from "openapi-fetch";

import { nextOffset, uniqueBy } from "@/lib/infinite-scroll";
import { api, unwrap, type Envelope } from "./client";
import type { components } from "./schema";

export type ServiceStatus = "ACTIVE" | "PENDING_DELETION";
export type ServiceProvider = "MASTER" | "SALON";
export type ServicePriceInterval = components["schemas"]["ServicePriceInterval"];
export type ServiceLocation = components["schemas"]["ServiceLocationResponse"];

export interface AdminServiceListItem {
  id: number;
  name: string | null;
  preview_file_id?: number | null;
  price: number | null;
  duration: number | null;
  category_id: number | null;
  category_name: string | null;
  provider_id: number | null;
  salon_id?: number | null;
  provider_type: ServiceProvider | null;
  provider_name: string | null;
  is_fix_price: boolean;
  status: ServiceStatus;
  deletion_requested_at: string | null;
}

export interface AdminService extends AdminServiceListItem {
  parent_category_id: number | null;
  description: string | null;
  price_intervals: ServicePriceInterval[] | null;
  discount_percent: number | null;
  images: number[] | null;
  service_locations: ServiceLocation[] | null;
  address: string | null;
  geo: { lat?: number; lon?: number } | null;
  advantages: string[] | null;
  seo_queries: string[] | null;
  rating: number | null;
  reviews_count: number | null;
}

export interface ServiceCategory {
  id: number;
  name: string | null;
  parent_id: number | null;
}

export interface ServicesFilters {
  q?: string;
  category_id?: number;
  provider_id?: number;
  provider_type?: ServiceProvider;
  status?: ServiceStatus;
  sort?: `price:${"asc" | "desc"}`;
}

export type AdminServicePatch = Omit<components["schemas"]["UpdateServiceRequest"], "master_user_ids"> & {
  address?: string;
  geolocation?: { lat: number; lon: number };
};

interface ServicesPageData {
  items: AdminServiceListItem[];
  offset: number;
  limit: number;
  has_more: boolean;
}

type Json<T> = { content: { "application/json": T } };
type Responses<T> = {
  responses: {
    200: Json<Envelope<T>>;
    default: Json<Envelope<unknown>>;
  };
};
type ServicePath = { parameters: { path: { service_id: number } } };

interface ServicesPaths {
  "/api/admin/services": {
    get: Responses<ServicesPageData> & {
      parameters: { query: ServicesFilters & { offset: number; limit: number } };
    };
  };
  "/api/admin/services/categories": { get: Responses<ServiceCategory[]> };
  "/api/admin/services/{service_id}": {
    get: Responses<AdminService> & ServicePath;
    patch: Responses<{ changed: boolean; service: AdminService }> & ServicePath & {
      requestBody: Json<AdminServicePatch>;
    };
    delete: Responses<{ deletion_pending: boolean }> & ServicePath;
  };
}

// Эти маршруты используют тот же клиент, включая авторизацию и обновление сессии.
const servicesApi = api as unknown as Client<ServicesPaths>;
const listKey = ["admin-services", "list"] as const;
const detailKey = (id: number | null) => ["admin-services", "detail", id] as const;
const serviceEndpoint = "/api/admin/services/{service_id}";

export function useServices(filters: ServicesFilters) {
  return useInfiniteQuery({
    queryKey: [...listKey, filters],
    initialPageParam: 0,
    queryFn: async ({ pageParam, signal }) =>
      unwrap(await servicesApi.GET("/api/admin/services", {
        params: { query: { ...filters, offset: pageParam, limit: 25 } },
        signal,
      })),
    getNextPageParam: (page) => nextOffset(page, page.items.length, page.offset),
    select: ({ pages }) => uniqueBy(pages.flatMap((page) => page.items), (item) => item.id),
  });
}

export function useServiceCategories() {
  return useQuery({
    queryKey: ["admin-services", "categories"],
    queryFn: async ({ signal }) => unwrap(await servicesApi.GET("/api/admin/services/categories", { signal })),
  });
}

export function useService(id: number | null) {
  return useQuery({
    queryKey: detailKey(id),
    enabled: id != null,
    queryFn: async ({ signal }) => unwrap(await servicesApi.GET(serviceEndpoint, {
      params: { path: { service_id: id! } },
      signal,
    })),
  });
}

export function useUpdateService() {
  const cache = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id: number; body: AdminServicePatch }) =>
      unwrap(await servicesApi.PATCH(serviceEndpoint, {
        params: { path: { service_id: id } },
        body,
      })),
    onSuccess: async ({ service }, { id }) => {
      await cache.cancelQueries({ queryKey: detailKey(id) });
      cache.setQueryData(detailKey(id), service);
      void cache.invalidateQueries({ queryKey: listKey });
    },
  });
}

export function useDeleteService() {
  const cache = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => unwrap(await servicesApi.DELETE(serviceEndpoint, {
      params: { path: { service_id: id } },
    })),
    onSuccess: ({ deletion_pending }, id) => {
      if (deletion_pending) {
        void cache.invalidateQueries({ queryKey: detailKey(id) });
      } else {
        cache.removeQueries({ queryKey: detailKey(id) });
      }
      void cache.invalidateQueries({ queryKey: listKey });
    },
  });
}
