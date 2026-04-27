import express from "express";
import cors from "cors";
import Redis from "ioredis";
import { CircuitBreaker } from "../../shared/circuit-breaker.js";
import { createLogger } from "../../shared/logger.js";
import { createHttpMetrics } from "../../shared/http-metrics.js";
import { createTracingMiddleware, getTraceContext, withChildSpan } from "../../shared/jaeger-tracing.js";

const log = createLogger("agent-service");
const { metricsMiddleware, metricsEndpoint } = createHttpMetrics("agent-service");

// ── Circuit breakers for downstream services ────────────────────────────────
const cbEta = new CircuitBreaker("eta-service", { failureThreshold: 3, resetTimeout: 15000 });
const cbPricing = new CircuitBreaker("pricing-service", { failureThreshold: 3, resetTimeout: 15000 });
const cbFraud = new CircuitBreaker("fraud-service", { failureThreshold: 3, resetTimeout: 15000 });
const cbDriverAgent = new CircuitBreaker("driver-service-agent", { failureThreshold: 3, resetTimeout: 15000 });

const app = express();
app.use(cors());
app.use(express.json());
app.use(createTracingMiddleware("agent-service"));
app.use(metricsMiddleware);

const PORT = process.env.PORT || 8012;
const REDIS_URL = process.env.REDIS_URL || "redis://redis:6379";

let redis;
try { redis = new Redis(REDIS_URL); } catch { redis = null; }

// ── AI Agent configuration ──────────────────────────────────────────────────
const MODEL_VERSION = "agent-v1.2.0";
const TOOLS = ["eta_service", "pricing_service", "fraud_service", "driver_service"];

// ── Scoring weights ─────────────────────────────────────────────────────────
const W_DISTANCE = 0.4;
const W_RATING   = 0.35;
const W_ETA      = 0.15;
const W_PRICE    = 0.10;
const driverCache = new Map();

// ── Decision log store (in-memory, production would use DB/Kafka) ───────────
const decisionLogs = [];

function logDecision(requestId, decision) {
  const entry = {
    request_id: requestId,
    timestamp: new Date().toISOString(),
    ...decision,
  };
  decisionLogs.push(entry);
  if (decisionLogs.length > 1000) decisionLogs.shift();
  log.info("decision_logged", entry);
}

// ── Tool dispatcher ─────────────────────────────────────────────────────────
async function callTool(toolName, params, serviceUrls, traceContext = null) {
  const start = Date.now();
  let result;
  const cbMap = { eta_service: cbEta, pricing_service: cbPricing, fraud_service: cbFraud, driver_service: cbDriverAgent };
  const cb = cbMap[toolName];
  const maxRetries = 2;
  const retryDelaysMs = [];

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const doFetch = async () => {
        if (params?.__test_force_fail_tool === toolName) {
          throw new Error(`Forced failure for ${toolName}`);
        }
        let res;
        switch (toolName) {
          case "eta_service": {
            const url = `${serviceUrls.eta}/eta/predict`;
            res = traceContext
              ? await withChildSpan({
                serviceName: "agent-service",
                traceContext,
                name: "HTTP POST eta-service /eta/predict",
                tags: { downstream_service: "eta-service", tool: toolName },
              }, async (traceHeaders) => fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json", ...traceHeaders },
                body: JSON.stringify(params),
                signal: AbortSignal.timeout(3000),
              }))
              : await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(params),
                signal: AbortSignal.timeout(3000),
              });
            break;
          }
          case "pricing_service": {
            const url = `${serviceUrls.pricing}/pricing/estimate`;
            res = traceContext
              ? await withChildSpan({
                serviceName: "agent-service",
                traceContext,
                name: "HTTP POST pricing-service /pricing/estimate",
                tags: { downstream_service: "pricing-service", tool: toolName },
              }, async (traceHeaders) => fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json", ...traceHeaders },
                body: JSON.stringify(params),
                signal: AbortSignal.timeout(3000),
              }))
              : await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(params),
                signal: AbortSignal.timeout(3000),
              });
            break;
          }
          case "fraud_service": {
            const url = `${serviceUrls.fraud}/fraud/check`;
            res = traceContext
              ? await withChildSpan({
                serviceName: "agent-service",
                traceContext,
                name: "HTTP POST fraud-service /fraud/check",
                tags: { downstream_service: "fraud-service", tool: toolName },
              }, async (traceHeaders) => fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json", ...traceHeaders },
                body: JSON.stringify(params),
                signal: AbortSignal.timeout(3000),
              }))
              : await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(params),
                signal: AbortSignal.timeout(3000),
              });
            break;
          }
          case "driver_service": {
            const url = `${serviceUrls.driver}/drivers/nearby?lat=${params.lat}&lng=${params.lng}&radiusM=${params.radius || 5000}&vehicleType=${params.vehicleType || "CAR_4"}&limit=${params.limit || 10}`;
            res = traceContext
              ? await withChildSpan({
                serviceName: "agent-service",
                traceContext,
                name: "HTTP GET driver-service /drivers/nearby",
                tags: { downstream_service: "driver-service", tool: toolName },
              }, async (traceHeaders) => fetch(url, {
                headers: traceHeaders,
                signal: AbortSignal.timeout(3000),
              }))
              : await fetch(url, { signal: AbortSignal.timeout(3000) });
            break;
          }
          default:
            throw new Error(`Unknown tool: ${toolName}`);
        }
        let data = null;
        try {
          data = await res.json();
        } catch {}
        if (!res.ok) {
          throw new Error(data?.error || `${toolName} responded ${res.status}`);
        }
        if (toolName === "driver_service" && data && Array.isArray(data.drivers || data.nearbyDrivers)) {
          const cacheKey = `${Math.round((params.lat || 0) * 1000)}:${Math.round((params.lng || 0) * 1000)}:${params.vehicleType || "CAR_4"}`;
          const payload = {
            cached_at: new Date().toISOString(),
            drivers: data.drivers || data.nearbyDrivers,
          };
          driverCache.set(cacheKey, payload);
          if (redis) {
            try {
              await redis.set(`agent:drivers:${cacheKey}`, JSON.stringify(payload), "EX", 300);
            } catch {}
          }
        }
        return data;
      };

      result = cb ? await cb.exec(doFetch) : await doFetch();
      return { tool: toolName, result, latency_ms: Date.now() - start, attempt, retry_delays_ms: retryDelaysMs };
    } catch (err) {
      if (toolName === "driver_service") {
        const cacheKey = `${Math.round((params.lat || 0) * 1000)}:${Math.round((params.lng || 0) * 1000)}:${params.vehicleType || "CAR_4"}`;
        let cached = driverCache.get(cacheKey) || null;
        if (!cached && redis) {
          try {
            const raw = await redis.get(`agent:drivers:${cacheKey}`);
            cached = raw ? JSON.parse(raw) : null;
          } catch {}
        }
        if (cached?.drivers?.length) {
          log.warn("tool_call_fallback_cache", { tool: toolName, cacheKey, error: err.message, cached_drivers: cached.drivers.length });
          return {
            tool: toolName,
            result: { drivers: cached.drivers, cached: true, fallback_source: "redis_or_memory_cache", cached_at: cached.cached_at },
            latency_ms: Date.now() - start,
            attempt,
            fallback: true,
            retry_delays_ms: retryDelaysMs,
          };
        }
      }
      if (attempt === maxRetries) {
        log.warn("tool_call_failed", { tool: toolName, error: err.message, attempts: attempt + 1 });
        return { tool: toolName, error: err.message, latency_ms: Date.now() - start, attempt, fallback: true, retry_delays_ms: retryDelaysMs };
      }
      // Exponential backoff
      const delayMs = 100 * Math.pow(2, attempt);
      retryDelaysMs.push(delayMs);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}

// ── Score a driver (multi-criteria) ─────────────────────────────────────────
function scoreDriver(driver, maxDistance) {
  const dist = driver.distance ?? driver.distanceM ?? driver.dist ?? maxDistance;
  const rating = driver.rating || driver.avg_rating || 4.0;
  const etaMinutes = typeof driver.eta_minutes === "number" ? driver.eta_minutes : null;
  const price = typeof driver.price === "number" ? driver.price : null;

  // Normalize: lower distance = higher score, higher rating = higher score
  const distScore = 1 - Math.min(dist / maxDistance, 1);
  const ratingScore = rating / 5.0;
  const etaScore = etaMinutes != null ? Math.max(0, 1 - Math.min(etaMinutes / 60, 1)) : null;
  const priceScore = price != null ? Math.max(0, 1 - Math.min(price / 100000, 1)) : null;

  let totalScore = W_DISTANCE * distScore + W_RATING * ratingScore;
  if (etaScore != null && priceScore != null) {
    totalScore = 0.6 * etaScore + 0.4 * priceScore;
  } else if (etaScore != null) {
    totalScore += W_ETA * etaScore;
  } else if (priceScore != null) {
    totalScore += W_PRICE * priceScore;
  }

  return {
    driver_id: driver.id || driver.driver_id || driver.driverId || driver.member,
    distance: dist,
    rating,
    eta_minutes: etaMinutes,
    price,
    distance_score: distScore,
    rating_score: ratingScore,
    eta_score: etaScore,
    price_score: priceScore,
    total_score: totalScore,
    status: driver.status || "ONLINE",
  };
}

// ── Rule-based fallback when AI/services fail ───────────────────────────────
function ruleBasedSelect(drivers) {
  // Simple rule: pick nearest driver that is ONLINE
  const online = drivers.filter((d) => (d.status || "ONLINE") === "ONLINE");
  if (online.length === 0) return null;
  online.sort((a, b) => (a.distance || 0) - (b.distance || 0));
  return online[0];
}

function normalizeDriver(driver) {
  return {
    id: driver.id || driver.driver_id || driver.driverId || driver.member,
    distance: driver.distance ?? driver.distanceM ?? driver.dist ?? null,
    rating: driver.rating || driver.avg_rating || 4.0,
    eta_minutes: typeof driver.eta_minutes === "number" ? driver.eta_minutes : null,
    price: typeof driver.price === "number" ? driver.price : null,
    status: driver.status || "ONLINE",
  };
}

function toolSucceeded(toolResult) {
  return Boolean(toolResult && !toolResult.error && toolResult.result && !toolResult.result.error);
}

// ── MCP context builder ─────────────────────────────────────────────────────
async function buildMCPContext(params, serviceUrls, traceContext = null) {
  const {
    pickup,
    dropoff,
    vehicleType,
    requestId,
    rideId,
    demandIndex,
    supplyIndex,
    trafficLevel,
    pricingTimeoutMs,
    pricingFailOnceKey,
    availableDrivers,
    testForceFailTool,
    skipContextTools,
  } = params;

  if (Array.isArray(availableDrivers) && availableDrivers.length > 0) {
    const cacheKey = `${Math.round((pickup.lat || 0) * 1000)}:${Math.round((pickup.lng || 0) * 1000)}:${vehicleType || "CAR_4"}`;
    const payload = {
      cached_at: new Date().toISOString(),
      drivers: availableDrivers,
    };
    driverCache.set(cacheKey, payload);
  }

  const toolCalls = await Promise.allSettled([
    availableDrivers
      ? Promise.resolve({
        tool: "driver_service",
        result: { drivers: availableDrivers, inline: true },
        latency_ms: 0,
        attempt: 0,
        retry_delays_ms: [],
      })
      : callTool("driver_service", {
        lat: pickup.lat,
        lng: pickup.lng,
        radius: 5000,
        limit: 10,
        vehicleType: vehicleType || "CAR_4",
        __test_force_fail_tool: testForceFailTool,
      }, serviceUrls, traceContext),
    skipContextTools
      ? Promise.resolve({ tool: "eta_service", result: null, latency_ms: 0, attempt: 0, retry_delays_ms: [], skipped: true })
      : callTool("eta_service", {
        pickup: { lat: pickup.lat, lng: pickup.lng },
        dropoff: { lat: dropoff.lat, lng: dropoff.lng },
        vehicleType,
        traffic_level: typeof trafficLevel === "number" ? trafficLevel : undefined,
        __test_force_fail_tool: testForceFailTool,
      }, serviceUrls, traceContext),
    skipContextTools
      ? Promise.resolve({ tool: "pricing_service", result: null, latency_ms: 0, attempt: 0, retry_delays_ms: [], skipped: true })
      : callTool("pricing_service", {
        pickup,
        dropoff,
        vehicleType: vehicleType || "CAR_4",
        demand_index: typeof demandIndex === "number" ? demandIndex : undefined,
        supply_index: typeof supplyIndex === "number" ? supplyIndex : undefined,
        traffic_level: typeof trafficLevel === "number" ? trafficLevel : undefined,
        __test_timeout_ms: typeof pricingTimeoutMs === "number" ? pricingTimeoutMs : undefined,
        __test_fail_once_key: pricingFailOnceKey || undefined,
        __test_force_fail_tool: testForceFailTool,
      }, serviceUrls, traceContext),
  ]);

  const driverResult = toolCalls[0].status === "fulfilled" ? toolCalls[0].value : null;
  const etaResult    = toolCalls[1].status === "fulfilled" ? toolCalls[1].value : null;
  const pricingResult = toolCalls[2].status === "fulfilled" ? toolCalls[2].value : null;

  const availableDriverList = (driverResult?.result?.drivers ||
    driverResult?.result?.nearbyDrivers || []).map(normalizeDriver);
  const etaPayload = toolSucceeded(etaResult) ? etaResult.result : null;
  const pricingPayload = toolSucceeded(pricingResult) ? pricingResult.result : null;
  const resolvedTrafficLevel = etaPayload?.traffic_level
    ?? (typeof trafficLevel === "number" ? trafficLevel : null);
  const resolvedDemandIndex = pricingPayload?.demand_index
    ?? (typeof demandIndex === "number" ? demandIndex : null);
  const resolvedSupplyIndex = pricingPayload?.supply_index
    ?? (typeof supplyIndex === "number" ? supplyIndex : null)
    ?? (availableDriverList.length > 0 ? Math.min(availableDriverList.length / 5, 2.0) : 0);

  const context = {
    ride_id: rideId || requestId,
    request_id: requestId,
    pickup,
    drop: dropoff,
    dropoff,
    vehicle_type: vehicleType || "CAR_4",
    available_drivers: availableDriverList,
    eta: etaPayload,
    pricing: pricingPayload,
    traffic_level: resolvedTrafficLevel,
    demand_index: resolvedDemandIndex,
    supply_index: resolvedSupplyIndex,
    tools_called: [
      { tool: "eta_service", success: toolSucceeded(etaResult), latency_ms: etaResult?.latency_ms, error: etaResult?.error || null, attempt: etaResult?.attempt ?? 0, retry_delays_ms: etaResult?.retry_delays_ms || [] },
      { tool: "pricing_service", success: toolSucceeded(pricingResult), latency_ms: pricingResult?.latency_ms, error: pricingResult?.error || null, attempt: pricingResult?.attempt ?? 0, retry_delays_ms: pricingResult?.retry_delays_ms || [] },
      { tool: "driver_service", success: toolSucceeded(driverResult), latency_ms: driverResult?.latency_ms, error: driverResult?.error || null, attempt: driverResult?.attempt ?? 0, retry_delays_ms: driverResult?.retry_delays_ms || [], fallback: Boolean(driverResult?.fallback), cached: Boolean(driverResult?.result?.cached) },
    ],
    model_version: MODEL_VERSION,
    timestamp: new Date().toISOString(),
  };

  return context;
}

// ── Service URLs ────────────────────────────────────────────────────────────
const SERVICE_URLS = {
  eta: process.env.ETA_URL || "http://eta-service:8009",
  pricing: process.env.PRICING_URL || "http://pricing-service:8002",
  fraud: process.env.FRAUD_URL || "http://fraud-service:8010",
  driver: process.env.DRIVER_URL || "http://driver-service:8004",
  payment: process.env.PAYMENT_URL || "http://payment-service:8888",
};

// ═══════════════════════════════════════════════════════════════════════════
//  ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════

// POST /agent/select-driver — AI agent selects best driver
app.post("/agent/select-driver", async (req, res) => {
  const start = Date.now();
  try {
    const { pickup, dropoff, vehicleType, bookingId, userId, available_drivers, force_rule_based, __test_force_fail_tool, skip_context_tools } = req.body;
    if (!pickup?.lat || !pickup?.lng || !dropoff?.lat || !dropoff?.lng) {
      return res.status(400).json({ error: "pickup and dropoff with lat/lng required" });
    }

    const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const traceContext = getTraceContext(req);
    const context = await buildMCPContext({
      pickup,
      dropoff,
      vehicleType,
      requestId,
      availableDrivers: Array.isArray(available_drivers) ? available_drivers : undefined,
      testForceFailTool: __test_force_fail_tool || undefined,
      skipContextTools: Boolean(skip_context_tools),
    }, SERVICE_URLS, traceContext);

    let selectedDriver = null;
    let selectionMethod = "ai_scoring";
    let rankedDrivers = [];

    if (context.available_drivers.length === 0) {
      logDecision(requestId, {
        action: "no_drivers_available",
        booking_id: bookingId,
        selection_method: "none",
        latency_ms: Date.now() - start,
      });
      return res.json({
        selected_driver: null,
        reason: "No drivers available",
        context,
        decision_log: requestId,
      });
    }

    // Filter out offline drivers
    const onlineDrivers = context.available_drivers.filter((d) => d.status === "ONLINE");
    if (onlineDrivers.length === 0) {
      logDecision(requestId, {
        action: "no_online_drivers",
        booking_id: bookingId,
        total_drivers: context.available_drivers.length,
        all_offline: true,
        latency_ms: Date.now() - start,
      });
      return res.json({
        selected_driver: null,
        reason: "No online drivers available",
        context,
      });
    }

    try {
      if (force_rule_based || __test_force_fail_tool === "agent_ai") {
        throw new Error("Forced AI scoring failure");
      }
      // Multi-criteria scoring
      const maxDist = Math.max(...onlineDrivers.map((d) => d.distance || 10000));
      rankedDrivers = onlineDrivers
        .map((d) => scoreDriver(d, maxDist || 10000))
        .sort((a, b) => b.total_score - a.total_score);

      // Apply ETA and pricing bonus
      if (context.eta?.eta_minutes) {
        const etaBonus = Math.max(0, 1 - context.eta.eta_minutes / 30) * W_ETA;
        rankedDrivers.forEach((d, i) => {
          d.total_score += etaBonus * (1 - i / rankedDrivers.length);
        });
        rankedDrivers.sort((a, b) => b.total_score - a.total_score);
      }

      selectedDriver = rankedDrivers[0];
    } catch {
      // Fallback to rule-based
      selectionMethod = "rule_based_fallback";
      const fallback = ruleBasedSelect(onlineDrivers);
      if (fallback) {
        selectedDriver = {
          driver_id: fallback.id || fallback.driver_id,
          distance: fallback.distance,
          rating: fallback.rating || 4.0,
          total_score: 0,
        };
      }
    }

    logDecision(requestId, {
      action: "driver_selected",
      booking_id: bookingId,
      user_id: userId,
      selected_driver: selectedDriver?.driver_id,
      selection_method: selectionMethod,
      candidates: rankedDrivers.length,
      top_3: rankedDrivers.slice(0, 3),
      selected_driver_reason: selectionMethod === "rule_based_fallback" ? "nearest_online_driver_fallback" : "highest_total_score",
      selected_driver_score: selectedDriver?.total_score ?? null,
      weights: { distance: W_DISTANCE, rating: W_RATING, eta: W_ETA, price: W_PRICE },
      context_summary: {
        eta_minutes: context.eta?.eta_minutes,
        surge: context.pricing?.surge_multiplier,
        supply_index: context.supply_index,
        demand_index: context.demand_index,
      },
      latency_ms: Date.now() - start,
    });

    // Cache decision
    if (redis && bookingId) {
      try {
        await redis.set(`agent:decision:${bookingId}`, JSON.stringify({
          requestId, selectedDriver, rankedDrivers: rankedDrivers.slice(0, 3),
        }), "EX", 300);
      } catch {}
    }

    res.json({
      selected_driver: selectedDriver,
      top_3: rankedDrivers.slice(0, 3),
      selection_method: selectionMethod,
      context,
      decision_log: requestId,
      latency_ms: Date.now() - start,
    });
  } catch (err) {
    log.error("select_driver_error", { error: err.message });
    res.status(500).json({ error: "Agent error", message: err.message });
  }
});

// POST /agent/call-tool — Call a specific tool
app.post("/agent/call-tool", async (req, res) => {
  const { tool, params } = req.body;
  if (!tool || !TOOLS.includes(tool)) {
    return res.status(400).json({ error: `Invalid tool. Available: ${TOOLS.join(", ")}` });
  }
  if (!params) {
    return res.status(400).json({ error: "params required" });
  }
  const result = await callTool(tool, params, SERVICE_URLS, getTraceContext(req));
  res.json(result);
});

// GET /agent/context — Build MCP context
app.get("/agent/context", async (req, res) => {
  const { pickupLat, pickupLng, dropoffLat, dropoffLng, vehicleType, rideId, demandIndex, supplyIndex, trafficLevel, pricingTimeoutMs, pricingFailOnceKey, testForceFailTool } = req.query;
  if (!pickupLat || !pickupLng || !dropoffLat || !dropoffLng) {
    return res.status(400).json({ error: "pickupLat, pickupLng, dropoffLat, dropoffLng required" });
  }
  const context = await buildMCPContext({
    pickup: { lat: parseFloat(pickupLat), lng: parseFloat(pickupLng) },
    dropoff: { lat: parseFloat(dropoffLat), lng: parseFloat(dropoffLng) },
    vehicleType: vehicleType || "CAR_4",
    rideId: rideId || undefined,
    demandIndex: demandIndex != null ? parseFloat(demandIndex) : undefined,
    supplyIndex: supplyIndex != null ? parseFloat(supplyIndex) : undefined,
    trafficLevel: trafficLevel != null ? parseFloat(trafficLevel) : undefined,
    pricingTimeoutMs: pricingTimeoutMs != null ? parseFloat(pricingTimeoutMs) : undefined,
    pricingFailOnceKey: pricingFailOnceKey || undefined,
    testForceFailTool: testForceFailTool || undefined,
    requestId: `ctx_${Date.now()}`,
  }, SERVICE_URLS, getTraceContext(req));
  res.json(context);
});

app.post("/agent/context", async (req, res) => {
  try {
    const { pickup, dropoff, vehicleType, ride_id, rideId, demand_index, supply_index, traffic_level, pricing_timeout_ms, pricing_fail_once_key, available_drivers, __test_force_fail_tool, skip_context_tools } = req.body || {};
    if (!pickup?.lat || !pickup?.lng || !dropoff?.lat || !dropoff?.lng) {
      return res.status(400).json({ error: "pickup and dropoff with lat/lng required" });
    }
    const context = await buildMCPContext({
      pickup,
      dropoff,
      vehicleType: vehicleType || "CAR_4",
      rideId: ride_id || rideId || undefined,
      demandIndex: typeof demand_index === "number" ? demand_index : undefined,
      supplyIndex: typeof supply_index === "number" ? supply_index : undefined,
      trafficLevel: typeof traffic_level === "number" ? traffic_level : undefined,
      pricingTimeoutMs: typeof pricing_timeout_ms === "number" ? pricing_timeout_ms : undefined,
      pricingFailOnceKey: pricing_fail_once_key || undefined,
      availableDrivers: Array.isArray(available_drivers) ? available_drivers : undefined,
      testForceFailTool: __test_force_fail_tool || undefined,
      skipContextTools: Boolean(skip_context_tools),
      requestId: `ctx_${Date.now()}`,
    }, SERVICE_URLS, getTraceContext(req));
    res.json(context);
  } catch (err) {
    log.error("agent_context_error", { error: err.message });
    res.status(500).json({ error: "Failed to build context", message: err.message });
  }
});

app.post("/agent/booking-flow-trace", async (req, res) => {
  try {
    const {
      booking_id,
      user_id,
      pickup,
      dropoff,
      vehicleType,
      payment_method = "card",
      amount,
      card_number,
      payment_timeout_ms,
    } = req.body || {};
    if (!booking_id || !user_id || !pickup?.lat || !pickup?.lng || !dropoff?.lat || !dropoff?.lng) {
      return res.status(400).json({ error: "booking_id, user_id, pickup, dropoff are required" });
    }

    const traceContext = getTraceContext(req);
    const context = await buildMCPContext({
      pickup,
      dropoff,
      vehicleType: vehicleType || "CAR_4",
      rideId: booking_id,
      requestId: `flow_${Date.now()}`,
    }, SERVICE_URLS, traceContext);

    const paymentAmount = typeof amount === "number" ? amount : context.pricing?.fare;
    const paymentResponse = await withChildSpan({
      serviceName: "agent-service",
      traceContext,
      name: "HTTP POST payment-service /payments",
      tags: { downstream_service: "payment-service", flow: "booking-flow-trace" },
    }, async (traceHeaders) => {
      const paymentRes = await fetch(`${SERVICE_URLS.payment}/payments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(typeof payment_timeout_ms === "number" && payment_timeout_ms > 0 ? { "X-Test-Delay-Ms": String(payment_timeout_ms) } : {}),
          ...traceHeaders,
        },
        body: JSON.stringify({
          user_id,
          booking_id,
          amount: paymentAmount,
          payment_method,
          ...(card_number ? { card_number } : {}),
        }),
        signal: AbortSignal.timeout(3000),
      });
      const paymentBody = await paymentRes.json();
      if (!paymentRes.ok) {
        throw new Error(paymentBody?.error || `payment-service responded ${paymentRes.status}`);
      }
      return paymentBody;
    });

    res.json({
      booking_id,
      trace_id: traceContext.traceId,
      request_id: traceContext.requestId,
      context,
      payment: paymentResponse,
      jaeger_hint: "Search by trace_id tag or service api-gateway/agent-service in Jaeger",
    });
  } catch (err) {
    log.error("booking_flow_trace_error", { error: err.message, trace_id: req.traceId || null });
    res.status(500).json({ error: "Failed to execute booking flow trace", message: err.message, trace_id: req.traceId || null });
  }
});

// GET /agent/decisions — View decision logs
app.get("/agent/decisions", (_req, res) => {
  res.json({ count: decisionLogs.length, decisions: decisionLogs.slice(-50) });
});

// GET /agent/decisions/:requestId
app.get("/agent/decisions/:requestId", (req, res) => {
  const log = decisionLogs.find((d) => d.request_id === req.params.requestId);
  if (!log) return res.status(404).json({ error: "Decision not found" });
  res.json(log);
});

// GET /agent/model-info
app.get("/agent/model-info", (_req, res) => {
  res.json({
    model_version: MODEL_VERSION,
    scoring_weights: { distance: W_DISTANCE, rating: W_RATING, eta: W_ETA, price: W_PRICE },
    tools: TOOLS,
    fallback: "rule_based_nearest_driver",
    capabilities: [
      "multi_criteria_driver_selection",
      "tool_calling",
      "context_building",
      "decision_logging",
      "retry_with_backoff",
      "rule_based_fallback",
    ],
  });
});

// GET /health
app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "agent-service", version: MODEL_VERSION, tools: TOOLS });
});

// GET /agent/circuit-breakers
app.get("/agent/circuit-breakers", (_req, res) => {
  res.json({
    eta: cbEta.getState(),
    pricing: cbPricing.getState(),
    fraud: cbFraud.getState(),
    driver: cbDriverAgent.getState(),
  });
});

// GET /metrics (basic)
app.get("/metrics", metricsEndpoint);

app.listen(PORT, () => {
  log.info("started", {
    port: PORT,
    tools: TOOLS,
    model_version: MODEL_VERSION,
  });
});
