import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import axios from "axios";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = Number(process.env.PORT || 8007);
const GEOAPIFY_API_KEY = process.env.GEOAPIFY_API_KEY;

const DEFAULT_LANG = process.env.GEO_DEFAULT_LANG || "vi";
const DEFAULT_COUNTRY = (process.env.GEO_DEFAULT_COUNTRY || "vn").toLowerCase();

if (!GEOAPIFY_API_KEY) {
  console.error("❌ GEOAPIFY_API_KEY missing");
  process.exit(1);
}

function toNum(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

function assertQueryString(q) {
  if (!q || typeof q !== "string") throw new Error("q is required");
  if (q.trim().length < 2) throw new Error("q too short (min 2 chars)");
}

function parseLatLng(lat, lng) {
  const la = toNum(lat);
  const ln = toNum(lng);
  if (la == null || ln == null) return null;
  if (la < -90 || la > 90 || ln < -180 || ln > 180) return null;
  return { lat: la, lng: ln };
}

/**
 * GET /geo/autocomplete?q=...&lat=...&lng=...&limit=...
 * Optional:
 * - countryCode=vn
 * - languageCode=vi
 *
 * Geoapify endpoint:
 * - https://api.geoapify.com/v1/geocode/autocomplete?REQUEST_PARAMS  :contentReference[oaicite:4]{index=4}
 * Supports filter + bias params. :contentReference[oaicite:5]{index=5}
 */
app.get("/geo/autocomplete", async (req, res) => {
  try {
    const q = String(req.query.q || "");
    assertQueryString(q);

    const countryCode = String(req.query.countryCode || DEFAULT_COUNTRY).toLowerCase();
    const languageCode = String(req.query.languageCode || DEFAULT_LANG).toLowerCase();
    const limit = Math.min(Math.max(Number(req.query.limit || 10), 1), 20);

    const center = parseLatLng(req.query.lat, req.query.lng);

    // Geoapify params:
    // text: query string
    // format=json (easier parsing)
    // filter=countrycode:vn (restrict)
    // bias=proximity:lon,lat (prefer close results)
    const params = {
      apiKey: GEOAPIFY_API_KEY,
      text: q,
      format: "json",
      lang: languageCode,
      limit,
      filter: `countrycode:${countryCode}`,
    };

    if (center) {
      // Geoapify expects lon,lat order in proximity :contentReference[oaicite:6]{index=6}
      params.bias = `proximity:${center.lng},${center.lat}`;
    }

    const resp = await axios.get("https://api.geoapify.com/v1/geocode/autocomplete", {
      params,
      timeout: 4000,
    });

    // format=json returns array of results (not GeoJSON)
    const results = Array.isArray(resp.data?.results) ? resp.data.results : [];

    const suggestions = results
      .map((r) => ({
        placeId: r.place_id || null, // Geoapify returns place_id :contentReference[oaicite:7]{index=7}
        text: r.formatted || r.name || null,
        types: r.result_type ? [String(r.result_type)] : [],
        distanceMeters: typeof r.distance === "number" ? Math.round(r.distance) : null,
        location: typeof r.lat === "number" && typeof r.lon === "number"
          ? { lat: r.lat, lng: r.lon }
          : null,
      }))
      .filter((s) => s.placeId && s.text);

    res.json({ suggestions });
  } catch (e) {
    const msg = e.response?.data ? JSON.stringify(e.response.data) : e.message;
    res.status(400).json({ error: msg });
  }
});

/**
 * GET /geo/place/:placeId?languageCode=vi
 *
 * Geoapify Place Details:
 * - https://api.geoapify.com/v2/place-details?PARAMS :contentReference[oaicite:8]{index=8}
 * Inputs support id=<place_id> :contentReference[oaicite:9]{index=9}
 */
app.get("/geo/place/:placeId", async (req, res) => {
  try {
    const placeId = String(req.params.placeId || "");
    if (!placeId) throw new Error("placeId required");

    const languageCode = String(req.query.languageCode || DEFAULT_LANG).toLowerCase();

    const resp = await axios.get("https://api.geoapify.com/v2/place-details", {
      params: {
        apiKey: GEOAPIFY_API_KEY,
        id: placeId,
        lang: languageCode,
        features: "details",
      },
      timeout: 4000,
    });

    // Place details returns GeoJSON FeatureCollection in most cases.
    // We'll take first feature as the place "details".
    const feature = resp.data?.features?.[0];
    const props = feature?.properties || {};
    const geom = feature?.geometry;

    // Coordinates order in GeoJSON is [lon, lat]
    let location = null;
    if (geom?.type === "Point" && Array.isArray(geom.coordinates) && geom.coordinates.length >= 2) {
      location = { lat: geom.coordinates[1], lng: geom.coordinates[0] };
    } else if (typeof props.lat === "number" && typeof props.lon === "number") {
      location = { lat: props.lat, lng: props.lon };
    }

    res.json({
      placeId: props.place_id || placeId,
      name: props.name || props.address_line1 || null,
      formattedAddress: props.formatted || [props.address_line1, props.address_line2].filter(Boolean).join(", ") || null,
      location,
      raw: {
        country: props.country || null,
        city: props.city || null,
        postcode: props.postcode || null,
      },
    });
  } catch (e) {
    const msg = e.response?.data ? JSON.stringify(e.response.data) : e.message;
    res.status(400).json({ error: msg });
  }
});

/**
 * GET /geo/reverse?lat=...&lng=...&languageCode=vi
 * Reverse geocode: coordinates → formatted address name
 * Uses Geoapify reverse geocoding API
 */
app.get("/geo/reverse", async (req, res) => {
  try {
    const ll = parseLatLng(req.query.lat, req.query.lng);
    if (!ll) throw new Error("Valid lat and lng are required");
    const languageCode = String(req.query.languageCode || DEFAULT_LANG).toLowerCase();

    try {
      const resp = await axios.get("https://api.geoapify.com/v1/geocode/reverse", {
        params: {
          apiKey: GEOAPIFY_API_KEY,
          lat: ll.lat,
          lon: ll.lng,
          lang: languageCode,
          format: "json",
        },
        timeout: 4000,
      });

      const results = Array.isArray(resp.data?.results) ? resp.data.results : [];
      const r = results[0] || {};

      return res.json({
        name: r.name || r.address_line1 || null,
        formattedAddress: r.formatted || [r.address_line1, r.address_line2].filter(Boolean).join(", ") || null,
        location: { lat: ll.lat, lng: ll.lng },
      });
    } catch (geoErr) {
      // Geoapify unreachable — return coordinates as fallback (never 400)
      console.warn("[GEO] Geoapify reverse failed, using coordinate fallback:", geoErr.message);
      return res.json({
        name: null,
        formattedAddress: null,
        location: { lat: ll.lat, lng: ll.lng },
      });
    }
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.get("/health", (req, res) => res.json({ ok: true }));

app.listen(PORT, () => console.log(`✅ geo-service on http://localhost:${PORT}`));