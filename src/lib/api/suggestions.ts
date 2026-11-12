import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { api, unwrap } from "./client";

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

export async function getPlaceSuggestions(query: string): Promise<PlaceSuggestion[]> {
  return unwrap(await api.GET("/api/search/places", {
    params: { query: { query, limit: 5 } },
  })) ?? [];
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
 * `GET /api/suggestions/cities`. Возвращает уникальные названия.
 */
export const getCitySuggestions = async (
  query: string,
  limit = 20,
): Promise<string[]> => {
  const res = await api.GET("/api/suggestions/cities", {
    params: { query: { query, limit } },
  });
  const items = unwrap(res)?.items ?? [];
  return [...new Set(items.map((c) => c.name))];
};

/** Подсказки городов. Запрос идёт только для непустой строки поиска. */
export const useCitySuggestions = (query: string, enabled = true) => {
  const trimmed = query.trim();
  return useQuery({
    queryKey: suggestionsKeys.cities(trimmed),
    queryFn: () => getCitySuggestions(trimmed),
    enabled: enabled && trimmed.length > 0,
    placeholderData: keepPreviousData,
  });
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
