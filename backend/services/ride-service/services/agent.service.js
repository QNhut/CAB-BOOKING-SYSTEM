import Redis from "ioredis";
import { CircuitBreaker } from "../../../../shared/circuit-breaker.js";
import { createLogger } from "../../../../shared/logger.js";

export const log = createLogger("agent-service");

const REDIS_URL = process.env.REDIS_URL || "redis://redis:6379";
let redis;
try { redis = new Redis(REDIS_URL); } catch { redis = null; }
export { redis };

export const MODEL_VERSION = "agent-v1.2.0";
export const TOOLS = ["eta_service", "pricing_service", "fraud_service", "driver_service"];

const W_DISTANCE = 0.4;
const W_RATING   = 0.35;
const W_ETA      = 0.15;
const W_PRICE    = 0.10;
export { W_DISTANCE, W_RATING, W_ETA, W_PRICE };

export const SERVICE_URLS = {
  eta:     process.env.ETA_URL     || "http://pricing-service:8002",
  pricing: process.env.PRICING_URL || "http://pricing-service:8002",
  fraud:   process.env.FRAUD_URL   || "http://payment-service:8888",
  driver:  process.env.DRIVER_URL  || "http://driver-service:8004",
};

export const cbEta         = new CircuitBreaker("eta-service",          { failureThreshold: 3, resetTimeout: 15000 });
export const cbPricing     = new CircuitBreaker("pricing-service",      { failureThreshold: 3, resetTimeout: 15000 });
export const cbFraud       = new CircuitBreaker("fraud-service",        { failureThreshold: 3, resetTimeout: 15000 });
export const cbDriverAgent = new CircuitBreaker("driver-service-agent", { failureThreshold: 3, resetTimeout: 15000 });

// ── Decision log ─────────────────────────────────────────────────────────────
const decisionLogs = [];
export function logDecision(requestId, decision) {
  const entry = { request_id: requestId, timestamp: new Date().toISOString(), ...decision };
  decisionLogs.push(entry);
  if (decisionLogs.length > 1000) decisionLogs.shift();
}
export function getDecisionLogs() { return decisionLogs; }
export function findDecision(requestId) { return decisionLogs.find((d) => d.request_id === requestId); }

// ── Tool dispatcher ───────────────────────────────────────────────────────────
export async function callTool(toolName, params, serviceUrls) {
  const start = Date.now();
  const cbMap = { eta_service: cbEta, pricing_service: cbPricing, fraud_service: cbFraud, driver_service: cbDriverAgent };
  const cb    = cbMap[toolName];

  for (let attempt = 0; attempt <= 2; attempt++) {
    try {
      const doFetch = async () => {
        switch (toolName) {
          case "eta_service": {
            const res = await fetch(`${serviceUrls.eta}/eta/predict`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(params), signal: AbortSignal.timeout(3000) });
            return res.json();
          }
          case "pricing_service": {
            const res = await fetch(`${serviceUrls.pricing}/pricing/estimate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(params), signal: AbortSignal.timeout(3000) });
            return res.json();
          }
          case "fraud_service": {
            const res = await fetch(`${serviceUrls.fraud}/fraud/check`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(params), signal: AbortSignal.timeout(3000) });
            return res.json();
          }
          case "driver_service": {
            const res = await fetch(`${serviceUrls.driver}/drivers/nearby?lat=${params.lat}&lng=${params.lng}&radiusM=${params.radius||5000}&vehicleType=${params.vehicleType||"CAR_4"}&limit=${params.limit||10}`, { signal: AbortSignal.timeout(3000) });
            return res.json();
          }
          default: throw new Error(`Unknown tool: ${toolName}`);
        }
      };
      const result = cb ? await cb.exec(doFetch) : await doFetch();
      return { tool: toolName, result, latency_ms: Date.now() - start, attempt };
    } catch (err) {
      if (attempt === 2) {
        log.warn("tool_call_failed", { tool: toolName, error: err.message });
        return { tool: toolName, error: err.message, latency_ms: Date.now() - start, attempt, fallback: true };
      }
      await new Promise((r) => setTimeout(r, 100 * Math.pow(2, attempt)));
    }
  }
}

// ── Scoring ───────────────────────────────────────────────────────────────────
export function scoreDriver(driver, maxDistance) {
  const dist   = driver.distance || driver.dist || maxDistance;
  const rating = driver.rating   || driver.avg_rating || 4.0;
  const distScore   = 1 - Math.min(dist / maxDistance, 1);
  const ratingScore = rating / 5.0;
  return {
    driver_id: driver.id || driver.driver_id || driver.member,
    distance: dist, rating, distance_score: distScore, rating_score: ratingScore,
    total_score: W_DISTANCE * distScore + W_RATING * ratingScore,
    status: driver.status || "ONLINE",
  };
}

export function ruleBasedSelect(drivers) {
  const online = drivers.filter((d) => (d.status || "ONLINE") === "ONLINE");
  if (!online.length) return null;
  return online.sort((a, b) => (a.distance || 0) - (b.distance || 0))[0];
}

// ── MCP context builder ───────────────────────────────────────────────────────
export async function buildMCPContext({ pickup, dropoff, vehicleType, requestId }, serviceUrls) {
  const toolCalls = await Promise.allSettled([
    callTool("driver_service",  { lat: pickup.lat, lng: pickup.lng, radius: 5000, limit: 10, vehicleType: vehicleType || "CAR_4" }, serviceUrls),
    callTool("eta_service",     { pickup, dropoff, vehicleType }, serviceUrls),
    callTool("pricing_service", { pickup, dropoff, vehicleType: vehicleType || "CAR_4" }, serviceUrls),
  ]);

  const driverResult  = toolCalls[0].status === "fulfilled" ? toolCalls[0].value : null;
  const etaResult     = toolCalls[1].status === "fulfilled" ? toolCalls[1].value : null;
  const pricingResult = toolCalls[2].status === "fulfilled" ? toolCalls[2].value : null;

  const availableDrivers = driverResult?.result?.drivers || driverResult?.result?.nearbyDrivers || [];

  return {
    request_id: requestId, pickup, dropoff, vehicle_type: vehicleType || "CAR_4",
    available_drivers: availableDrivers.map((d) => ({
      id: d.id || d.driver_id || d.member,
      distance: d.distance || d.dist,
      rating: d.rating || d.avg_rating || 4.0,
      status: d.status || "ONLINE",
    })),
    eta:           etaResult?.result     || null,
    pricing:       pricingResult?.result || null,
    traffic_level: etaResult?.result?.traffic_factor || 0.5,
    demand_index:  pricingResult?.result?.surge_multiplier || 1.0,
    supply_index:  availableDrivers.length > 0 ? Math.min(availableDrivers.length / 5, 2.0) : 0,
    tools_called: [
      { tool: "driver_service",  success: !driverResult?.error,  latency_ms: driverResult?.latency_ms },
      { tool: "eta_service",     success: !etaResult?.error,     latency_ms: etaResult?.latency_ms },
      { tool: "pricing_service", success: !pricingResult?.error, latency_ms: pricingResult?.latency_ms },
    ],
    model_version: MODEL_VERSION,
    timestamp: new Date().toISOString(),
  };
}
