const { redis, REQUIRED_FIELDS, FRAUD_THRESHOLD, calculateFraudScore } = require("../services/fraud.service.js");

function healthCheck(_req, res) {
  let redisOk = false;
  if (redis) {
    redis.ping().then(() => { redisOk = true; }).catch(() => {});
    redisOk = redis.status === "ready";
  }
  res.json({ ok: true, service: "fraud (payment-service)", redis: redisOk });
}

function fraudStats(_req, res) {
  res.json({
    threshold: FRAUD_THRESHOLD,
    model_type: "rule-based",
    rules: ["amount_anomaly", "frequency_check", "location_anomaly", "device_fingerprint_check"],
  });
}

async function fraudCheck(req, res) {
  try {
    const body    = req.body || {};
    const missing = REQUIRED_FIELDS.filter((f) => !body[f] && body[f] !== 0);
    if (missing.length > 0) return res.status(400).json({ message: "missing required fields", missing_fields: missing });
    if (typeof body.amount !== "number" || body.amount < 0)
      return res.status(422).json({ error: "amount must be a non-negative number" });

    const result = await calculateFraudScore(body);
    res.json({ ...result, booking_id: body.booking_id, user_id: body.user_id, checked_at: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ error: e.message || "Internal error" });
  }
}

module.exports = { healthCheck, fraudStats, fraudCheck, detectFraud: fraudCheck };
