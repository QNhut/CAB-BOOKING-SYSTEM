import { http } from "../lib/http";
import { ENV } from "../lib/env";

export type GeoSuggestion = {
  placeId: string;
  text: string;
  types: string[];
  distanceMeters: number | null;
  location?: { lat: number; lng: number } | null;
};

export async function geoAutocomplete(params: {
  q: string;
  lat?: number;
  lng?: number;
  limit?: number;
}) {
  const resp = await http.get(`${ENV.GEO_URL}/geo/autocomplete`, { params });
  return resp.data as { suggestions: GeoSuggestion[] };
}

export async function geoPlace(placeId: string) {
  const resp = await http.get(`${ENV.GEO_URL}/geo/place/${encodeURIComponent(placeId)}`);
  return resp.data as {
    placeId: string;
    name: string | null;
    formattedAddress: string | null;
    location: { lat: number; lng: number } | null;
  };
}

/**
 * Reverse geocode: lat/lng → human-readable address.
 * Returns formattedAddress, or null if service unavailable.
 */
export async function geoReverse(lat: number, lng: number): Promise<string | null> {
  try {
    const resp = await http.get(`${ENV.GEO_URL}/geo/reverse`, { params: { lat, lng } });
    return resp.data?.formattedAddress || resp.data?.name || null;
  } catch {
    return null;
  }
}