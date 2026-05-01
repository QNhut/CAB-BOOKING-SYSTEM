import redis, { MODEL_VERSION, predictETA, forecastDemand, haversineKm, recordForDrift, detectDrift, getMetricsText } from "../services/eta.service.js";

export async function healthCheck(_req, res) {
  let redisOk = false;
  try { if (redis) { await redis.ping(); redisOk = true; } } catch {}
  res.json({ ok: true, service: "eta-service", redis: redisOk, model_version: MODEL_VERSION });
}

export function modelInfo(_req, res) {
  res.json({ model_version: MODEL_VERSION, model_type: "rule-based", features: ["distance_km","traffic_level","hour_of_day"], fallback: "haversine", last_updated: "2026-04-01T00:00:00Z" });
}

export async function predict(req, res) {
  const start = Date.now();
  try {
    const { distance_km, traffic_level, pickup, dropoff } = req.body || {};
    if (distance_km === undefined && (!pickup || !dropoff))
      return res.status(400).json({ error: "distance_km or pickup/dropoff coordinates required" });

    let dist = distance_km;
    if (dist === undefined && pickup && dropoff) dist = haversineKm(pickup, dropoff);
    if (typeof dist !== "number" || dist < 0)
      return res.status(422).json({ error: "distance_km must be a non-negative number" });

    const result = predictETA({ distance_km: dist, traffic_level: typeof traffic_level === "number" ? traffic_level : 0.5 });
    const latencyMs = Date.now() - start;

    if (redis) {
      const cacheKey = `eta:${Math.round(dist * 10)}:${Math.round((traffic_level || 0.5) * 10)}`;
      await redis.setex(cacheKey, 30, JSON.stringify(result)).catch(() => {});
    }
    recordForDrift(dist, traffic_level || 0.5);

    res.json({ eta: result.eta_minutes, eta_seconds: Math.round(result.eta_minutes * 60), confidence: result.confidence, distance_km: Math.round(dist * 100) / 100, model_version: MODEL_VERSION, latency_ms: latencyMs });
  } catch (e) {
    res.status(400).json({ error: e.message || "Bad Request" });
  }
}

export function forecast(req, res) {
  const zone = req.query.zone || "default";
  const hour = req.query.hour ? parseInt(req.query.hour) : new Date().getHours();
  res.json(forecastDemand({ zone, hour }));
}

export function getDrift(_req, res) { res.json(detectDrift()); }

export function getMetrics(_req, res) {
  res.set("Content-Type", "text/plain");
  res.send(getMetricsText());
}

// ── AI alias routes (/ai/eta, /ai/forecast) ───────────────────────────────────
export async function aiEta(req, res) {
  const start = Date.now();
  const { distance_km = 5, traffic_level = 0.5, simulate_model_fail } = req.body || {};
  try {
    // Validate: clamp abnormal inputs instead of crashing
    const dist = Math.max(0, Math.min(Math.abs(Number(distance_km) || 5), 500));
    const tl   = Math.max(0, Math.min(Number(traffic_level) || 0.5, 1));

    if (simulate_model_fail) {
      // fallback: simple haversine estimate
      const eta = Math.max(1, Math.round(dist * 2));
      const inferMs = Date.now() - start;
      return res.json({ eta, eta_seconds: eta * 60, confidence: 0.5, model_version: MODEL_VERSION, fallback: true, inference_time_ms: inferMs, latency_ms: inferMs });
    }

    const result = predictETA({ distance_km: dist, traffic_level: tl });
    const inferenceMs = Math.max(1, Date.now() - start);
    res.json({ eta: result.eta_minutes, eta_seconds: Math.round(result.eta_minutes * 60), confidence: result.confidence, model_version: MODEL_VERSION, inference_time_ms: inferenceMs, latency_ms: inferenceMs });
  } catch (e) {
    // Never return 500 — use fallback
    const eta = Math.max(1, Math.round(Math.abs(Number(distance_km) || 5) * 2));
    const inferMs = Date.now() - start;
    res.json({ eta, eta_seconds: eta * 60, confidence: 0.3, model_version: MODEL_VERSION, fallback: true, inference_time_ms: inferMs, latency_ms: inferMs });
  }
}

export async function aiForecast(req, res) {
  const { area = "default", time_window = "next_1h" } = req.body || {};
  const hour = new Date().getHours();
  const demandResult = forecastDemand({ zone: area, hour });
  res.json({
    area, time_window,
    demand_forecast: demandResult.demand_forecast ?? demandResult.demand ?? 1.0,
    timestamp: new Date().toISOString(),
    model_version: MODEL_VERSION,
  });
}
