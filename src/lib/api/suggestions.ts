import { keepPreviousData, useInfiniteQuery, useQuery } from "@tanstack/react-query";

import { api, unwrap } from "./client";
import type { components } from "./schema";

export type CitySuggestion = Pick<components["schemas"]["CitySuggestion"], "name" | "region" | "district">;

export function citySuggestionContext(place: { region?: string | null; district?: string | null }) {
  return [place.region, place.district].filter(Boolean).join(", ");
}

export function useAdvantageSuggestions(query: string, enabled: boolean) {
  return useQuery({
    queryKey: ["suggestions", "advantages", query],
    queryFn: async ({ signal }) => unwrap(await api.GET("/api/master/advantages/suggestions", {
      params: { query: { query, limit: 5 } },
      signal,
    }))?.items ?? [],
    enabled,
    staleTime: 60_000,
  });
}

export interface PlaceSuggestion {
  name: string;
  fias_id: string;
  type: "city" | "settlement";
  region?: string | null;
  district?: string | null;
}

/** Resolve a saved display name only when the API has one exact locality match. */
export function findSavedPlace(places: PlaceSuggestion[], name: string): PlaceSuggestion | null {
  const normalize = (value: string) => value.trim().toLocaleLowerCase("ru-RU")
    .replace(/^(?:город\s+|г\.?\s+)/u, "").replace(/\s+/gu, " ");
  const matches = places.filter((place) => place.fias_id && normalize(place.name) === normalize(name));
  return matches.length === 1 ? matches[0] : null;
}

const localityPageSize = 10;

function useLocalityPages<T>(
  key: readonly string[],
  fetchPage: (offset: number, signal: AbortSignal) => Promise<T[]>,
  enabled: boolean,
) {
  return useInfiniteQuery({
    queryKey: [...key, "pages"],
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) => fetchPage(pageParam, signal),
    enabled,
    getNextPageParam: (page, pages, offset) => {
      if (page.length < localityPageSize) return undefined;
      // Старый сервер может игнорировать offset и вернуть ту же страницу.
      const previous = pages.at(-2);
      if (previous && JSON.stringify(page) === JSON.stringify(previous)) return undefined;
      return offset + page.length;
    },
    select: ({ pages }) => pages.flatMap((page, index) => {
      const previous = pages[index - 1];
      return previous && JSON.stringify(page) === JSON.stringify(previous) ? [] : page;
    }),
  });
}

export async function getPlaceSuggestions(query: string, limit = 5, offset?: number, signal?: AbortSignal): Promise<PlaceSuggestion[]> {
  // offset поддерживается актуальным API; локальный снимок OpenAPI старее.
  const params = { query, limit, offset };
  return unwrap(await api.GET("/api/search/places", {
    params: { query: params },
    signal,
  })) ?? [];
}

export function useInfinitePlaceSuggestions(query: string, enabled: boolean) {
  return useLocalityPages(
    ["suggestions", "places", query],
    (offset, signal) => getPlaceSuggestions(query, localityPageSize, offset, signal),
    enabled && query.length > 0,
  );
}

export function usePlaceSuggestions(query: string, enabled: boolean) {
  return useQuery({
    queryKey: ["suggestions", "places", query],
    queryFn: () => getPlaceSuggestions(query),
    enabled: enabled && query.length > 0,
  });
}

export async function getPlaceAddressSuggestions(query: string, place: PlaceSuggestion): Promise<AddressSuggestion[]> {
  return unwrap(await api.GET("/api/search/addresses", {
    params: { query: { query, fias_id: place.fias_id, type: place.type, limit: 10 } },
  }))?.items ?? [];
}

export function usePlaceAddressSuggestions(query: string, place: PlaceSuggestion | null | undefined) {
  return useQuery({
    queryKey: ["suggestions", "place-addresses", place?.fias_id, place?.type, query],
    queryFn: () => getPlaceAddressSuggestions(query, place!),
    enabled: Boolean(place) && query.length > 0,
  });
}

/** Подсказка адреса: строка адреса + координаты для `geolocation`. */
export interface AddressSuggestion {
  address: string;
  lat: number;
  lon: number;
}

/** Ключи запросов TanStack Query для справочников-подсказок. */
export const suggestionsKeys = {
  all: ["suggestions"] as const,
  cities: (query: string) => [...suggestionsKeys.all, "cities", query] as const,
  addresses: (query: string) =>
    [...suggestionsKeys.all, "addresses", query] as const,
};

/**
 * Подсказки городов/населённых пунктов по строке поиска.
 * `GET /api/suggestions/cities`. Сохраняет область и район каждой подсказки.
 */
export const getCitySuggestions = async (
  query: string,
  limit = 20,
  offset?: number,
  signal?: AbortSignal,
): Promise<CitySuggestion[]> => {
  const params = { query, limit, offset };
  const res = await api.GET("/api/suggestions/cities", {
    params: { query: params },
    signal,
  });
  return unwrap(res)?.items ?? [];
};

/** Подсказки городов. Запрос идёт только для непустой строки поиска. */
export const useCitySuggestions = (query: string, enabled = true) => {
  const trimmed = query.trim();
  return useLocalityPages(
    suggestionsKeys.cities(trimmed),
    (offset, signal) => getCitySuggestions(trimmed, localityPageSize, offset, signal),
    enabled && trimmed.length > 0,
  );
};

/**
 * Подсказки адресов с координатами для автозаполнения.
 * `GET /api/suggestions/address`. Отдаёт адрес + `geolocation` сразу — без
 * `fias_id` (в отличие от `/api/search/addresses`).
 */
export const getAddressSuggestions = async (
  query: string,
  limit = 10,
): Promise<AddressSuggestion[]> => {
  const res = await api.GET("/api/suggestions/address", {
    params: { query: { query, limit } },
  });
  const items = unwrap(res)?.items ?? [];
  return items.map((a) => ({
    address: a.address,
    lat: a.geolocation.lat,
    lon: a.geolocation.lon,
  }));
};

/** Подсказки адресов. Запрос идёт только для непустой строки поиска. */
export const useAddressSuggestions = (query: string, enabled = true) => {
  const trimmed = query.trim();
  return useQuery({
    queryKey: suggestionsKeys.addresses(trimmed),
    queryFn: () => getAddressSuggestions(trimmed),
    enabled: enabled && trimmed.length > 0,
    placeholderData: keepPreviousData,
  });
};
