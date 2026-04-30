import redis from "../config/redis.js";

const OSRM_BASE_URL = process.env.OSRM_BASE_URL || "https://router.project-osrm.org";

const PRICING_RULES = {
  CAR_4: { base: 12000, perKm: 8000, perMin: 0, minFare: 25000 },
  CAR_7: { base: 15000, perKm: 10000, perMin: 0, minFare: 30000 },
};

export function calculateSurge(demand_index = 1.0, supply_index = 1.0) {
  const demand = Math.max(0, typeof demand_index === "number" ? demand_index : 1.0);
  const supply = Math.max(0.01, typeof supply_index === "number" ? supply_index : 1.0);
  return Math.min(Math.max(1.0, Math.round((demand / supply) * 100) / 100), 5.0);
}

export async function getCachedSurge(zone = "default") {
  if (!redis) return 1.0;
  try {
    const cached = await redis.get(`surge:${zone}`);
    if (cached) return Math.max(1.0, parseFloat(cached));
  } catch {}
  return 1.0;
}

export async function updateSurgeMetrics(zone, demand, supply) {
  if (!redis) return;
  try {
    const surge = calculateSurge(demand, supply);
    await redis.setex(`surge:${zone}`, 300, surge.toString());
    await redis.setex(`surge:demand:${zone}`, 300, demand.toString());
    await redis.setex(`surge:supply:${zone}`, 300, supply.toString());
  } catch {}
}

export function assertLatLng(p, name) {
  if (!p || typeof p.lat !== "number" || typeof p.lng !== "number")
    throw new Error(`${name} must have lat,lng as numbers`);
  if (p.lat < -90 || p.lat > 90 || p.lng < -180 || p.lng > 180)
    throw new Error(`${name} lat/lng out of range`);
}

export async function getRouteOSRM(pickup, dropoff) {
  const coords = `${pickup.lng},${pickup.lat};${dropoff.lng},${dropoff.lat}`;
  const res = await fetch(`${OSRM_BASE_URL}/route/v1/driving/${coords}?overview=false`);
  if (!res.ok) throw new Error(`OSRM error: ${res.status}`);
  const data = await res.json();
  if (!data.routes?.length) throw new Error("OSRM: no route found");
  const r = data.routes[0];
  return { distanceM: Math.round(r.distance), durationS: Math.round(r.duration) };
}

export function estimateByHaversine(pickup, dropoff) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(dropoff.lat - pickup.lat);
  const dLng = toRad(dropoff.lng - pickup.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const c = sinLat * sinLat + Math.cos(toRad(pickup.lat)) * Math.cos(toRad(dropoff.lat)) * sinLng * sinLng;
  const straight = Math.round(2 * R * Math.asin(Math.sqrt(c)));
  const distanceM = Math.round(straight * 1.35);
  const durationS = Math.round(distanceM / (30 / 3.6));
  return { distanceM, durationS, estimated: true };
}

export function calcFare(vehicleType, distanceM, durationS, surge = 1.0) {
  const rule = PRICING_RULES[vehicleType];
  if (!rule) throw new Error("Unsupported vehicleType");
  const km = distanceM / 1000;
  const minutes = durationS / 60;
  const surgeMultiplier = Math.max(1.0, surge);
  const raw  = (rule.base + rule.perKm * km + rule.perMin * minutes) * surgeMultiplier;
  const fare = Math.max(rule.minFare, Math.round(raw / 1000) * 1000);
  return { fare, currency: "VND", breakdown: { base: rule.base, perKm: rule.perKm, perMin: rule.perMin, minFare: rule.minFare, surge: surgeMultiplier } };
}
