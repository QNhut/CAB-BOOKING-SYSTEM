import axios from "axios";

const GEOAPIFY_API_KEY = process.env.GEOAPIFY_API_KEY;
export const DEFAULT_LANG    = process.env.GEO_DEFAULT_LANG    || "vi";
export const DEFAULT_COUNTRY = (process.env.GEO_DEFAULT_COUNTRY || "vn").toLowerCase();

function toNum(x) { const n = Number(x); return Number.isFinite(n) ? n : null; }

export function assertQueryString(q) {
  if (!q || typeof q !== "string") throw new Error("q is required");
  if (q.trim().length < 2) throw new Error("q too short (min 2 chars)");
}

export function parseLatLng(lat, lng) {
  const la = toNum(lat), ln = toNum(lng);
  if (la == null || ln == null) return null;
  if (la < -90 || la > 90 || ln < -180 || ln > 180) return null;
  return { lat: la, lng: ln };
}

export async function autocomplete({ q, countryCode, languageCode, limit, center }) {
  const params = { apiKey: GEOAPIFY_API_KEY, text: q, format: "json", lang: languageCode, limit, filter: `countrycode:${countryCode}` };
  if (center) params.bias = `proximity:${center.lng},${center.lat}`;
  const resp = await axios.get("https://api.geoapify.com/v1/geocode/autocomplete", { params, timeout: 4000 });
  return Array.isArray(resp.data?.results) ? resp.data.results : [];
}

export async function placeDetails(placeId, languageCode) {
  const resp = await axios.get("https://api.geoapify.com/v2/place-details", {
    params: { apiKey: GEOAPIFY_API_KEY, id: placeId, lang: languageCode, features: "details" },
    timeout: 4000,
  });
  return resp.data;
}

export async function reverseGeocode(ll, languageCode) {
  const resp = await axios.get("https://api.geoapify.com/v1/geocode/reverse", {
    params: { apiKey: GEOAPIFY_API_KEY, lat: ll.lat, lon: ll.lng, lang: languageCode, format: "json" },
    timeout: 4000,
  });
  return Array.isArray(resp.data?.results) ? resp.data.results : [];
}
