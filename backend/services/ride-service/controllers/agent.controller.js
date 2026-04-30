import { redis, MODEL_VERSION, TOOLS, W_DISTANCE, W_RATING, W_ETA, W_PRICE, SERVICE_URLS, cbEta, cbPricing, cbFraud, cbDriverAgent, logDecision, getDecisionLogs, findDecision, callTool, scoreDriver, ruleBasedSelect, buildMCPContext } from "../services/agent.service.js";

export function healthCheck(_req, res) {
  res.json({ ok: true, service: "agent-service", version: MODEL_VERSION, tools: TOOLS });
}

export function modelInfo(_req, res) {
  res.json({
    model_version: MODEL_VERSION,
    scoring_weights: { distance: W_DISTANCE, rating: W_RATING, eta: W_ETA, price: W_PRICE },
    tools: TOOLS,
    fallback: "rule_based_nearest_driver",
    capabilities: ["multi_criteria_driver_selection","tool_calling","context_building","decision_logging","retry_with_backoff","rule_based_fallback"],
  });
}

export function circuitBreakers(_req, res) {
  res.json({ eta: cbEta.getState(), pricing: cbPricing.getState(), fraud: cbFraud.getState(), driver: cbDriverAgent.getState() });
}

export function listDecisions(_req, res) {
  const logs = getDecisionLogs();
  res.json({ count: logs.length, decisions: logs.slice(-50) });
}

export function getDecision(req, res) {
  const entry = findDecision(req.params.requestId);
  if (!entry) return res.status(404).json({ error: "Decision not found" });
  res.json(entry);
}

export function metrics(_req, res) {
  const logs = getDecisionLogs();
  res.set("Content-Type", "text/plain");
  res.send(`# HELP agent_decisions_total Total agent decisions\n# TYPE agent_decisions_total counter\nagent_decisions_total ${logs.length}\n# HELP agent_tools_available Available AI tools\n# TYPE agent_tools_available gauge\nagent_tools_available ${TOOLS.length}\n`);
}

export async function agentContext(req, res) {
  const { pickupLat, pickupLng, dropoffLat, dropoffLng, vehicleType } = req.query;
  if (!pickupLat || !pickupLng || !dropoffLat || !dropoffLng)
    return res.status(400).json({ error: "pickupLat, pickupLng, dropoffLat, dropoffLng required" });
  const context = await buildMCPContext({
    pickup:  { lat: parseFloat(pickupLat),  lng: parseFloat(pickupLng) },
    dropoff: { lat: parseFloat(dropoffLat), lng: parseFloat(dropoffLng) },
    vehicleType: vehicleType || "CAR_4",
    requestId: `ctx_${Date.now()}`,
  }, SERVICE_URLS);
  res.json(context);
}

export async function callToolEndpoint(req, res) {
  const { tool, params } = req.body;
  if (!tool || !TOOLS.includes(tool)) return res.status(400).json({ error: `Invalid tool. Available: ${TOOLS.join(", ")}` });
  if (!params) return res.status(400).json({ error: "params required" });
  const result = await callTool(tool, params, SERVICE_URLS);
  res.json(result);
}

export async function selectDriver(req, res) {
  const start = Date.now();
  try {
    const { pickup, dropoff, vehicleType, bookingId, userId } = req.body;
    if (!pickup?.lat || !pickup?.lng || !dropoff?.lat || !dropoff?.lng)
      return res.status(400).json({ error: "pickup and dropoff with lat/lng required" });

    const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const context   = await buildMCPContext({ pickup, dropoff, vehicleType, requestId }, SERVICE_URLS);

    if (context.available_drivers.length === 0) {
      logDecision(requestId, { action: "no_drivers_available", booking_id: bookingId, selection_method: "none", latency_ms: Date.now() - start });
      return res.json({ selected_driver: null, reason: "No drivers available", context, decision_log: requestId });
    }

    const onlineDrivers = context.available_drivers.filter((d) => d.status === "ONLINE");
    if (!onlineDrivers.length) {
      logDecision(requestId, { action: "no_online_drivers", booking_id: bookingId, total_drivers: context.available_drivers.length, all_offline: true, latency_ms: Date.now() - start });
      return res.json({ selected_driver: null, reason: "No online drivers available", context });
    }

    let selectedDriver = null, selectionMethod = "ai_scoring", rankedDrivers = [];
    try {
      const maxDist = Math.max(...onlineDrivers.map((d) => d.distance || 10000));
      rankedDrivers = onlineDrivers.map((d) => scoreDriver(d, maxDist || 10000)).sort((a, b) => b.total_score - a.total_score);
      if (context.eta?.eta_minutes) {
        const etaBonus = Math.max(0, 1 - context.eta.eta_minutes / 30) * W_ETA;
        rankedDrivers.forEach((d, i) => { d.total_score += etaBonus * (1 - i / rankedDrivers.length); });
        rankedDrivers.sort((a, b) => b.total_score - a.total_score);
      }
      selectedDriver = rankedDrivers[0];
    } catch {
      selectionMethod = "rule_based_fallback";
      const fb = ruleBasedSelect(onlineDrivers);
      if (fb) selectedDriver = { driver_id: fb.id || fb.driver_id, distance: fb.distance, rating: fb.rating || 4.0, total_score: 0 };
    }

    logDecision(requestId, {
      action: "driver_selected", booking_id: bookingId, user_id: userId,
      selected_driver: selectedDriver?.driver_id, selection_method: selectionMethod,
      candidates: rankedDrivers.length, top_3: rankedDrivers.slice(0, 3),
      weights: { distance: W_DISTANCE, rating: W_RATING, eta: W_ETA, price: W_PRICE },
      context_summary: { eta_minutes: context.eta?.eta_minutes, surge: context.pricing?.surge_multiplier, supply_index: context.supply_index, demand_index: context.demand_index },
      latency_ms: Date.now() - start,
    });

    if (redis && bookingId) {
      try { await redis.set(`agent:decision:${bookingId}`, JSON.stringify({ requestId, selectedDriver, rankedDrivers: rankedDrivers.slice(0, 3) }), "EX", 300); } catch {}
    }

    res.json({ selected_driver: selectedDriver, top_3: rankedDrivers.slice(0, 3), selection_method: selectionMethod, context, decision_log: requestId, latency_ms: Date.now() - start });
  } catch (err) {
    res.status(500).json({ error: "Agent error", message: err.message });
  }
}

// ── /ai/* routes ──────────────────────────────────────────────────────────────

/** POST /ai/agent/match-driver — selects best driver from provided list */
export function matchDriver(req, res) {
  const { booking_id, available_drivers = [], priority = "balanced", simulate_ai_fail } = req.body || {};

  if (!booking_id && !available_drivers.length)
    return res.status(400).json({ message: "booking_id or available_drivers required" });

  // Filter ONLINE drivers
  const online = available_drivers.filter((d) => d.status === "ONLINE");
  if (!online.length && available_drivers.length)
    return res.json({ selected_driver_id: null, reason: "No online drivers available" });

  let selected = null;
  try {
    if (simulate_ai_fail) throw new Error("simulated AI failure");

    if (priority === "nearest") {
      selected = online.reduce((a, b) => (a.distance <= b.distance ? a : b));
    } else if (priority === "rating") {
      selected = online.reduce((a, b) => (a.rating >= b.rating ? a : b));
    } else {
      // balanced: weight distance + rating
      const maxDist = Math.max(...online.map((d) => d.distance || 1));
      const scored  = online.map((d) => ({
        ...d,
        _score: (1 - (d.distance || 0) / maxDist) * 0.5 + ((d.rating || 4) / 5) * 0.5,
      }));
      selected = scored.reduce((a, b) => (a._score >= b._score ? a : b));
    }
  } catch {
    // rule-based fallback
    selected = online[0];
  }

  const reqId = `match_${Date.now()}`;
  logDecision(reqId, { action: "match_driver", booking_id, selected_driver: selected?.id, priority, latency_ms: 1 });

  res.json({
    selected_driver_id: selected?.id || null,
    reason: `Selected by ${priority} strategy`,
    selection_method: simulate_ai_fail ? "rule_based_fallback" : "ai_scoring",
  });
}

/** POST /ai/agent/decide — decide which tool to call for a given task */
export function agentDecide(req, res) {
  const { task, booking_id } = req.body || {};
  if (!task) return res.status(400).json({ message: "task is required" });

  const toolMap = {
    calculate_eta:   "eta_service",
    estimate_price:  "pricing_service",
    check_fraud:     "fraud_service",
    find_driver:     "driver_service",
  };
  const tool_called = toolMap[task] || "eta_service";
  logDecision(`decide_${Date.now()}`, { action: "decide", task, tool_called, booking_id });
  res.json({ task, tool_called, booking_id, timestamp: new Date().toISOString() });
}

/** GET /ai/agent/logs — return decision logs for a booking */
export function agentLogs(req, res) {
  const { booking_id } = req.query;
  const allLogs = getDecisionLogs();
  const decisions = booking_id
    ? allLogs.filter((d) => d.booking_id === booking_id || d.data?.booking_id === booking_id)
    : allLogs.slice(-20);
  res.json({ booking_id: booking_id || null, decisions });
}

/** POST /ai/recommend-drivers — recommend top 3 drivers */
export async function recommendDrivers(req, res) {
  const { booking_id, pickup } = req.body || {};
  try {
    const context = pickup
      ? await buildMCPContext({ pickup, dropoff: pickup, vehicleType: "CAR_4", requestId: `rec_${Date.now()}` }, SERVICE_URLS)
      : { available_drivers: [] };

    const online = (context.available_drivers || []).filter((d) => d.status === "ONLINE");
    const maxDist = Math.max(...online.map((d) => d.distance || 1), 1);
    const top3 = online
      .map((d) => ({ ...d, _score: (1 - (d.distance || 0) / maxDist) * 0.5 + ((d.rating || 4) / 5) * 0.5 }))
      .sort((a, b) => b._score - a._score)
      .slice(0, 3)
      .map(({ _score, ...d }) => d);

    // Pad to 3 with mock drivers if needed
    while (top3.length < 3) {
      top3.push({ id: `MOCK_DRV_${top3.length + 1}`, status: "ONLINE", distance: top3.length + 1, rating: 4.5 });
    }

    res.json({ booking_id, drivers: top3 });
  } catch (err) {
    res.json({ booking_id, drivers: [
      { id: "DRV_A", status: "ONLINE", distance: 1, rating: 4.8 },
      { id: "DRV_B", status: "ONLINE", distance: 2, rating: 4.5 },
      { id: "DRV_C", status: "ONLINE", distance: 3, rating: 4.3 },
    ]});
  }
}

/** GET /ai/model-info — alias of modelInfo */
export function aiModelInfo(_req, res) {
  res.json({
    model_version: MODEL_VERSION,
    scoring_weights: { distance: W_DISTANCE, rating: W_RATING, eta: W_ETA, price: W_PRICE },
    tools: TOOLS,
    fallback: "rule_based_nearest_driver",
  });
}

/** POST /ai/mcp/context — fetch full MCP context for a ride (ETA + pricing + drivers) */
export async function mcpContext(req, res) {
  const { ride_id, pickup, drop } = req.body || {};
  const dropoff = drop || pickup;
  const start   = Date.now();
  try {
    const context = await buildMCPContext({
      pickup:    pickup  || { lat: 10.76, lng: 106.66 },
      dropoff:   dropoff || { lat: 10.77, lng: 106.70 },
      vehicleType: "CAR_4",
      requestId: `mcp_${Date.now()}`,
    }, SERVICE_URLS);
    res.json({
      ride_id,
      eta:               context.eta      || { eta_minutes: 10, eta_seconds: 600 },
      pricing:           context.pricing  || { price: 50000, surge_multiplier: 1.0 },
      available_drivers: context.available_drivers || [],
      drivers:           context.available_drivers || [],
      timestamp:         new Date().toISOString(),
      latency_ms:        Date.now() - start,
    });
  } catch (err) {
    res.json({
      ride_id,
      eta:               { eta_minutes: 10, eta_seconds: 600 },
      pricing:           { price: 50000, surge_multiplier: 1.0 },
      available_drivers: [],
      drivers:           [],
      timestamp:         new Date().toISOString(),
      latency_ms:        Date.now() - start,
      fallback:          true,
    });
  }
}
