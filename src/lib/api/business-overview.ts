import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import type { Client } from "openapi-fetch";

import { nextOffset, uniqueBy } from "@/lib/infinite-scroll";
import { api, unwrap, type Envelope } from "./client";

export type OverviewPeriod = { from: string; to: string };
export type OverviewMetric = { value: number; change_percent: number | null };
export type OverviewDay = {
  date: string;
  gmv_rub: number;
  commission_rub: number;
  average_check_rub: number;
  booking_payment_percent: number | null;
};

type Overview = {
  period: OverviewPeriod & { previous_from: string; previous_to: string };
  gmv_rub: OverviewMetric;
  commission_rub: OverviewMetric;
  average_check_rub: OverviewMetric;
  new_clients: OverviewMetric;
  records: OverviewMetric;
  cancellation_percent: number;
  cancellation_change_points: number;
  days: OverviewDay[];
};

export type OperationStatus = "COMPLETED" | "FROZEN" | "CANCELED" | "REFUND";
export type OperationSort = "occurred_at:desc" | "occurred_at:asc" | "amount_rub:asc" | "amount_rub:desc";
type Operation = {
  id: string;
  record_id: number;
  type: "PAYMENT" | "REFUND";
  service_name: string | null;
  client_name: string | null;
  amount_rub: number;
  occurred_at: string;
  status: OperationStatus;
  commission_rub: number | null;
};
type OperationPage = { items: Operation[]; has_more: boolean };
type OperationFilters = OverviewPeriod & { query?: string; status?: OperationStatus[]; sort?: OperationSort };

type Get<Query, Data> = {
  get: {
    parameters: { query: Query };
    responses: {
      200: { content: { "application/json": Envelope<Data> } };
      default: { content: { "application/json": Envelope<unknown> } };
    };
  };
};

type OverviewPaths = {
  "/api/admin/business-overview": Get<OverviewPeriod, Overview>;
  "/api/admin/business-overview/operations": Get<OperationFilters & { offset: number; limit: number }, OperationPage>;
};

const overviewApi = api as unknown as Client<OverviewPaths>;

export const useBusinessOverview = (period: OverviewPeriod, enabled: boolean) =>
  useQuery({
    queryKey: ["business-overview", period],
    enabled,
    queryFn: async ({ signal }) =>
      unwrap(await overviewApi.GET("/api/admin/business-overview", { params: { query: period }, signal })),
  });

export const useBusinessOperations = (filters: OperationFilters, enabled: boolean) =>
  useInfiniteQuery({
    queryKey: ["business-overview", "operations", filters],
    enabled,
    initialPageParam: 0,
    queryFn: async ({ pageParam, signal }) =>
      unwrap(await overviewApi.GET("/api/admin/business-overview/operations", {
        params: { query: { ...filters, offset: pageParam, limit: 25 } },
        signal,
      })),
    getNextPageParam: (page, _pages, offset) => nextOffset(page, page.items.length, offset),
    select: ({ pages }) => uniqueBy(pages.flatMap((page) => page.items), (item) => item.id),
  });
