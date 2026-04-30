import redis from "../config/redis.js";
import {
  assertLatLng, getRouteOSRM, estimateByHaversine, calculateSurge,
  updateSurgeMetrics, getCachedSurge, calcFare,
} from "../services/pricing.service.js";

export async function healthCheck(_req, res) { res.json({ ok: true }); }

// Simple pricing: accepts distance_km + demand/supply indices directly
export async function simplePrice(req, res) {
  try {
    const { distance_km = 5, demand_index, supply_index, zone, simulate_timeout } = req.body || {};
    if (simulate_timeout) {
      return res.status(503).json({ message: 'Pricing service timeout (simulated)', fallback: true });
    }
    if (typeof distance_km !== "number" || distance_km < 0)
      return res.status(400).json({ message: "distance_km must be a non-negative number" });

    let surge = 1.0;
    if (typeof demand_index === "number" && typeof supply_index === "number") {
      surge = calculateSurge(demand_index, supply_index);
      await updateSurgeMetrics(zone || "default", demand_index, supply_index);
    } else if (typeof demand_index === "number") {
      // supply_index not provided: assume balanced (1.0)
      surge = calculateSurge(demand_index, 1.0);
    } else {
      surge = await getCachedSurge(zone || "default");
    }

    const distM     = Math.round(distance_km * 1000);
    const durationS = Math.round(distance_km * 120);
    const vehicleType = req.body.vehicleType || "CAR_4";
    const { fare, currency, breakdown } = calcFare(vehicleType, distM, durationS, surge);
    res.json({ price: fare, fare, currency, breakdown, surge, surge_multiplier: surge, distance_km });
  } catch (e) {
    res.status(400).json({ error: e.message || "Bad Request" });
  }
}

export async function estimatePrice(req, res) {
  try {
    const { pickup, dropoff, vehicleType = "CAR_4", demand_index, supply_index, zone } = req.body || {};
    assertLatLng(pickup, "pickup");
    assertLatLng(dropoff, "dropoff");

    let distanceM, durationS, routeSource;
    try {
      ({ distanceM, durationS } = await getRouteOSRM(pickup, dropoff));
      routeSource = "osrm";
    } catch (e) {
      console.warn("[PRICING] OSRM failed, using Haversine fallback:", e.message);
      ({ distanceM, durationS } = estimateByHaversine(pickup, dropoff));
      routeSource = "haversine";
    }

    let surge = 1.0;
    if (typeof demand_index === "number" && typeof supply_index === "number") {
      surge = calculateSurge(demand_index, supply_index);
      await updateSurgeMetrics(zone || "default", demand_index, supply_index);
    } else {
      surge = await getCachedSurge(zone || "default");
    }

    const { fare, currency, breakdown } = calcFare(vehicleType, distanceM, durationS, surge);
    res.json({ distanceM, durationS, fare, currency, breakdown, routeSource, surge_multiplier: surge });
  } catch (e) {
    res.status(400).json({ error: e.message || "Bad Request" });
  }
}

export async function updateSurge(req, res) {
  try {
    const { zone = "default", demand_index, supply_index } = req.body || {};
    if (typeof demand_index !== "number" || typeof supply_index !== "number")
      return res.status(400).json({ error: "demand_index and supply_index are required numbers" });
    const surge = calculateSurge(demand_index, supply_index);
    await updateSurgeMetrics(zone, demand_index, supply_index);
    res.json({ zone, surge_multiplier: surge, demand_index, supply_index });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
}

export async function getSurge(req, res) {
  const zone  = req.query.zone || "default";
  const surge = await getCachedSurge(zone);
  let demand = null, supply = null;
  if (redis) {
    try {
      demand = parseFloat(await redis.get(`surge:demand:${zone}`)) || null;
      supply = parseFloat(await redis.get(`surge:supply:${zone}`)) || null;
    } catch {}
  }
  res.json({ zone, surge_multiplier: surge, demand_index: demand, supply_index: supply });
}
