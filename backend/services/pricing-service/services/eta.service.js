import Redis from "ioredis";

const REDIS_URL = process.env.REDIS_URL || "redis://redis:6379";
export const MODEL_VERSION = "1.0.0-rule-based";

let redis;
try { redis = new Redis(REDIS_URL); } catch { console.warn("[ETA] Redis not available"); }
export default redis;

export function predictETA({ distance_km, traffic_level = 0.5, hour = new Date().getHours() }) {
  if (distance_km <= 0) return { eta_minutes: 0, confidence: 1.0 };
  let baseSpeed;
  if (hour >= 7  && hour <= 9)  baseSpeed = 20;
  else if (hour >= 17 && hour <= 19) baseSpeed = 18;
  else if (hour >= 22 || hour <= 5)  baseSpeed = 45;
  else baseSpeed = 30;
  const effectiveSpeed = baseSpeed / (1 + traffic_level * 1.5);
  const etaMinutes = (distance_km / effectiveSpeed) * 60;
  const confidence = Math.max(0.5, 1.0 - distance_km * 0.005 - traffic_level * 0.2);
  return { eta_minutes: Math.max(1, Math.round(etaMinutes * 10) / 10), confidence: Math.round(confidence * 100) / 100 };
}

export function forecastDemand({ zone = "default", hour = new Date().getHours() }) {
  const demandCurve = { 0:0.2,1:0.1,2:0.1,3:0.1,4:0.15,5:0.3,6:0.5,7:0.8,8:1.0,9:0.7,10:0.5,11:0.6,12:0.7,13:0.5,14:0.4,15:0.5,16:0.7,17:0.9,18:1.0,19:0.8,20:0.6,21:0.5,22:0.4,23:0.3 };
  return { zone, hour, demand_index: demandCurve[hour] || 0.5, supply_index: 0.6 + Math.random() * 0.4, forecast_type: "hourly", model_version: MODEL_VERSION };
}

export function haversineKm(a, b) {
  const R = 6371, toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const c = Math.sin(dLat/2)**2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng/2)**2;
  return 2 * R * Math.asin(Math.sqrt(c)) * 1.35;
}

// Drift detection
const driftWindow = [];
const DRIFT_WINDOW_SIZE = 100;
const DRIFT_THRESHOLD   = 2.0;

export function recordForDrift(distanceKm, trafficLevel) {
  driftWindow.push({ distance_km: distanceKm, traffic_level: trafficLevel, timestamp: Date.now() });
  if (driftWindow.length > DRIFT_WINDOW_SIZE) driftWindow.shift();
}

export function detectDrift() {
  if (driftWindow.length < 20) return { drifted: false, reason: "insufficient_data", samples: driftWindow.length };
  const distances   = driftWindow.map((d) => d.distance_km);
  const mean        = distances.reduce((s, v) => s + v, 0) / distances.length;
  const variance    = distances.reduce((s, v) => s + (v - mean) ** 2, 0) / distances.length;
  const std         = Math.sqrt(variance);
  const recent      = distances.slice(-10);
  const recentMean  = recent.reduce((s, v) => s + v, 0) / recent.length;
  const zScore      = std > 0 ? Math.abs(recentMean - mean) / std : 0;
  const drifted     = zScore > DRIFT_THRESHOLD;
  return { drifted, z_score: parseFloat(zScore.toFixed(3)), threshold: DRIFT_THRESHOLD, historical_mean: parseFloat(mean.toFixed(2)), recent_mean: parseFloat(recentMean.toFixed(2)), std: parseFloat(std.toFixed(2)), samples: driftWindow.length, alert: drifted ? "INPUT_DISTRIBUTION_DRIFT_DETECTED" : null };
}

export function getMetricsText() {
  const drift = detectDrift();
  return `# HELP eta_predictions_total Total ETA predictions
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
`;
}
