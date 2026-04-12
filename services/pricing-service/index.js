import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import Redis from "ioredis";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8002;
const OSRM_BASE_URL = process.env.OSRM_BASE_URL || "https://router.project-osrm.org";
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

let redis;
try {
  redis = new Redis(REDIS_URL);
} catch (e) {
  console.warn("[PRICING] Redis not available, surge pricing disabled");
}

// Base pricing rules (surge is calculated dynamically)
const PRICING_RULES = {
  CAR_4: { base: 12000, perKm: 8000, perMin: 0, minFare: 25000 },
  CAR_7: { base: 15000, perKm: 10000, perMin: 0, minFare: 30000 },
};

// ── Surge Pricing Engine ────────────────────────────────────────────────────
// surge = max(1.0, demand_index / supply_index)
// Rules: Price NEVER = 0, Surge NEVER < 1
function calculateSurge(demand_index = 1.0, supply_index = 1.0) {
  // Clamp inputs to valid range
  const demand = Math.max(0, typeof demand_index === "number" ? demand_index : 1.0);
  const supply = Math.max(0.01, typeof supply_index === "number" ? supply_index : 1.0); // prevent div by 0

  const rawSurge = demand / supply;
  const surge = Math.max(1.0, Math.round(rawSurge * 100) / 100); // never < 1, 2 decimals
  const cappedSurge = Math.min(surge, 5.0); // cap at 5x max surge

  return cappedSurge;
}

// Get cached surge factor from Redis (updated by surge pricing loop)
async function getCachedSurge(zone = "default") {
  if (!redis) return 1.0;
  try {
    const cached = await redis.get(`surge:${zone}`);
    if (cached) return Math.max(1.0, parseFloat(cached));
  } catch {}
  return 1.0;
}

// Store surge metrics in Redis
async function updateSurgeMetrics(zone, demand, supply) {
  if (!redis) return;
  try {
    const surge = calculateSurge(demand, supply);
    await redis.setex(`surge:${zone}`, 300, surge.toString()); // 5-min TTL
    await redis.setex(`surge:demand:${zone}`, 300, demand.toString());
    await redis.setex(`surge:supply:${zone}`, 300, supply.toString());
  } catch {}
}

function assertLatLng(p, name) {
  if (!p || typeof p.lat !== "number" || typeof p.lng !== "number") {
    throw new Error(`${name} must have lat,lng as numbers`);
  }
  if (p.lat < -90 || p.lat > 90 || p.lng < -180 || p.lng > 180) {
    throw new Error(`${name} lat/lng out of range`);
  }
}

async function getRouteOSRM(pickup, dropoff) {
  // OSRM expects "lng,lat;lng,lat"
  const coords = `${pickup.lng},${pickup.lat};${dropoff.lng},${dropoff.lat}`;
  const url = `${OSRM_BASE_URL}/route/v1/driving/${coords}?overview=false`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`OSRM error: ${res.status}`);
  }
  const data = await res.json();
  if (!data.routes?.length) throw new Error("OSRM: no route found");
  const r = data.routes[0];
  return { distanceM: Math.round(r.distance), durationS: Math.round(r.duration) };
}

function calcFare(vehicleType, distanceM, durationS, surge = 1.0) {
  const rule = PRICING_RULES[vehicleType];
  if (!rule) throw new Error("Unsupported vehicleType");

  const km = distanceM / 1000;
  const minutes = durationS / 60;
  const surgeMultiplier = Math.max(1.0, surge); // NEVER < 1

  const raw = (rule.base + rule.perKm * km + rule.perMin * minutes) * surgeMultiplier;
  const fare = Math.max(rule.minFare, Math.round(raw / 1000) * 1000); // round to 1k VND

  return {
    fare,
    currency: "VND",
    breakdown: {
      base: rule.base,
      perKm: rule.perKm,
      perMin: rule.perMin,
      minFare: rule.minFare,
      surge: surgeMultiplier,
    },
  };
}

/**
 * Haversine straight-line distance in metres.
 * Multiply by road factor (~1.35 urban) for estimated route distance.
 */
function haversineM(a, b) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const c = sinLat * sinLat + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng;
  return Math.round(2 * R * Math.asin(Math.sqrt(c)));
}

function estimateByHaversine(pickup, dropoff) {
  const straight = haversineM(pickup, dropoff);
  const distanceM = Math.round(straight * 1.35); // road factor
  const speedMps = 30 / 3.6;                     // 30 km/h urban average
  const durationS = Math.round(distanceM / speedMps);
  return { distanceM, durationS, estimated: true };
}

app.post("/pricing/estimate", async (req, res) => {
  try {
    const { pickup, dropoff, vehicleType = "CAR_4", demand_index, supply_index, zone } = req.body || {};
    assertLatLng(pickup, "pickup");
    assertLatLng(dropoff, "dropoff");

    let distanceM, durationS, routeSource;
    try {
      ({ distanceM, durationS } = await getRouteOSRM(pickup, dropoff));
      routeSource = "osrm";
    } catch (osrmErr) {
      console.warn("[PRICING] OSRM failed, using Haversine fallback:", osrmErr.message);
      ({ distanceM, durationS } = estimateByHaversine(pickup, dropoff));
      routeSource = "haversine";
    }

    // Calculate surge: use explicit params, or fetch cached, or default 1.0
    let surge = 1.0;
    if (typeof demand_index === "number" && typeof supply_index === "number") {
      surge = calculateSurge(demand_index, supply_index);
      // Also update cached metrics
      await updateSurgeMetrics(zone || "default", demand_index, supply_index);
    } else {
      surge = await getCachedSurge(zone || "default");
    }

    const { fare, currency, breakdown } = calcFare(vehicleType, distanceM, durationS, surge);

    res.json({
      distanceM,
      durationS,
      fare,
      currency,
      breakdown,
      routeSource,
      surge_multiplier: surge,
    });
  } catch (e) {
    res.status(400).json({ error: e.message || "Bad Request" });
  }
});

// ── POST /pricing/surge — Update surge factor for a zone ────────────────────
app.post("/pricing/surge", async (req, res) => {
  try {
    const { zone = "default", demand_index, supply_index } = req.body || {};
    if (typeof demand_index !== "number" || typeof supply_index !== "number") {
      return res.status(400).json({ error: "demand_index and supply_index are required numbers" });
    }
    const surge = calculateSurge(demand_index, supply_index);
    await updateSurgeMetrics(zone, demand_index, supply_index);
    res.json({ zone, surge_multiplier: surge, demand_index, supply_index });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// ── GET /pricing/surge — Get current surge for a zone ───────────────────────
app.get("/pricing/surge", async (req, res) => {
  const zone = req.query.zone || "default";
  const surge = await getCachedSurge(zone);
  let demand = null, supply = null;
  if (redis) {
    try {
      demand = parseFloat(await redis.get(`surge:demand:${zone}`)) || null;
      supply = parseFloat(await redis.get(`surge:supply:${zone}`)) || null;
    } catch {}
  }
  res.json({ zone, surge_multiplier: surge, demand_index: demand, supply_index: supply });
});

app.get("/health", (req, res) => res.json({ ok: true }));
app.get("/pricing/health", (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Pricing service running on http://localhost:${PORT}`);
});