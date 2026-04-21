import { ZIP_COORDS } from "./zipcodes";

export interface LatLng {
  lat: number;
  lng: number;
}

/** Representative center coordinates for each named play area. */
export const AREA_COORDS: Record<string, LatLng> = {
  "Burbank":          { lat: 34.1808, lng: -118.3090 },
  "Glendale":         { lat: 34.1425, lng: -118.2551 },
  "Studio City":      { lat: 34.1408, lng: -118.3911 },
  "North Hollywood":  { lat: 34.1739, lng: -118.3781 },
  "Pasadena":         { lat: 34.1468, lng: -118.1445 },
  "Encino":           { lat: 34.1664, lng: -118.5099 },
  "Sherman Oaks":     { lat: 34.1514, lng: -118.4407 },
  "Van Nuys":         { lat: 34.1873, lng: -118.4501 },
  "Chatsworth":       { lat: 34.2644, lng: -118.5802 },
  "Northridge":       { lat: 34.2258, lng: -118.5192 },
  "Granada Hills":    { lat: 34.2748, lng: -118.5085 },
  "Reseda":           { lat: 34.2005, lng: -118.5352 },
  "Woodland Hills":   { lat: 34.1781, lng: -118.5940 },
};

/**
 * Haversine great-circle distance in miles between two lat/lng points.
 */
export function haversineDistanceMiles(a: LatLng, b: LatLng): number {
  const R = 3958.8; // Earth radius in miles
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h =
    sinDLat * sinDLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinDLng * sinDLng;
  return R * 2 * Math.asin(Math.sqrt(h));
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Resolve a lat/lng for a player based on their zip code (primary)
 * or the centroid of their preferred play areas (fallback).
 * Returns null if neither is available.
 */
export function resolveCoords(
  zipCode: string | null | undefined,
  preferredAreas: string[],
): LatLng | null {
  // 1. Zip code lookup
  if (zipCode) {
    const clean = zipCode.trim().slice(0, 5);
    if (ZIP_COORDS[clean]) return ZIP_COORDS[clean];
  }

  // 2. Centroid of preferred areas
  const coords = preferredAreas
    .map((area) => AREA_COORDS[area])
    .filter((c): c is LatLng => c !== undefined);

  if (coords.length === 0) return null;

  const lat = coords.reduce((s, c) => s + c.lat, 0) / coords.length;
  const lng = coords.reduce((s, c) => s + c.lng, 0) / coords.length;
  return { lat, lng };
}
