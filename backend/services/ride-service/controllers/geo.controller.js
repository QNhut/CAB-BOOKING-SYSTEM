import { assertQueryString, parseLatLng, DEFAULT_LANG, DEFAULT_COUNTRY, autocomplete, placeDetails, reverseGeocode } from "../services/geo.service.js";

export function healthCheck(_req, res) { res.json({ ok: true }); }

export async function getAutocomplete(req, res) {
  try {
    const q = String(req.query.q || "");
    assertQueryString(q);
    const countryCode  = String(req.query.countryCode  || DEFAULT_COUNTRY).toLowerCase();
    const languageCode = String(req.query.languageCode || DEFAULT_LANG).toLowerCase();
    const limit        = Math.min(Math.max(Number(req.query.limit || 10), 1), 20);
    const center       = parseLatLng(req.query.lat, req.query.lng);

    const results = await autocomplete({ q, countryCode, languageCode, limit, center });
    const suggestions = results
      .map((r) => ({
        placeId: r.place_id || null,
        text: r.formatted || r.name || null,
        types: r.result_type ? [String(r.result_type)] : [],
        distanceMeters: typeof r.distance === "number" ? Math.round(r.distance) : null,
        location: typeof r.lat === "number" && typeof r.lon === "number" ? { lat: r.lat, lng: r.lon } : null,
      }))
      .filter((s) => s.placeId && s.text);

    res.json({ suggestions });
  } catch (e) {
    const msg = e.response?.data ? JSON.stringify(e.response.data) : e.message;
    res.status(400).json({ error: msg });
  }
}

export async function getPlaceDetails(req, res) {
  try {
    const placeId      = String(req.params.placeId || "");
    if (!placeId) throw new Error("placeId required");
    const languageCode = String(req.query.languageCode || DEFAULT_LANG).toLowerCase();

    const data    = await placeDetails(placeId, languageCode);
    const feature = data?.features?.[0];
    const props   = feature?.properties || {};
    const geom    = feature?.geometry;

    let location = null;
    if (geom?.type === "Point" && Array.isArray(geom.coordinates) && geom.coordinates.length >= 2)
      location = { lat: geom.coordinates[1], lng: geom.coordinates[0] };
    else if (typeof props.lat === "number" && typeof props.lon === "number")
      location = { lat: props.lat, lng: props.lon };

    res.json({
      placeId: props.place_id || placeId,
      name: props.name || props.address_line1 || null,
      formattedAddress: props.formatted || [props.address_line1, props.address_line2].filter(Boolean).join(", ") || null,
      location,
      raw: { country: props.country || null, city: props.city || null, postcode: props.postcode || null },
    });
  } catch (e) {
    const msg = e.response?.data ? JSON.stringify(e.response.data) : e.message;
    res.status(400).json({ error: msg });
  }
}

export async function reverseGeo(req, res) {
  try {
    const ll = parseLatLng(req.query.lat, req.query.lng);
    if (!ll) throw new Error("Valid lat and lng are required");
    const languageCode = String(req.query.languageCode || DEFAULT_LANG).toLowerCase();

    try {
      const results = await reverseGeocode(ll, languageCode);
      const r = results[0] || {};
      return res.json({
        name: r.name || r.address_line1 || null,
        formattedAddress: r.formatted || [r.address_line1, r.address_line2].filter(Boolean).join(", ") || null,
        location: { lat: ll.lat, lng: ll.lng },
      });
    } catch {
      return res.json({ name: null, formattedAddress: null, location: { lat: ll.lat, lng: ll.lng } });
    }
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
}
