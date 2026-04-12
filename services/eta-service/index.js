import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import Redis from "ioredis";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8009;
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const MODEL_VERSION = "1.0.0-rule-based";

let redis;
try {
  redis = new Redis(REDIS_URL);
} catch (e) {
  console.warn("[ETA] Redis not available, running without cache");
}

// ── ETA Prediction Model (Rule-based) ──────────────────────────────────────
// Simulates an AI model using distance, traffic level, and time-of-day factors
function predictETA({ distance_km, traffic_level = 0.5, hour = new Date().getHours() }) {
  if (distance_km <= 0) return { eta_minutes: 0, confidence: 1.0 };

  // Base speed varies by time of day (km/h)
  let baseSpeed;
  if (hour >= 7 && hour <= 9) baseSpeed = 20;       // morning rush
  else if (hour >= 17 && hour <= 19) baseSpeed = 18; // evening rush
  else if (hour >= 22 || hour <= 5) baseSpeed = 45;  // night
  else baseSpeed = 30;                                // normal

  // Traffic factor: 0 = no traffic, 1 = heavy traffic
  const trafficMultiplier = 1 + traffic_level * 1.5; // 1.0 to 2.5x

  const effectiveSpeed = baseSpeed / trafficMultiplier;
  const etaMinutes = (distance_km / effectiveSpeed) * 60;

  // Confidence decreases with distance and traffic uncertainty
  const confidence = Math.max(0.5, 1.0 - distance_km * 0.005 - traffic_level * 0.2);

  return {
    eta_minutes: Math.max(1, Math.round(etaMinutes * 10) / 10),
    confidence: Math.round(confidence * 100) / 100,
  };
}

// ── Forecast demand (simple rule-based) ────────────────────────────────────
function forecastDemand({ zone = "default", hour = new Date().getHours() }) {
  // Simulated demand pattern
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
    supply_index: 0.6 + Math.random() * 0.4, // simulated supply
    forecast_type: "hourly",
    model_version: MODEL_VERSION,
  };
}

// ── POST /eta/predict ───────────────────────────────────────────────────────
app.post("/eta/predict", async (req, res) => {
  const start = Date.now();
  try {
    const { distance_km, traffic_level, pickup, dropoff } = req.body || {};

    if (distance_km === undefined && (!pickup || !dropoff)) {
      return res.status(400).json({
        error: "distance_km or pickup/dropoff coordinates required",
      });
    }

    let dist = distance_km;
    if (dist === undefined && pickup && dropoff) {
      // Calculate distance from coordinates using Haversine
      dist = haversineKm(pickup, dropoff);
    }

    if (typeof dist !== "number" || dist < 0) {
      return res.status(422).json({ error: "distance_km must be a non-negative number" });
    }

    const result = predictETA({
      distance_km: dist,
      traffic_level: typeof traffic_level === "number" ? traffic_level : 0.5,
    });

    const latencyMs = Date.now() - start;

    // Cache result in Redis (TTL 30s)
    if (redis) {
      const cacheKey = `eta:${Math.round(dist * 10)}:${Math.round((traffic_level || 0.5) * 10)}`;
      await redis.setex(cacheKey, 30, JSON.stringify(result)).catch(() => {});
    }

    // Record for drift detection
    recordForDrift(dist, traffic_level || 0.5);

    res.json({
      eta: result.eta_minutes,
      eta_seconds: Math.round(result.eta_minutes * 60),
      confidence: result.confidence,
      distance_km: Math.round(dist * 100) / 100,
      model_version: MODEL_VERSION,
      latency_ms: latencyMs,
    });
  } catch (e) {
    res.status(400).json({ error: e.message || "Bad Request" });
  }
});

// ── GET /eta/forecast ───────────────────────────────────────────────────────
app.get("/eta/forecast", (req, res) => {
  const zone = req.query.zone || "default";
  const hour = req.query.hour ? parseInt(req.query.hour) : new Date().getHours();
  const result = forecastDemand({ zone, hour });
  res.json(result);
});

// ── GET /eta/model-info ─────────────────────────────────────────────────────
app.get("/eta/model-info", (req, res) => {
  res.json({
    model_version: MODEL_VERSION,
    model_type: "rule-based",
    features: ["distance_km", "traffic_level", "hour_of_day"],
    fallback: "haversine",
    last_updated: "2026-04-01T00:00:00Z",
  });
});

// ── Health ──────────────────────────────────────────────────────────────────
app.get("/health", async (req, res) => {
  let redisOk = false;
  try {
    if (redis) { await redis.ping(); redisOk = true; }
  } catch {}
  res.json({ ok: true, service: "eta-service", redis: redisOk, model_version: MODEL_VERSION });
});

// ── Drift Detection ─────────────────────────────────────────────────────────
const driftWindow = [];
const DRIFT_WINDOW_SIZE = 100;
const DRIFT_THRESHOLD = 2.0; // std deviations

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

  // Check if recent inputs deviate significantly from historical mean
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

app.get("/metrics", (req, res) => {
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

// ── Haversine helper ────────────────────────────────────────────────────────
function haversineKm(a, b) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const c = sinLat * sinLat + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng;
  return 2 * R * Math.asin(Math.sqrt(c)) * 1.35; // road factor
}

app.listen(PORT, () => {
  console.log(`[ETA] ETA service running on http://localhost:${PORT}`);
});
