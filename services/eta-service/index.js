import express from "express";
import cors from "cors";
import Redis from "ioredis";
import { createLogger } from "../../shared/logger.js";
import { createHttpMetrics } from "../../shared/http-metrics.js";

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8009;
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const OSRM_BASE_URL = process.env.OSRM_BASE_URL || "https://router.project-osrm.org";
const MODEL_VERSION = "1.1.0-route-aware";
const log = createLogger("eta-service");
const { metricsMiddleware, metricsEndpoint } = createHttpMetrics("eta-service");
app.use(metricsMiddleware);

let redis;
try {
  redis = new Redis(REDIS_URL);
} catch (e) {
  log.warn("eta_redis_unavailable", { error: e.message, mode: "no_cache" });
}

function normalizeDistanceKmInput(distance_km) {
  if (distance_km === undefined) return null;
  if (typeof distance_km !== "number" || Number.isNaN(distance_km)) {
    throw new TypeError("distance_km must be a number");
  }
  if (distance_km < 0) {
    throw new RangeError("distance_km must be >= 0");
  }
  return distance_km;
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
  const coords = `${pickup.lng},${pickup.lat};${dropoff.lng},${dropoff.lat}`;
  const url = `${OSRM_BASE_URL}/route/v1/driving/${coords}?overview=false`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`OSRM error: ${res.status}`);
  }
  const data = await res.json();
  if (!data.routes?.length) throw new Error("OSRM: no route found");
  const route = data.routes[0];
  return {
    distanceM: Math.round(route.distance),
    durationS: Math.round(route.duration),
    routeSource: "osrm",
  };
}

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
  const distanceM = Math.round(straight * 1.35);
  return { distanceM, routeSource: "haversine" };
}

function inferTrafficLevel(hour = new Date().getHours()) {
  if (hour >= 7 && hour <= 9) return 0.9;
  if (hour >= 17 && hour <= 19) return 1.0;
  if (hour >= 11 && hour <= 13) return 0.65;
  if (hour >= 20 && hour <= 21) return 0.45;
  if (hour >= 22 || hour <= 5) return 0.15;
  return 0.35;
}

function getBaseSpeed(hour = new Date().getHours()) {
  if (hour >= 7 && hour <= 9) return 21;
  if (hour >= 17 && hour <= 19) return 18;
  if (hour >= 11 && hour <= 13) return 24;
  if (hour >= 22 || hour <= 5) return 42;
  return 30;
}

function predictETA({ distance_km, traffic_level, hour = new Date().getHours(), baseline_duration_seconds }) {
  if (distance_km <= 0) return { eta_minutes: 0, confidence: 1.0 };

  const baseSpeed = getBaseSpeed(hour);
  const safeTrafficLevel = Math.max(0, Math.min(1.2, traffic_level));
  const trafficMultiplier = 1 + safeTrafficLevel * 1.35;
  const effectiveSpeed = Math.max(8, baseSpeed / trafficMultiplier);
  const ruleEtaMinutes = (distance_km / effectiveSpeed) * 60;
  const baselineEtaMinutes = typeof baseline_duration_seconds === "number"
    ? baseline_duration_seconds / 60
    : null;
  const etaMinutes = baselineEtaMinutes != null
    ? baselineEtaMinutes * 0.75 + ruleEtaMinutes * 0.25
    : ruleEtaMinutes;
  const confidenceBase = baselineEtaMinutes != null ? 0.94 : 0.82;
  const confidence = Math.max(0.5, confidenceBase - distance_km * 0.003 - safeTrafficLevel * 0.12);

  return {
    eta_minutes: Math.max(1, Math.round(etaMinutes * 10) / 10),
    confidence: Math.round(confidence * 100) / 100,
  };
}

function forecastDemand({ zone = "default", hour = new Date().getHours() }) {
  const demandCurve = {
    0: 0.2, 1: 0.1, 2: 0.1, 3: 0.1, 4: 0.15, 5: 0.3,
    6: 0.5, 7: 0.8, 8: 1.0, 9: 0.7, 10: 0.5, 11: 0.6,
    12: 0.7, 13: 0.5, 14: 0.4, 15: 0.5, 16: 0.7, 17: 0.9,
    18: 1.0, 19: 0.8, 20: 0.6, 21: 0.5, 22: 0.4, 23: 0.3,
  };

  return {
    zone,
    hour,
    demand_index: demandCurve[hour] || 0.5,
    supply_index: 0.6 + Math.random() * 0.4,
    forecast_type: "hourly",
    model_version: MODEL_VERSION,
  };
}

app.post("/eta/predict", async (req, res) => {
  const start = Date.now();
  try {
    const { distance_km, traffic_level, pickup, dropoff, hour } = req.body || {};
    const normalizedDistanceKm = normalizeDistanceKmInput(distance_km);

    if (normalizedDistanceKm == null && (!pickup || !dropoff)) {
      return res.status(400).json({ error: "distance_km or pickup/dropoff coordinates required" });
    }

    let distanceM;
    let baselineDurationS = null;
    let routeSource;

    if (normalizedDistanceKm != null) {
      distanceM = Math.round(normalizedDistanceKm * 1000);
      routeSource = "input_distance";
    } else {
      assertLatLng(pickup, "pickup");
      assertLatLng(dropoff, "dropoff");
      try {
        const route = await getRouteOSRM(pickup, dropoff);
        distanceM = route.distanceM;
        baselineDurationS = route.durationS;
        routeSource = route.routeSource;
      } catch (osrmErr) {
        log.warn("eta_osrm_fallback", { error: osrmErr.message, fallback: "haversine" });
        const route = estimateByHaversine(pickup, dropoff);
        distanceM = route.distanceM;
        routeSource = route.routeSource;
      }
    }

    const resolvedDistanceKm = Math.round((distanceM / 1000) * 100) / 100;
    const resolvedHour = Number.isInteger(hour) ? hour : new Date().getHours();
    const resolvedTrafficLevel = typeof traffic_level === "number"
      ? Math.max(0, Math.min(1.2, traffic_level))
      : inferTrafficLevel(resolvedHour);
    const result = predictETA({
      distance_km: resolvedDistanceKm,
      traffic_level: resolvedTrafficLevel,
      hour: resolvedHour,
      baseline_duration_seconds: baselineDurationS,
    });
    const etaSeconds = Math.round(result.eta_minutes * 60);
    const latencyMs = Date.now() - start;

    if (redis) {
      const cacheKey = `eta:${Math.round(distanceM / 100)}:${Math.round(resolvedTrafficLevel * 10)}:${routeSource}`;
      await redis.setex(cacheKey, 30, JSON.stringify({
        eta: result.eta_minutes,
        eta_seconds: etaSeconds,
        confidence: result.confidence,
        distanceM,
        distance_km: resolvedDistanceKm,
        routeSource,
        traffic_level: resolvedTrafficLevel,
      })).catch(() => {});
    }

    recordForDrift(resolvedDistanceKm, resolvedTrafficLevel);

    res.json({
      eta: result.eta_minutes,
      eta_seconds: etaSeconds,
      durationS: etaSeconds,
      confidence: result.confidence,
      distanceM,
      distance_km: resolvedDistanceKm,
      routeSource,
      traffic_level: resolvedTrafficLevel,
      baseline_duration_seconds: baselineDurationS,
      model_version: MODEL_VERSION,
      latency_ms: latencyMs,
    });
  } catch (e) {
    const status = e instanceof TypeError || e instanceof RangeError ? 422 : 400;
    res.status(status).json({ error: e.message || "Bad Request" });
  }
});

app.get("/eta/forecast", (req, res) => {
  const zone = req.query.zone || "default";
  const hour = req.query.hour ? parseInt(req.query.hour, 10) : new Date().getHours();
  const result = forecastDemand({ zone, hour });
  res.json(result);
});

app.get("/eta/model-info", (req, res) => {
  res.json({
    model_version: MODEL_VERSION,
    model_type: "route-aware-rule-based",
    features: ["distance_km", "traffic_level", "hour_of_day", "osrm_baseline_duration"],
    fallback: "haversine",
    last_updated: "2026-04-27T00:00:00Z",
  });
});

app.get("/health", async (req, res) => {
  let redisOk = false;
  try {
    if (redis) {
      await redis.ping();
      redisOk = true;
    }
  } catch {}
  res.json({ ok: true, service: "eta-service", redis: redisOk, model_version: MODEL_VERSION });
});

const driftWindow = [];
const DRIFT_WINDOW_SIZE = 100;
const DRIFT_THRESHOLD = 2.0;

function recordForDrift(distanceKm, trafficLevel) {
  driftWindow.push({ distance_km: distanceKm, traffic_level: trafficLevel, timestamp: Date.now() });
  if (driftWindow.length > DRIFT_WINDOW_SIZE) driftWindow.shift();
}

function detectDrift() {
  if (driftWindow.length < 20) return { drifted: false, reason: "insufficient_data", samples: driftWindow.length };

  const distances = driftWindow.map((d) => d.distance_km);
  const mean = distances.reduce((s, v) => s + v, 0) / distances.length;
  const variance = distances.reduce((s, v) => s + (v - mean) ** 2, 0) / distances.length;
  const std = Math.sqrt(variance);
  const recent = distances.slice(-10);
  const recentMean = recent.reduce((s, v) => s + v, 0) / recent.length;
  const zScore = std > 0 ? Math.abs(recentMean - mean) / std : 0;
  const drifted = zScore > DRIFT_THRESHOLD;

  return {
    drifted,
    z_score: parseFloat(zScore.toFixed(3)),
    threshold: DRIFT_THRESHOLD,
    historical_mean: parseFloat(mean.toFixed(2)),
    recent_mean: parseFloat(recentMean.toFixed(2)),
    std: parseFloat(std.toFixed(2)),
    samples: driftWindow.length,
    alert: drifted ? "INPUT_DISTRIBUTION_DRIFT_DETECTED" : null,
  };
}

app.get("/eta/drift", (req, res) => {
  res.json(detectDrift());
});

app.get("/metrics", metricsEndpoint);

app.get("/eta/metrics", (req, res) => {
  const drift = detectDrift();
  res.set("Content-Type", "text/plain");
  res.send(`# HELP eta_predictions_total Total ETA predictions
# TYPE eta_predictions_total counter
eta_predictions_total ${driftWindow.length}
# HELP eta_drift_z_score Current drift z-score
# TYPE eta_drift_z_score gauge
eta_drift_z_score ${drift.z_score || 0}
# HELP eta_drift_detected Whether drift is detected
# TYPE eta_drift_detected gauge
eta_drift_detected ${drift.drifted ? 1 : 0}
# HELP eta_model_version Model version info
# TYPE eta_model_version gauge
eta_model_version{version="${MODEL_VERSION}"} 1
`);
});

app.listen(PORT, () => {
  log.info("eta_service_started", { port: Number(PORT), model_version: MODEL_VERSION });
});
