import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import Redis from "ioredis";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8010;
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const FRAUD_THRESHOLD = parseFloat(process.env.FRAUD_THRESHOLD || "0.7");

let redis;
try {
  redis = new Redis(REDIS_URL);
} catch (e) {
  console.warn("[FRAUD] Redis not available");
}

// Required fields for fraud check
const REQUIRED_FIELDS = ["user_id", "driver_id", "booking_id", "amount", "location"];

// ── Fraud scoring rules ────────────────────────────────────────────────────
async function calculateFraudScore({ user_id, driver_id, booking_id, amount, location, device_fingerprint }) {
  let score = 0;
  const reasons = [];

  // Rule 1: Unusual amount (very high or very low)
  if (amount > 5000000) { // > 5M VND
    score += 0.3;
    reasons.push("unusually_high_amount");
  } else if (amount < 5000) { // < 5K VND
    score += 0.15;
    reasons.push("suspiciously_low_amount");
  }

  // Rule 2: Frequency check — same user booking too fast
  if (redis) {
    const recentKey = `fraud:recent:${user_id}`;
    const recentCount = await redis.incr(recentKey);
    if (recentCount === 1) await redis.expire(recentKey, 300); // 5-minute window
    if (recentCount > 10) {
      score += 0.4;
      reasons.push("high_frequency_booking");
    } else if (recentCount > 5) {
      score += 0.2;
      reasons.push("moderate_frequency_booking");
    }
  }

  // Rule 3: Location anomaly — lat/lng out of Vietnam range
  if (location) {
    const { lat, lng } = location;
    if (lat && lng) {
      // Vietnam bounds: lat 8.2-23.4, lng 102.1-109.5
      if (lat < 8.0 || lat > 24.0 || lng < 101.0 || lng > 110.0) {
        score += 0.25;
        reasons.push("location_outside_service_area");
      }
    }
  }

  // Rule 4: Missing device fingerprint (optional field but reduces trust)
  if (!device_fingerprint) {
    score += 0.05;
    reasons.push("no_device_fingerprint");
  }

  // Clamp to [0, 1]
  score = Math.min(1.0, Math.max(0.0, Math.round(score * 100) / 100));

  return {
    fraud_score: score,
    flagged: score >= FRAUD_THRESHOLD,
    reasons,
    threshold: FRAUD_THRESHOLD,
  };
}

// ── POST /fraud/check ───────────────────────────────────────────────────────
app.post("/fraud/check", async (req, res) => {
  try {
    const body = req.body || {};

    // Validate required fields
    const missing = REQUIRED_FIELDS.filter((f) => !body[f] && body[f] !== 0);
    if (missing.length > 0) {
      return res.status(400).json({
        error: "missing required fields",
        missing_fields: missing,
      });
    }

    // Validate amount is a number
    if (typeof body.amount !== "number" || body.amount < 0) {
      return res.status(422).json({ error: "amount must be a non-negative number" });
    }

    const result = await calculateFraudScore(body);

    // Log for audit
    console.log(`[FRAUD] user=${body.user_id} booking=${body.booking_id} score=${result.fraud_score} flagged=${result.flagged}`);

    res.json({
      ...result,
      booking_id: body.booking_id,
      user_id: body.user_id,
      checked_at: new Date().toISOString(),
    });
  } catch (e) {
    res.status(500).json({ error: e.message || "Internal error" });
  }
});

// ── GET /fraud/stats ────────────────────────────────────────────────────────
app.get("/fraud/stats", (req, res) => {
  res.json({
    threshold: FRAUD_THRESHOLD,
    model_type: "rule-based",
    rules: [
      "amount_anomaly",
      "frequency_check",
      "location_anomaly",
      "device_fingerprint_check",
    ],
  });
});

// ── Health ──────────────────────────────────────────────────────────────────
app.get("/health", async (req, res) => {
  let redisOk = false;
  try { if (redis) { await redis.ping(); redisOk = true; } } catch {}
  res.json({ ok: true, service: "fraud-service", redis: redisOk });
});

app.listen(PORT, () => {
  console.log(`[FRAUD] Fraud detection service on http://localhost:${PORT}`);
});
