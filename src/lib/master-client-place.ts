type Geo = { lat: number; lon: number } | null;
type ClientPlace = { address?: string | null; geolocation?: Geo };

/** Собрать CLIENT_PLACE; неизменный центр не передаём, чтобы PATCH сохранил его. */
export function clientPlaceLocation(
  address: string,
  geolocation: Geo,
  radiusKm: 1 | 5 | 10 | 20 | null,
  original: ClientPlace | null,
) {
  const location: {
    service_location: "CLIENT_PLACE";
    address?: string;
    geolocation?: Exclude<Geo, null>;
    radius_km?: 1 | 5 | 10 | 20;
  } = { service_location: "CLIENT_PLACE" };
  if (radiusKm != null) location.radius_km = radiusKm;

  const trimmed = address.trim();
  if (trimmed && geolocation && (
    trimmed !== (original?.address ?? "").trim() ||
    geolocation.lat !== original?.geolocation?.lat ||
    geolocation.lon !== original?.geolocation?.lon
  )) {
    location.address = trimmed;
    location.geolocation = geolocation;
  }
  return location;
}
