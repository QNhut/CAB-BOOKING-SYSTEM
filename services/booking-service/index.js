import express from "express";
import cors from "cors";
import { Pool } from "pg";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { Kafka } from "kafkajs";
import { createLogger } from "../../shared/logger.js";

const log = createLogger("booking-service");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8003;
const DATABASE_URL = process.env.DATABASE_URL;
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-in-production-please";

const pool = new Pool({ connectionString: DATABASE_URL });

function uuid() {
  return crypto.randomUUID();
}

class ValidationError extends Error {
  constructor(msg) { super(msg); this.name = "ValidationError"; }
}

function assertLatLng(p, name) {
  if (!p) {
    throw new Error(`${name} is required`);
  }
  if (typeof p.lat !== "number" || typeof p.lng !== "number" || isNaN(p.lat) || isNaN(p.lng)) {
    throw new ValidationError(`${name} must have lat,lng as numbers`);
  }
  if (p.lat < -90 || p.lat > 90 || p.lng < -180 || p.lng > 180) {
    throw new ValidationError(`${name} lat/lng out of range`);
  }
}

async function runMigrations() {
  const migrations = ["0001_init.sql", "0002_user_id_text.sql", "0003_add_driver_id.sql", "0004_idempotency_key.sql"];
  for (const m of migrations) {
    const file = path.join(process.cwd(), "migrations", m);
    if (fs.existsSync(file)) {
      const sql = fs.readFileSync(file, "utf8");
      await pool.query(sql);
      console.log(`✅ migration applied: ${m}`);
    }
  }
}

// Auth middleware for user endpoints
function userAuthMiddleware(req, res, next) {
  try {
    const authHeader = req.header("Authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      const decoded = jwt.verify(token, JWT_SECRET);
      
      if (decoded.role !== "USER") {
        return res.status(403).json({ error: "Forbidden: USER role required" });
      }
      
      req.auth = {
        accountId: decoded.sub,
        role: decoded.role,
        userId: decoded.userId || decoded.sub,
      };
      return next();
    }
    
    return res.status(401).json({ error: "Missing authentication (Bearer token required)" });
  } catch (err) {
    if (err.name === "JsonWebTokenError") {
      return res.status(401).json({ error: "Invalid token" });
    }
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Token expired" });
    }
    return res.status(500).json({ error: err.message });
  }
}

function getUserId(req) {
  if (!req.auth?.userId) throw new Error("Missing userId");
  return req.auth.userId;
}

// Health
app.get("/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});
app.get("/bookings/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Get active booking for current user
app.get("/bookings/me/active", userAuthMiddleware, async (req, res) => {
  try {
    const userId = getUserId(req);

    // Get most recent active booking (not yet completed/cancelled)
    const result = await pool.query(
      `SELECT * FROM bookings 
       WHERE user_id = $1 
       AND status IN ('PAID', 'MATCHED', 'WAITING_PAYMENT', 'DRIVER_ASSIGNED')
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId]
    );

    if (result.rowCount === 0) {
      return res.json({ booking: null });
    }

    const booking = result.rows[0];
    
    // Check if booking has associated ride
    let ride = null;
    if (booking.ride_id) {
      // Could query ride service here if needed
      ride = { id: booking.ride_id };
    }

    res.json({
      booking: {
        id: booking.id,
        status: booking.status,
        vehicleType: booking.vehicle_type,
        pickup: {
          lat: booking.pickup_lat,
          lng: booking.pickup_lng,
          address: booking.pickup_address,
        },
        dropoff: {
          lat: booking.dropoff_lat,
          lng: booking.dropoff_lng,
          address: booking.dropoff_address,
        },
        fare: booking.fare,
        currency: booking.currency,
        distanceM: booking.distance_m,
        durationS: booking.duration_s,
        paymentMethod: booking.payment_method,
        paymentStatus: booking.payment_status,
        createdAt: booking.created_at,
      },
      ride,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Create booking
app.post("/bookings", userAuthMiddleware, async (req, res) => {
  const client = await pool.connect();
  try {
    // ── Idempotency key support ─────────────────────────────────────────
    const idempotencyKey = req.header("X-Idempotency-Key");
    if (idempotencyKey) {
      const existing = await client.query(
        `SELECT id, status FROM bookings WHERE idempotency_key = $1 LIMIT 1`,
        [idempotencyKey]
      );
      if (existing.rows.length > 0) {
        return res.json({ bookingId: existing.rows[0].id, status: existing.rows[0].status, deduplicated: true });
      }
    }

    const {
      userId,
      pickup,
      dropoff,
      vehicleType,
      paymentMethod,
      pricingSnapshot,
    } = req.body || {};

    const finalUserId = getUserId(req);
    if (userId && String(userId) !== String(finalUserId)) {
      return res.status(403).json({ error: "userId does not match authenticated user" });
    }

    assertLatLng(pickup, "pickup");
    assertLatLng(dropoff, "dropoff");

    if (!vehicleType) throw new Error("vehicleType is required");
    if (!paymentMethod) throw new Error("paymentMethod is required");
    // Validate payment method
    const VALID_PAYMENT_METHODS = ["CASH", "VNPAY"];
    if (!VALID_PAYMENT_METHODS.includes(paymentMethod)) {
      return res.status(400).json({ error: "Invalid payment method", valid: VALID_PAYMENT_METHODS });
    }
    if (!pricingSnapshot?.fare || !pricingSnapshot?.distanceM || !pricingSnapshot?.durationS) {
      throw new Error("pricingSnapshot {fare,distanceM,durationS} is required");
    }

    const bookingId = uuid();

    // Initial status is REQUESTED; transition to PAID (CASH) or WAITING_PAYMENT (VNPAY) via outbox
    const status = "REQUESTED";
    const paymentStatus = paymentMethod === "VNPAY" ? "PENDING" : "NOT_REQUIRED";

    await client.query("BEGIN");

    await client.query(
      `INSERT INTO bookings (
        id, user_id, status, payment_method, payment_status,
        pickup_lat, pickup_lng, pickup_address,
        dropoff_lat, dropoff_lng, dropoff_address,
        vehicle_type, distance_m, duration_s, fare, currency,
        idempotency_key
      ) VALUES (
        $1,$2,$3,$4,$5,
        $6,$7,$8,
        $9,$10,$11,
        $12,$13,$14,$15,$16,
        $17
      )`,
      [
        bookingId,
        finalUserId,
        status,
        paymentMethod,
        paymentStatus,
        pickup.lat,
        pickup.lng,
        pickup.address || null,
        dropoff.lat,
        dropoff.lng,
        dropoff.address || null,
        vehicleType,
        pricingSnapshot.distanceM,
        pricingSnapshot.durationS,
        pricingSnapshot.fare,
        pricingSnapshot.currency || "VND",
        idempotencyKey || null,
      ]
    );

    await client.query(
      `INSERT INTO booking_status_history (id, booking_id, from_status, to_status, reason)
       VALUES ($1,$2,$3,$4,$5)`,
      [uuid(), bookingId, null, status, "created"]
    );

    // outbox: BOOKING_CREATED
    await client.query(
      `INSERT INTO outbox_events (id, aggregate_type, aggregate_id, event_type, payload)
       VALUES ($1,$2,$3,$4,$5::jsonb)`,
      [
        uuid(),
        "BOOKING",
        bookingId,
        "BOOKING_CREATED",
        JSON.stringify({
          bookingId,
          userId: finalUserId,
          status,
          paymentMethod,
          vehicleType,
          pickup,
          dropoff,
          pricingSnapshot,
          createdAt: new Date().toISOString(),
        }),
      ]
    );

    // nếu CASH coi như match luôn => outbox BOOKING_MATCH_REQUESTED
    if (paymentMethod !== "VNPAY") {
      await client.query(
        `INSERT INTO outbox_events (id, aggregate_type, aggregate_id, event_type, payload)
         VALUES ($1,$2,$3,$4,$5::jsonb)`,
        [
          uuid(),
          "BOOKING",
          bookingId,
          "BOOKING_MATCH_REQUESTED",
          JSON.stringify({
            bookingId,
            userId: finalUserId,
            requestedAt: new Date().toISOString(),
            pickup,
            dropoff,
            vehicleType,
            paymentMethod,
            pricingSnapshot,
          }),
        ]
      );
    }

    await client.query("COMMIT");

    res.json({ bookingId, status });
  } catch (e) {
    await client.query("ROLLBACK");
    const status = e.name === "ValidationError" ? 422 : 400;
    res.status(status).json({ error: e.message || "Bad Request" });
  } finally {
    client.release();
  }
});

// Get booking
app.get("/bookings/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const r = await pool.query("SELECT * FROM bookings WHERE id = $1", [id]);
    if (!r.rows.length) return res.status(404).json({ error: "Not found" });
    res.json(r.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get completed ride history for current user (last 20)
app.get("/bookings/me/history", userAuthMiddleware, async (req, res) => {
  try {
    const userId = getUserId(req);
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const result = await pool.query(
      `SELECT id, status, payment_method,
              pickup_lat, pickup_lng, pickup_address,
              dropoff_lat, dropoff_lng, dropoff_address,
              vehicle_type, fare, currency, distance_m, duration_s,
              ride_id, driver_id, created_at, updated_at
       FROM bookings
       WHERE user_id = $1 AND status = 'COMPLETED'
       ORDER BY updated_at DESC
       LIMIT $2`,
      [userId, limit]
    );
    const rides = result.rows.map((b) => ({
      bookingId: b.id,
      status: b.status,
      vehicleType: b.vehicle_type,
      pickup: { lat: b.pickup_lat, lng: b.pickup_lng, address: b.pickup_address },
      dropoff: { lat: b.dropoff_lat, lng: b.dropoff_lng, address: b.dropoff_address },
      fare: b.fare,
      currency: b.currency,
      distanceM: b.distance_m,
      durationS: b.duration_s,
      rideId: b.ride_id,
      driverId: b.driver_id || "",
      completedAt: b.updated_at || b.created_at,
    }));
    res.json({ rides });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Internal batch endpoint — used by ride-service to enrich ride history with booking details
app.post("/bookings/internal/batch", async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.json({ bookings: {} });
    }
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(",");
    const result = await pool.query(
      `SELECT id, pickup_lat, pickup_lng, pickup_address,
              dropoff_lat, dropoff_lng, dropoff_address,
              fare, currency, distance_m, duration_s, vehicle_type, updated_at, created_at
       FROM bookings WHERE id IN (${placeholders})`,
      ids
    );
    const bookings = {};
    for (const b of result.rows) {
      bookings[b.id] = {
        pickup: { lat: b.pickup_lat, lng: b.pickup_lng, address: b.pickup_address },
        dropoff: { lat: b.dropoff_lat, lng: b.dropoff_lng, address: b.dropoff_address },
        fare: b.fare,
        currency: b.currency,
        distanceM: b.distance_m,
        durationS: b.duration_s,
        vehicleType: b.vehicle_type,
        completedAt: b.updated_at || b.created_at,
      };
    }
    res.json({ bookings });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// (MVP) Outbox viewer
app.get("/outbox", async (req, res) => {
  const status = req.query.status || "NEW";
  const r = await pool.query(
    "SELECT * FROM outbox_events WHERE status = $1 ORDER BY created_at ASC LIMIT 50",
    [status]
  );
  res.json({ items: r.rows });
});

// ── Kafka setup (producer + consumer) ───────────────────────────────────────────
const KAFKA_BROKERS        = (process.env.KAFKA_BROKERS || "kafka:9092").split(",");
const KAFKA_BOOKING_TOPIC  = process.env.KAFKA_BOOKING_TOPIC || "taxi.bookings";
const KAFKA_RIDE_TOPIC     = process.env.KAFKA_RIDE_TOPIC    || "taxi.rides";

const kafkaClient        = new Kafka({ clientId: "booking-service-consumer", brokers: KAFKA_BROKERS });
const consumer           = kafkaClient.consumer({ groupId: "booking-service" });
const bookingProducer    = new Kafka({ clientId: "booking-service-producer", brokers: KAFKA_BROKERS }).producer();

// ── Cancel booking (manual) ───────────────────────────────────────────────
app.post("/bookings/:id/cancel", userAuthMiddleware, async (req, res) => {
  const { id } = req.params;
  const userId = getUserId(req);
  try {
    // Verify booking belongs to user and is still cancellable
    const { rows } = await pool.query(
      `SELECT id, user_id, status FROM bookings WHERE id = $1`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ error: "Booking not found" });
    const bk = rows[0];
    if (String(bk.user_id) !== String(userId))
      return res.status(403).json({ error: "Not your booking" });
    if (["COMPLETED", "CANCELLED"].includes(bk.status))
      return res.status(400).json({ error: `Booking already ${bk.status}` });
    if (["MATCHED", "DRIVER_ASSIGNED"].includes(bk.status))
      return res.status(400).json({ error: "Cannot cancel: driver already assigned" });

    await pool.query(
      `UPDATE bookings SET status='CANCELLED', updated_at=now() WHERE id=$1`,
      [id]
    );

    // Publish BOOKING_CANCELLED event so notification-service can SSE the user
    const evt = {
      eventId: uuid(),
      eventType: "BOOKING_CANCELLED",
      aggregateType: "BOOKING",
      aggregateId: id,
      occurredAt: new Date().toISOString(),
      payload: { bookingId: id, userId, reason: "user_cancelled" },
    };
    await bookingProducer.send({
      topic: KAFKA_BOOKING_TOPIC,
      messages: [{ key: id, value: JSON.stringify(evt) }],
    });

    console.log(`[BOOKING] manual cancel: booking=${id} userId=${userId}`);
    res.json({ ok: true, bookingId: id, status: "CANCELLED" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

await runMigrations();
// Connect Kafka producer before starting server
await bookingProducer.connect();
console.log("✅ booking-service Kafka producer connected");

app.listen(PORT, () => {
  console.log(`Booking service running on http://localhost:${PORT}`);
});

// ── Kafka consumer + auto-cancel job ───────────────────────────────
async function startKafkaConsumer() {
  await consumer.connect();
  await consumer.subscribe({ topic: KAFKA_RIDE_TOPIC, fromBeginning: false });
  console.log(`✅ booking-service consuming ${KAFKA_RIDE_TOPIC}`);

  await consumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value) return;
      try {
        const evt = JSON.parse(message.value.toString());
        const { eventType, payload } = evt;

        if (eventType === "RIDE_COMPLETED" && payload?.bookingId) {
          await pool.query(
            `UPDATE bookings SET status = 'COMPLETED', ride_id = $2 WHERE id = $1 AND status != 'COMPLETED'`,
            [payload.bookingId, payload.rideId || null]
          );
          console.log(`[BOOKING] RIDE_COMPLETED → booking ${payload.bookingId} → COMPLETED`);
        }

        if (eventType === "RIDE_ACCEPTED" && payload?.bookingId) {
          await pool.query(
            `UPDATE bookings SET status = 'MATCHED', ride_id = $2 WHERE id = $1 AND status NOT IN ('COMPLETED','CANCELLED')`,
            [payload.bookingId, payload.rideId || null]
          );
          console.log(`[BOOKING] RIDE_ACCEPTED → booking ${payload.bookingId} → MATCHED, ride=${payload.rideId}`);
        }
      } catch (e) {
        console.error("[BOOKING] Kafka consumer error:", e.message);
      }
    },
  });
}

// ── Auto-cancel job ───────────────────────────────────────────────
async function startAutoCancelJob() {
  // Auto-cancel PAID bookings older than 2 minutes (no driver found)
  const JOB_INTERVAL_MS = 30_000; // run every 30s
  const EXPIRE_MINUTES  = 2;

  async function runCancelJob() {
    try {
      const { rows } = await pool.query(
        `UPDATE bookings
         SET status='CANCELLED', updated_at=now()
         WHERE status IN ('PAID','WAITING_PAYMENT')
           AND created_at < now() - interval '${EXPIRE_MINUTES} minutes'
         RETURNING id, user_id`
      );
      if (rows.length > 0) {
        console.log(`[BOOKING] auto-cancelled ${rows.length} expired booking(s)`);
        // Publish BOOKING_CANCELLED for each
        const msgs = rows.map((bk) => ({
          key: bk.id,
          value: JSON.stringify({
            eventId: uuid(),
            eventType: "BOOKING_CANCELLED",
            aggregateType: "BOOKING",
            aggregateId: bk.id,
            occurredAt: new Date().toISOString(),
            payload: { bookingId: bk.id, userId: bk.user_id, reason: "no_driver_timeout" },
          }),
        }));
        await bookingProducer.send({ topic: KAFKA_BOOKING_TOPIC, messages: msgs });
      }
    } catch (e) {
      console.error("[BOOKING] auto-cancel job error:", e.message);
    }
  }

  setInterval(runCancelJob, JOB_INTERVAL_MS);
  console.log(`✅ auto-cancel job started (every ${JOB_INTERVAL_MS / 1000}s, expire=${EXPIRE_MINUTES}min)`);
}

startKafkaConsumer().catch((e) => console.error("[BOOKING] Kafka start error:", e.message));
startAutoCancelJob().catch((e) => console.error("[BOOKING] auto-cancel start error:", e.message));
