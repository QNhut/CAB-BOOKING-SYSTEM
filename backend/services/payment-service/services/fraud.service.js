const Redis = require("ioredis");

const REDIS_URL = process.env.REDIS_URL || "redis://redis:6379";
const FRAUD_THRESHOLD = parseFloat(process.env.FRAUD_THRESHOLD || "0.7");

let redis;
try { redis = new Redis(REDIS_URL); redis.on("error", () => {}); } catch { redis = null; }

const REQUIRED_FIELDS = ["user_id", "driver_id", "booking_id", "amount"];

async function calculateFraudScore({ user_id, driver_id, booking_id, amount, location, device_fingerprint }) {
  let score = 0;
  const reasons = [];

  // Amount-based scoring (extreme amounts score higher)
  if (amount > 1_000_000)      { score += 0.5; reasons.push("extreme_amount"); }
  else if (amount > 5_000_000) { score += 0.6; reasons.push("extremely_high_amount"); }
  else if (amount > 500_000)   { score += 0.3; reasons.push("unusually_high_amount"); }
  else if (amount < 5_000)     { score += 0.15; reasons.push("suspiciously_low_amount"); }

  // Suspicious device fingerprint
  if (device_fingerprint && /bot|fraud|suspicious|fake|hack/i.test(device_fingerprint)) {
    score += 0.35; reasons.push("suspicious_device_fingerprint");
  } else if (!device_fingerprint) {
    score += 0.1; reasons.push("missing_device_fingerprint");
  }

  score = Math.min(score, 1.0);
  return {
    fraud_score: Math.round(score * 100) / 100,
    flagged: score >= FRAUD_THRESHOLD,
    risk_level: score >= 0.7 ? "HIGH" : score >= 0.4 ? "MEDIUM" : "LOW",
    reasons,
    threshold: FRAUD_THRESHOLD,
  };
}

module.exports = { redis, FRAUD_THRESHOLD, REQUIRED_FIELDS, calculateFraudScore };
