import express from "express";
import cors from "cors";
import Redis from "ioredis";
import { createLogger } from "../../shared/logger.js";
import { createHttpMetrics } from "../../shared/http-metrics.js";
import { createTracingMiddleware } from "../../shared/jaeger-tracing.js";

const app = express();
app.use(cors());
app.use(express.json());
app.use(createTracingMiddleware("pricing-service"));

const PORT = process.env.PORT || 8002;
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const ETA_URL = process.env.ETA_URL || "http://eta-service:8009";
const log = createLogger("pricing-service");
const { metricsMiddleware, metricsEndpoint } = createHttpMetrics("pricing-service");
app.use(metricsMiddleware);

let redis;
try {
  redis = new Redis(REDIS_URL);
} catch (e) {
  log.warn("pricing_redis_unavailable", { error: e.message, mode: "surge_disabled" });
}
let pricingCacheHits = 0;
let pricingCacheMisses = 0;

const timeoutOnceKeys = new Set();

const PRICING_RULES = {
  CAR_4: { base: 12000, perKm: 8000, perMin: 0, minFare: 25000 },
  CAR_7: { base: 15000, perKm: 10000, perMin: 0, minFare: 30000 },
};

function calculateSurge(demand_index = 1.0, supply_index = 1.0) {
  const demand = Math.max(0, typeof demand_index === "number" ? demand_index : 1.0);
  const supply = Math.max(1, typeof supply_index === "number" ? supply_index : 1.0);
  const rawSurge = demand / supply;
  const surge = Math.max(1.0, Math.round(rawSurge * 100) / 100);
  return Math.min(surge, 5.0);
}

async function getCachedSurge(zone = "default") {
  if (!redis) return 1.0;
  try {
    const cached = await redis.get(`surge:${zone}`);
    if (cached) return Math.max(1.0, parseFloat(cached));
  } catch {}
  return 1.0;
}

async function updateSurgeMetrics(zone, demand, supply) {
  if (!redis) return;
  try {
    const surge = calculateSurge(demand, supply);
    await redis.setex(`surge:${zone}`, 300, surge.toString());
    await redis.setex(`surge:demand:${zone}`, 300, demand.toString());
    await redis.setex(`surge:supply:${zone}`, 300, supply.toString());
  } catch {}
}

function calcFare(vehicleType, distanceM, durationS, surge = 1.0) {
  const rule = PRICING_RULES[vehicleType];
  if (!rule) throw new Error("Unsupported vehicleType");

  const km = distanceM / 1000;
  const minutes = durationS / 60;
  const surgeMultiplier = Math.max(1.0, surge);
  const raw = (rule.base + rule.perKm * km + rule.perMin * minutes) * surgeMultiplier;
  const fare = Math.max(rule.minFare, Math.round(raw / 1000) * 1000);

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

async function getEtaEstimate(body) {
  const res = await fetch(`${ETA_URL}/eta/predict`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  let data = null;
  try {
    data = await res.json();
  } catch {}

  if (!res.ok) {
    const message = data?.error || `ETA service error: ${res.status}`;
    const error = new Error(message);
    error.status = res.status;
    throw error;
  }

  if (typeof data?.distanceM !== "number" || typeof data?.durationS !== "number") {
    throw new Error("ETA service returned invalid distance/duration payload");
  }

  return data;
}

function buildPricingCacheKey({ pickup, dropoff, distance_km, vehicleType, demand_index, supply_index, traffic_level, hour }) {
  return JSON.stringify({
    pickup: pickup || null,
    dropoff: dropoff || null,
    distance_km: typeof distance_km === "number" ? distance_km : null,
    vehicleType: vehicleType || "CAR_4",
    demand_index: typeof demand_index === "number" ? demand_index : null,
    supply_index: typeof supply_index === "number" ? supply_index : null,
    traffic_level: typeof traffic_level === "number" ? traffic_level : null,
    hour: Number.isInteger(hour) ? hour : null,
  });
}

app.post("/pricing/estimate", async (req, res) => {
  try {
    const { pickup, dropoff, distance_km, vehicleType = "CAR_4", demand_index, supply_index, zone, traffic_level, hour } = req.body || {};
    const testTimeoutMs = Number(req.body?.__test_timeout_ms || 0);
    const testFailOnceKey = req.body?.__test_fail_once_key;
    const cacheKey = `pricing:v2:${buildPricingCacheKey({ pickup, dropoff, distance_km, vehicleType, demand_index, supply_index, traffic_level, hour })}`;

    if (redis && testTimeoutMs <= 0 && !testFailOnceKey) {
      try {
        const cached = await redis.get(cacheKey);
        if (cached) {
          pricingCacheHits += 1;
          return res.json({ ...JSON.parse(cached), cache_hit: true });
        }
      } catch {}
    }
    pricingCacheMisses += 1;

    if (testTimeoutMs > 0) {
      const shouldDelay = !testFailOnceKey || !timeoutOnceKeys.has(testFailOnceKey);
      if (shouldDelay) {
        if (testFailOnceKey) timeoutOnceKeys.add(testFailOnceKey);
        await new Promise((resolve) => setTimeout(resolve, testTimeoutMs));
      }
    }

    const eta = await getEtaEstimate({ pickup, dropoff, distance_km, traffic_level, hour });
    const distanceM = eta.distanceM;
    const durationS = eta.durationS;

    let surge = 1.0;
    if (typeof demand_index === "number" && typeof supply_index === "number") {
      surge = calculateSurge(demand_index, supply_index);
      await updateSurgeMetrics(zone || "default", demand_index, supply_index);
    } else {
      surge = await getCachedSurge(zone || "default");
    }

    const { fare, currency, breakdown } = calcFare(vehicleType, distanceM, durationS, surge);

    const responseBody = {
      price: fare,
      base_fare: breakdown.base,
      distanceM,
      distance_km: eta.distance_km,
      durationS,
      fare,
      currency,
      breakdown,
      routeSource: eta.routeSource || "eta_service",
      eta: eta.eta ?? Math.round((durationS / 60) * 10) / 10,
      traffic_level: eta.traffic_level ?? null,
      demand_index: typeof demand_index === "number" ? demand_index : null,
      supply_index: typeof supply_index === "number" ? supply_index : null,
      surge_multiplier: surge,
    };

    if (redis && testTimeoutMs <= 0 && !testFailOnceKey) {
      try {
        await redis.setex(cacheKey, 30, JSON.stringify(responseBody));
      } catch {}
    }

    res.json(responseBody);
  } catch (e) {
    const status = e.status || (e instanceof TypeError || e instanceof RangeError ? 422 : 400);
    res.status(status).json({ error: e.message || "Bad Request" });
  }
});

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

app.get("/pricing/surge", async (req, res) => {
  const zone = req.query.zone || "default";
  const surge = await getCachedSurge(zone);
  let demand = null;
  let supply = null;
  if (redis) {
    try {
      demand = parseFloat(await redis.get(`surge:demand:${zone}`)) || null;
      supply = parseFloat(await redis.get(`surge:supply:${zone}`)) || null;
    } catch {}
  }
  res.json({ zone, surge_multiplier: surge, demand_index: demand, supply_index: supply });
});

app.get("/pricing/cache-stats", (_req, res) => {
  const total = pricingCacheHits + pricingCacheMisses;
  res.json({
    hits: pricingCacheHits,
    misses: pricingCacheMisses,
    hit_rate: total > 0 ? pricingCacheHits / total : 0,
  });
});

app.get("/health", (req, res) => res.json({ ok: true }));
app.get("/pricing/health", (req, res) => res.json({ ok: true }));
app.get("/metrics", metricsEndpoint);

app.listen(PORT, () => {
  log.info("pricing_service_started", { port: Number(PORT) });
});
