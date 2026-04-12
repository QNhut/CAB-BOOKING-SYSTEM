import { Kafka } from "kafkajs";
import { Pool } from "pg";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import axios from "axios";
import express from "express";
import cors from "cors";
import { createClient } from "redis";
import jwt from "jsonwebtoken";
import { CircuitBreaker } from "../../shared/circuit-breaker.js";
import { createLogger } from "../../shared/logger.js";

const log = createLogger("ride-service");

// ── Circuit breakers for downstream services ────────────────────────────────
const cbGeo = new CircuitBreaker("geo-service", { failureThreshold: 5, resetTimeout: 30000 });
const cbAuth = new CircuitBreaker("auth-service", { failureThreshold: 5, resetTimeout: 30000 });
const cbDriver = new CircuitBreaker("driver-service", { failureThreshold: 5, resetTimeout: 30000 });
const cbBooking = new CircuitBreaker("booking-service", { failureThreshold: 5, resetTimeout: 30000 });

/**
 * ENV required (docker-compose):
 * - DATABASE_URL=postgres://taxi:taxi_pass@postgres:5432/ride_db
 * - KAFKA_BROKERS=kafka:9092
 * - KAFKA_BOOKING_TOPIC=taxi.bookings
 * - KAFKA_RIDE_TOPIC=taxi.rides
 * - KAFKA_GROUP_ID=ride-service
 * - DRIVER_BASE_URL=http://driver-service:8004
 * - REDIS_URL=redis://redis:6379
 * - OFFER_TIMEOUT_SEC=10 (dev) or 60
 * - PORT=8005
 * - JWT_SECRET=dev-secret-change-in-production-please
 */



const brokers = (process.env.KAFKA_BROKERS || "kafka:9092").split(",");
const bookingTopic = process.env.KAFKA_BOOKING_TOPIC || "taxi.bookings";
const rideTopic = process.env.KAFKA_RIDE_TOPIC || "taxi.rides";
const groupId = process.env.KAFKA_GROUP_ID || "ride-service";
const DRIVER_BASE_URL = process.env.DRIVER_BASE_URL || "http://driver-service:8004";
const BOOKING_BASE_URL = process.env.BOOKING_BASE_URL || "http://booking-service:8003";
const GEO_BASE_URL = process.env.GEO_BASE_URL || "http://geo-service:8007";
const AUTH_BASE_URL = process.env.AUTH_BASE_URL || "http://auth-service:8001";
const DATABASE_URL = process.env.DATABASE_URL;
const REDIS_URL = process.env.REDIS_URL || "redis://redis:6379";
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-in-production-please";
const OFFER_TIMEOUT_SEC = Number(process.env.OFFER_TIMEOUT_SEC || 60);
const DRIVER_RETRY_INTERVAL_SEC = Number(process.env.DRIVER_RETRY_INTERVAL_SEC || 10);
const DRIVER_RETRY_MAX_ATTEMPTS = Number(process.env.DRIVER_RETRY_MAX_ATTEMPTS || 12);
const PORT = Number(process.env.PORT || 8005);

if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL missing");
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });

async function runMigrations() {
  const dir = path.join(process.cwd(), "migrations");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  for (const f of files) {
    const sql = fs.readFileSync(path.join(dir, f), "utf8");
    await pool.query(sql);
  }
  console.log("✅ ride migrations applied:", files.join(", "));
}

async function alreadyProcessed(eventId) {
  const r = await pool.query("SELECT 1 FROM processed_events WHERE event_id=$1", [eventId]);
  return r.rowCount > 0;
}

async function markProcessed(eventId) {
  await pool.query(
    "INSERT INTO processed_events(event_id) VALUES ($1) ON CONFLICT DO NOTHING",
    [eventId]
  );
}

/** Redis lock */
const rds = createClient({ url: REDIS_URL });
rds.on("error", (e) => console.error("Redis error:", e.message));

const lockKey = (driverId) => `lock:driver:${driverId}`;

async function tryLockDriver(driverId, ttlSec) {
  const ok = await rds.set(lockKey(driverId), "1", { NX: true, EX: ttlSec });
  return ok === "OK";
}
async function unlockDriver(driverId) {
  await rds.del(lockKey(driverId));
}

/** Kafka */
const kafka = new Kafka({ clientId: "ride-service", brokers });
const producer = kafka.producer();
const consumer = kafka.consumer({ groupId });

/**
 * Resolve a human-readable address from a location object.
 * Uses existing address string if it looks like a real name;
 * falls back to Geoapify reverse geocoding via geo-service.
 */
async function resolveAddress(location) {
  if (!location?.lat || !location?.lng) return null;
  const existing = (location.address || "").trim();
  // If we already have a proper address (not just raw coords), keep it
  if (existing && !existing.startsWith("Vị trí hiện tại") && existing.length > 8) {
    return existing;
  }
  try {
    const resp = await cbGeo.exec(() => axios.get(`${GEO_BASE_URL}/geo/reverse`, {
      params: { lat: location.lat, lng: location.lng },
      timeout: 3000,
    }));
    return resp.data?.formattedAddress || resp.data?.name || existing || null;
  } catch (e) {
    log.warn("geo reverse failed", { error: e.message, cbState: cbGeo.getState() });
    // Fall back to raw address string (could be "Vị trí hiện tại (lat, lng)" — still useful)
    return existing || `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`;
  }
}

/** Offer next driver based on rides.candidates + rides.candidate_index */
/** Offer next driver based on rides.candidates + rides.candidate_index */

async function fetchUserProfile(userId) {
  try {
    const resp = await cbAuth.exec(() => axios.get(`${AUTH_BASE_URL}/internal/profile/user/${userId}`, { timeout: 2000 }));
    return resp.data;
  } catch { return null; }
}

async function fetchDriverProfile(driverId) {
  try {
    const resp = await cbAuth.exec(() => axios.get(`${AUTH_BASE_URL}/internal/profile/driver/${driverId}`, { timeout: 2000 }));
    return resp.data;
  } catch { return null; }
}
async function offerNextDriver(rideId) {
  const client = await pool.connect();
  let lockedDriverId = null;

  try {
    await client.query("BEGIN");

    const r = await client.query("SELECT * FROM rides WHERE id=$1 FOR UPDATE", [rideId]);
    if (!r.rowCount) throw new Error("ride not found");

    const ride = r.rows[0];
    if (ride.status !== "OFFERING") {
      await client.query("COMMIT");
      return;
    }

    const candidates = ride.candidates || [];
    let idx = ride.candidate_index || 0;

    while (idx < candidates.length) {
      const driverId = candidates[idx].driverId;

      // Try lock driver for offer window only
      const locked = await tryLockDriver(driverId, OFFER_TIMEOUT_SEC + 5);
      if (!locked) {
        idx += 1;
        continue;
      }
      lockedDriverId = driverId;

      // Create offer record
      const offerId = crypto.randomUUID();
      await client.query(
        `INSERT INTO ride_offers(id, ride_id, driver_id, status)
         VALUES ($1,$2,$3,'OFFERED')`,
        [offerId, rideId, driverId]
      );

      const expiresAt = new Date(Date.now() + OFFER_TIMEOUT_SEC * 1000).toISOString();

      // IMPORTANT: move candidate_index to current idx (not +1), next will be idx+1 on timeout/reject
      await client.query(
        `UPDATE rides
         SET current_offer_driver_id=$2,
             offer_expires_at=$3,
             candidate_index=$4,
             updated_at=now()
         WHERE id=$1`,
        [rideId, driverId, expiresAt, idx]
      );

      await client.query("COMMIT");

      // Resolve human-readable addresses via geo-service (before releasing client)
      const [pickupAddress, dropoffAddress, userProfile] = await Promise.all([
        resolveAddress(ride.pickup),
        resolveAddress(ride.dropoff),
        fetchUserProfile(ride.user_id),
      ]);

      // Publish offer event
      const offerEvent = {
        eventId: crypto.randomUUID(),
        eventType: "RIDE_OFFERED_TO_DRIVER",
        aggregateType: "RIDE",
        aggregateId: rideId,
        occurredAt: new Date().toISOString(),
        payload: {
          rideId,
          bookingId: ride.booking_id,
          driverId,
          expiresInSec: OFFER_TIMEOUT_SEC,
          pickup: ride.pickup ? {
            lat: ride.pickup.lat,
            lng: ride.pickup.lng,
            address: pickupAddress,
          } : null,
          dropoff: ride.dropoff ? {
            lat: ride.dropoff.lat,
            lng: ride.dropoff.lng,
            address: dropoffAddress,
          } : null,
          fare: ride.fare != null ? Number(ride.fare) : null,
          distanceM: ride.distance_m ?? null,
          durationS: ride.duration_s ?? null,
          currency: ride.currency || "VND",
          userProfile: userProfile ? {
            full_name: userProfile.full_name || null,
            phone: userProfile.phone || null,
          } : null,
        },
      };

      await producer.send({
        topic: rideTopic,
        messages: [{ key: String(rideId), value: JSON.stringify(offerEvent) }],
      });

      console.log(`[RIDE] Offered ride=${rideId} to driver=${driverId} idx=${idx}`);
      return;
    }

    // No drivers found right now -- schedule retries instead of giving up immediately
    const nextRetry = new Date(Date.now() + DRIVER_RETRY_INTERVAL_SEC * 1000).toISOString();
    await client.query(
      `UPDATE rides SET status='NO_DRIVER_FOUND', retry_count=0, next_retry_at=$2, updated_at=now() WHERE id=$1`,
      [rideId, nextRetry]
    );
    await client.query("COMMIT");

    console.log(`[RIDE] NO_DRIVER_FOUND (will retry) ride=${rideId} nextRetry=${nextRetry}`);
  } catch (e) {
    try {
      await client.query("ROLLBACK");
    } catch {}

    // If we locked someone but failed before COMMIT, unlock to avoid stale lock
    if (lockedDriverId) {
      try { await unlockDriver(lockedDriverId); } catch {}
    }
    console.error("offerNextDriver error:", e.message);
  } finally {
    client.release();
  }
}

/** Timeout loop: mark offer TIMEOUT -> unlock driver -> offer next */
async function startTimeoutLoop() {
  setInterval(async () => {
    const client = await pool.connect();
    try {
      const { rows } = await client.query(
        `SELECT id, current_offer_driver_id
         FROM rides
         WHERE status='OFFERING'
           AND offer_expires_at IS NOT NULL
           AND offer_expires_at < now()
         LIMIT 20`
      );

      for (const row of rows) {
        const rideId = row.id;
        const driverId = row.current_offer_driver_id;
        if (!driverId) continue;

        await client.query("BEGIN");

        await client.query(
          `UPDATE ride_offers
           SET status='TIMEOUT', responded_at=now()
           WHERE ride_id=$1 AND driver_id=$2 AND status='OFFERED'`,
          [rideId, driverId]
        );

        await client.query(
          `UPDATE rides
           SET current_offer_driver_id=NULL,
               offer_expires_at=NULL,
               candidate_index=candidate_index+1,
               updated_at=now()
           WHERE id=$1 AND status='OFFERING'`,
          [rideId]
        );

        await client.query("COMMIT");

        await unlockDriver(driverId);
        console.log(`[RIDE] TIMEOUT ride=${rideId} driver=${driverId} -> offer next`);
        await offerNextDriver(rideId);
      }
    } catch (e) {
      try {
        await client.query("ROLLBACK");
      } catch {}
      console.error("timeout loop error:", e.message);
    } finally {
      client.release();
    }
  }, 2000);
}

/** Retry loop: when no drivers found, periodically re-query nearby drivers and try offering */
async function startRetryLoop() {
  setInterval(async () => {
    const client = await pool.connect();
    try {
      const { rows } = await client.query(
        `SELECT id, booking_id, pickup, dropoff, retry_count
         FROM rides
         WHERE status='NO_DRIVER_FOUND' AND next_retry_at IS NOT NULL AND next_retry_at <= now()
         LIMIT 20`
      );

      for (const row of rows) {
        const rideId = row.id;
        const bookingId = row.booking_id;

        try {
          // Re-query nearby drivers from driver-service
          const pickup = row.pickup;
          const resp = await cbDriver.exec(() => axios.get(`${DRIVER_BASE_URL}/drivers/nearby`, {
            params: {
              lat: pickup?.lat,
              lng: pickup?.lng,
              radiusM: 3000,
              vehicleType: row.vehicle_type || "CAR_4",
              limit: 20,
            },
            timeout: 3000,
          }));

          const drivers = resp.data?.drivers || [];

          if (drivers.length > 0) {
            // Found drivers: move back to OFFERING and set candidates
            await client.query("BEGIN");
            await client.query(
              `UPDATE rides SET candidates=$2, status='OFFERING', candidate_index=0, next_retry_at=NULL, retry_count=0, updated_at=now() WHERE id=$1`,
              [rideId, JSON.stringify(drivers)]
            );
            await client.query("COMMIT");
            console.log(`[RIDE] Retry found drivers for ride=${rideId} drivers=${drivers.length} -> offering`);
            await offerNextDriver(rideId);
            continue;
          }

          // No drivers again: increment retry_count and schedule next
          const nextRetry = new Date(Date.now() + DRIVER_RETRY_INTERVAL_SEC * 1000).toISOString();
          let nextCount = (row.retry_count || 0) + 1;
          if (nextCount >= DRIVER_RETRY_MAX_ATTEMPTS) {
            // Give up after max attempts; keep NO_DRIVER_FOUND and clear next_retry_at
            await client.query(
              `UPDATE rides SET retry_count=$2, next_retry_at=NULL, updated_at=now() WHERE id=$1`,
              [rideId, nextCount]
            );
            console.log(`[RIDE] Retry reached max attempts for ride=${rideId} (gave up)`);
          } else {
            await client.query(
              `UPDATE rides SET retry_count=$2, next_retry_at=$3, updated_at=now() WHERE id=$1`,
              [rideId, nextCount, nextRetry]
            );
            console.log(`[RIDE] Retry scheduled for ride=${rideId} nextRetry=${nextRetry} attempt=${nextCount}`);
          }
        } catch (e) {
          console.error(`[RIDE] retry loop error for ride=${rideId}:`, e.message);
        }
      }
    } catch (e) {
      console.error("retry loop error:", e.message);
    } finally {
      client.release();
    }
  }, 5000); // wake every 10s to find rides to retry
}

/** Express API */
const app = express();
app.use(cors());
const jsonParser = express.json();
app.use((req, res, next) => {
  if (req.method === "GET" || req.method === "HEAD") {
    return next();
  }
  const contentType = req.headers["content-type"] || "";
  const contentLength = req.headers["content-length"];
  const transferEncoding = req.headers["transfer-encoding"];

  if (contentType.includes("application/json") && !transferEncoding && (!contentLength || contentLength === "0")) {
    req.body = {};
    return next();
  }

  return jsonParser(req, res, next);
});

app.use((err, req, res, next) => {
  if (err?.type === "entity.parse.failed" || err instanceof SyntaxError) {
    return res.status(400).json({ error: "Invalid JSON body" });
  }
  return next(err);
});

// Auth middleware for driver endpoints (supports both JWT and legacy x-driver-id)
function driverAuthMiddleware(req, res, next) {
  try {
    // Try JWT first
    const authHeader = req.header("Authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      const decoded = jwt.verify(token, JWT_SECRET);
      
      if (decoded.role !== "DRIVER") {
        return res.status(403).json({ error: "Forbidden: DRIVER role required" });
      }
      
      req.auth = {
        accountId: decoded.sub,
        role: decoded.role,
        driverId: decoded.driverId,
      };
      return next();
    }
    
    // Fallback to legacy x-driver-id
    const legacyId = req.header("x-driver-id");
    if (legacyId) {
      req.auth = { driverId: legacyId, role: "DRIVER", accountId: null };
      return next();
    }
    
    return res.status(401).json({ error: "Missing authentication (Bearer token or x-driver-id)" });
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

function getDriverId(req) {
  if (!req.auth?.driverId) throw new Error("Missing driverId");
  return req.auth.driverId;
}

// Auth middleware for user endpoints
function userAuthMiddleware(req, res, next) {
  try {
    const authHeader = req.header("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer "))
      return res.status(401).json({ error: "Missing authentication" });
    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== "USER")
      return res.status(403).json({ error: "Forbidden: USER role required" });
    req.auth = { accountId: decoded.sub, role: decoded.role, userId: decoded.userId || decoded.sub };
    return next();
  } catch (err) {
    if (err.name === "JsonWebTokenError") return res.status(401).json({ error: "Invalid token" });
    if (err.name === "TokenExpiredError") return res.status(401).json({ error: "Token expired" });
    return res.status(500).json({ error: err.message });
  }
}

function getUserId(req) {
  if (!req.auth?.userId) throw new Error("Missing userId");
  return req.auth.userId;
}

app.get("/health", async (req, res) => res.json({ ok: true }));
app.get("/rides/health", async (req, res) => res.json({ ok: true }));

// Circuit breaker diagnostics
app.get("/rides/circuit-breakers", (_req, res) => {
  res.json({
    geo: cbGeo.getState(),
    auth: cbAuth.getState(),
    driver: cbDriver.getState(),
    booking: cbBooking.getState(),
  });
});

// Admin auth middleware
function adminAuthMiddleware(req, res, next) {
  try {
    const authHeader = req.header("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer "))
      return res.status(401).json({ error: "Missing authentication" });
    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== "ADMIN")
      return res.status(403).json({ error: "Forbidden: ADMIN role required" });
    req.auth = { accountId: decoded.sub, role: decoded.role };
    return next();
  } catch (err) {
    if (err.name === "JsonWebTokenError") return res.status(401).json({ error: "Invalid token" });
    if (err.name === "TokenExpiredError") return res.status(401).json({ error: "Token expired" });
    return res.status(500).json({ error: err.message });
  }
}

// Admin: get all rides
app.get("/rides/admin/all", adminAuthMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, booking_id, user_id, driver_id, status,
              pickup->>'lat' AS pickup_lat, pickup->>'lng' AS pickup_lng,
              dropoff->>'lat' AS dropoff_lat, dropoff->>'lng' AS dropoff_lng,
              fare, currency, created_at, updated_at
       FROM rides ORDER BY created_at DESC LIMIT 500`
    );
    res.json({ rides: rows });
  } catch (e) {
    console.error("[ADMIN] get all rides error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

// Cancel active ride (user, only allowed at DRIVER_ASSIGNED stage)
app.post("/rides/:rideId/user/cancel", userAuthMiddleware, async (req, res) => {
  const client = await pool.connect();
  try {
    const rideId = req.params.rideId;
    const userId = getUserId(req);

    await client.query("BEGIN");
    const r = await client.query("SELECT * FROM rides WHERE id=$1 FOR UPDATE", [rideId]);
    if (!r.rowCount) throw new Error("ride not found");
    const ride = r.rows[0];

    if (ride.user_id !== userId) throw new Error("not your ride");
    if (ride.status === "CANCELLED") {
      await client.query("COMMIT");
      return res.json({ ok: true, alreadyCancelled: true });
    }
    if (![ "DRIVER_ASSIGNED", "PICKED_UP" ].includes(ride.status)) {
      throw new Error(`Cannot cancel ride in status ${ride.status}`);
    }

    await client.query(
      "UPDATE rides SET status='CANCELLED', updated_at=now() WHERE id=$1",
      [rideId]
    );
    await client.query("COMMIT");

    const driverId = ride.driver_id;

    // Publish RIDE_CANCELLED event
    await producer.send({
      topic: rideTopic,
      messages: [{
        key: String(rideId),
        value: JSON.stringify({
          eventId: crypto.randomUUID(),
          eventType: "RIDE_CANCELLED",
          aggregateType: "RIDE",
          aggregateId: rideId,
          occurredAt: new Date().toISOString(),
          payload: { rideId, bookingId: ride.booking_id, userId, driverId, reason: "user_cancelled" },
        }),
      }],
    });

    // Set driver back to ONLINE
    if (driverId) {
      try {
        await cbDriver.exec(() => axios.post(
          `${DRIVER_BASE_URL}/internal/drivers/${driverId}/state`,
          { state: "ONLINE" },
          { timeout: 3000 }
        ));
      } catch (e) {
        log.error(`failed to set driver ${driverId} ONLINE after user cancel`, { error: e.message });
      }
      await unlockDriver(driverId);
    }

    console.log(`[RIDE] RIDE_CANCELLED by user ride=${rideId} driver=${driverId}`);
    res.json({ ok: true });
  } catch (e) {
    try { await client.query("ROLLBACK"); } catch {}
    res.status(400).json({ error: e.message });
  } finally {
    client.release();
  }
});

// Get current ride for user (active ride with driver assigned)
app.get("/users/me/rides/current", async (req, res) => {
  try {
    // Extract userId from JWT token
    const authHeader = req.header("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing authentication" });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET);
    
    if (decoded.role !== "USER") {
      return res.status(403).json({ error: "Forbidden: USER role required" });
    }

    const userId = decoded.userId || decoded.sub;

    // Get active ride for this user
    const result = await pool.query(
      `SELECT * FROM rides 
       WHERE user_id = $1 
       AND status IN ('OFFERING', 'DRIVER_ASSIGNED', 'PICKED_UP', 'ARRIVING')
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId]
    );

    if (result.rowCount === 0) {
      return res.json({ type: "none", ride: null });
    }

    const ride = result.rows[0];

    // Determine type based on status
    if (ride.status === "OFFERING") {
      return res.json({ type: "searching", ride });
    }

    if (["DRIVER_ASSIGNED", "PICKED_UP", "ARRIVING"].includes(ride.status)) {
      return res.json({ type: "active", ride });
    }

    return res.json({ type: "none", ride: null });
  } catch (e) {
    if (e.name === "JsonWebTokenError" || e.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Invalid or expired token" });
    }
    res.status(500).json({ error: e.message });
  }
});

// Get completed ride history for driver (last 20), enriched with booking details
app.get("/drivers/me/rides/history", driverAuthMiddleware, async (req, res) => {
  try {
    const driverId = getDriverId(req);
    const limit = Math.min(Number(req.query.limit) || 20, 50);

    const result = await pool.query(
      `SELECT id, booking_id, user_id, driver_id, status, created_at, updated_at
       FROM rides
       WHERE driver_id = $1 AND status = 'COMPLETED'
       ORDER BY updated_at DESC
       LIMIT $2`,
      [driverId, limit]
    );

    const rides = result.rows;
    if (rides.length === 0) return res.json({ rides: [] });

    // Enrich with booking info (pickup/dropoff/fare) from booking-service
    const bookingIds = rides.map((r) => r.booking_id).filter(Boolean);
    let bookingMap = {};
    try {
      const bResp = await cbBooking.exec(() => axios.post(
        `${BOOKING_BASE_URL}/bookings/internal/batch`,
        { ids: bookingIds },
        { timeout: 3000 }
      ));
      bookingMap = bResp.data?.bookings || {};
    } catch (e) {
      log.error("batch booking enrich failed", { error: e.message });
    }

    const enriched = rides.map((r) => ({
      rideId: r.id,
      bookingId: r.booking_id,
      userId: r.user_id,
      status: r.status,
      completedAt: r.updated_at || r.created_at,
      ...(bookingMap[r.booking_id] || {}),
    }));

    res.json({ rides: enriched });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get current ride for driver (offered or active)
app.get("/drivers/me/rides/current", driverAuthMiddleware, async (req, res) => {
  try {
    const driverId = getDriverId(req);

    // Check for active ride (DRIVER_ASSIGNED or later)
    const activeRide = await pool.query(
      `SELECT * FROM rides 
       WHERE driver_id = $1 
       AND status IN ('DRIVER_ASSIGNED', 'PICKED_UP', 'ARRIVING')
       ORDER BY created_at DESC
       LIMIT 1`,
      [driverId]
    );

    if (activeRide.rowCount > 0) {
      return res.json({
        type: "active",
        ride: activeRide.rows[0],
      });
    }

    // Check for pending offer (OFFERING)
    const offeredRide = await pool.query(
      `SELECT * FROM rides 
       WHERE current_offer_driver_id = $1 
       AND status = 'OFFERING'
       AND offer_expires_at > now()
       ORDER BY created_at DESC
       LIMIT 1`,
      [driverId]
    );

    if (offeredRide.rowCount > 0) {
      return res.json({
        type: "offered",
        ride: offeredRide.rows[0],
      });
    }

    // No current ride
    return res.json({
      type: "none",
      ride: null,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/rides/:rideId/driver/accept", driverAuthMiddleware, async (req, res) => {
  const client = await pool.connect();
  try {
    const rideId = req.params.rideId;
    const driverId = getDriverId(req);

    await client.query("BEGIN");

    const rideR = await client.query("SELECT * FROM rides WHERE id=$1 FOR UPDATE", [rideId]);
    if (!rideR.rowCount) throw new Error("ride not found");
    const ride = rideR.rows[0];

    if (ride.status !== "OFFERING") {
      throw new Error(`ride status not OFFERING (current=${ride.status})`);
    }

    // ✅ Guard: must be the current offered driver
    if (ride.current_offer_driver_id !== driverId) {
      throw new Error("not current offered driver");
    }

    // ✅ Guard: offer not expired
    if (ride.offer_expires_at && new Date(ride.offer_expires_at).getTime() < Date.now()) {
      throw new Error("offer expired");
    }

    const updOffer = await client.query(
      `UPDATE ride_offers
       SET status='ACCEPTED', responded_at=now()
       WHERE ride_id=$1 AND driver_id=$2 AND status='OFFERED'`,
      [rideId, driverId]
    );
    if (updOffer.rowCount === 0) throw new Error("no OFFERED record for this driver");

    await client.query(
      `UPDATE rides
       SET driver_id=$2,
           status='DRIVER_ASSIGNED',
           current_offer_driver_id=NULL,
           offer_expires_at=NULL,
           updated_at=now()
       WHERE id=$1`,
      [rideId, driverId]
    );

    await client.query("COMMIT");

    // ✅ Unlock now: lock is only for OFFERING phase
    await unlockDriver(driverId);

    // ✅ Set driver state to BUSY only after accept
    try {
      await cbDriver.exec(() => axios.post(
        `${DRIVER_BASE_URL}/internal/drivers/${driverId}/state`,
        { state: "BUSY" },
        { timeout: 2000 }
      ));
    } catch (e) {
      log.error(`failed to set driver ${driverId} BUSY`, { error: e.response?.data || e.message });
    }

    const driverProfile = await fetchDriverProfile(driverId);

    const acceptedEvent = {
      eventId: crypto.randomUUID(),
      eventType: "RIDE_ACCEPTED",
      aggregateType: "RIDE",
      aggregateId: rideId,
      occurredAt: new Date().toISOString(),
      payload: {
        rideId,
        bookingId: ride.booking_id,
        userId: ride.user_id,
        driverId,
        driverProfile: driverProfile ? {
          full_name: driverProfile.full_name || null,
          phone: driverProfile.phone || null,
          vehicle_type: driverProfile.vehicle_type || null,
          license_plate: driverProfile.license_plate || null,
        } : null,
      },
    };

    await producer.send({
      topic: rideTopic,
      messages: [{ key: String(rideId), value: JSON.stringify(acceptedEvent) }],
    });

    res.json({ ok: true, rideId, status: "DRIVER_ASSIGNED" });
  } catch (e) {
    try {
      await client.query("ROLLBACK");
    } catch {}
    res.status(400).json({ error: e.message });
  } finally {
    client.release();
  }
});

app.post("/rides/:rideId/driver/reject", driverAuthMiddleware, async (req, res) => {
  const client = await pool.connect();
  try {
    const rideId = req.params.rideId;
    const driverId = getDriverId(req);

    await client.query("BEGIN");

    const rideR = await client.query("SELECT * FROM rides WHERE id=$1 FOR UPDATE", [rideId]);
    if (!rideR.rowCount) throw new Error("ride not found");
    const ride = rideR.rows[0];

    if (ride.status !== "OFFERING") throw new Error(`ride status not OFFERING (current=${ride.status})`);

    await client.query(
      `UPDATE ride_offers
       SET status='REJECTED', responded_at=now()
       WHERE ride_id=$1 AND driver_id=$2 AND status='OFFERED'`,
      [rideId, driverId]
    );

    await client.query(
      `UPDATE rides
       SET current_offer_driver_id=NULL,
           offer_expires_at=NULL,
           candidate_index=candidate_index+1,
           updated_at=now()
       WHERE id=$1 AND status='OFFERING'`,
      [rideId]
    );

    await client.query("COMMIT");

    await unlockDriver(driverId);
    await offerNextDriver(rideId);

    res.json({ ok: true });
  } catch (e) {
    try {
      await client.query("ROLLBACK");
    } catch {}
    res.status(400).json({ error: e.message });
  } finally {
    client.release();
  }
});

// Mark passenger as picked up (DRIVER_ASSIGNED → PICKED_UP)
app.post("/rides/:rideId/driver/pickup", driverAuthMiddleware, async (req, res) => {
  const client = await pool.connect();
  try {
    const rideId = req.params.rideId;
    const driverId = getDriverId(req);

    await client.query("BEGIN");
    const r = await client.query("SELECT * FROM rides WHERE id=$1 FOR UPDATE", [rideId]);
    if (!r.rowCount) throw new Error("ride not found");
    const ride = r.rows[0];

    if (ride.driver_id !== driverId) throw new Error("not your ride");
    if (ride.status === "PICKED_UP") {
      await client.query("COMMIT");
      return res.json({ ok: true, alreadyPickedUp: true });
    }
    if (ride.status !== "DRIVER_ASSIGNED") {
      throw new Error(`Cannot mark pickup in status ${ride.status}`);
    }

    await client.query(
      "UPDATE rides SET status='PICKED_UP', updated_at=now() WHERE id=$1",
      [rideId]
    );
    await client.query("COMMIT");

    await producer.send({
      topic: rideTopic,
      messages: [{
        key: String(rideId),
        value: JSON.stringify({
          eventId: crypto.randomUUID(),
          eventType: "PASSENGER_PICKED_UP",
          aggregateType: "RIDE",
          aggregateId: rideId,
          occurredAt: new Date().toISOString(),
          payload: { rideId, bookingId: ride.booking_id, userId: ride.user_id, driverId },
        }),
      }],
    });

    console.log(`[RIDE] PASSENGER_PICKED_UP ride=${rideId} driver=${driverId}`);
    res.json({ ok: true });
  } catch (e) {
    try { await client.query("ROLLBACK"); } catch {}
    res.status(400).json({ error: e.message });
  } finally {
    client.release();
  }
});

app.post("/rides/:rideId/complete", driverAuthMiddleware, async (req, res) => {
  const client = await pool.connect();
  try {
    const rideId = req.params.rideId;
    const driverId = getDriverId(req);

    await client.query("BEGIN");
    const r = await client.query("SELECT * FROM rides WHERE id=$1 FOR UPDATE", [rideId]);
    if (!r.rowCount) throw new Error("ride not found");

    const ride = r.rows[0];
    if (ride.driver_id !== driverId) throw new Error("not your ride");

    if (ride.status === "COMPLETED") {
      await client.query("COMMIT");
      return res.json({ ok: true, alreadyCompleted: true });
    }

    await client.query(
      "UPDATE rides SET status='COMPLETED', updated_at=now() WHERE id=$1",
      [rideId]
    );
    await client.query("COMMIT");

    const doneEvent = {
      eventId: crypto.randomUUID(),
      eventType: "RIDE_COMPLETED",
      aggregateType: "RIDE",
      aggregateId: rideId,
      occurredAt: new Date().toISOString(),
      payload: {
        rideId,
        bookingId: ride.booking_id,
        userId: ride.user_id,
        driverId,
      },
    };

    await producer.send({
      topic: rideTopic,
      messages: [{ key: String(rideId), value: JSON.stringify(doneEvent) }],
    });

    // ✅ Release driver back to ONLINE
    try {
      await cbDriver.exec(() => axios.post(
        `${DRIVER_BASE_URL}/internal/drivers/${driverId}/state`,
        { state: "ONLINE" },
        { timeout: 3000 }
      ));
    } catch (e) {
      log.error(`failed to set driver ${driverId} ONLINE`, { error: e.response?.data || e.message });
    }

    // ✅ Cleanup lock just in case
    await unlockDriver(driverId);

    res.json({ ok: true });
  } catch (e) {
    try {
      await client.query("ROLLBACK");
    } catch {}
    res.status(400).json({ error: e.message });
  } finally {
    client.release();
  }
});

/** MAIN */
async function main() {
  await runMigrations();

  await rds.connect();
  console.log("✅ ride-service redis connected");

  await producer.connect();
  console.log("✅ ride-service producer connected");

  await consumer.connect();
  await consumer.subscribe({ topic: bookingTopic, fromBeginning: false });
  console.log(`✅ ride-service consuming topic=${bookingTopic}, group=${groupId}`);

  // Start timeout loop
  startTimeoutLoop();
  // Start retry loop for NO_DRIVER_FOUND rides
  startRetryLoop();

  // Start API
  app.listen(PORT, () => console.log(`✅ Ride API listening on http://localhost:${PORT}`));

  // Consumer
  await consumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value) return;

      const evt = JSON.parse(message.value.toString());
      const eventId = evt.eventId;

      if (!eventId) return; // skip bad message

      // Idempotency guard
      if (await alreadyProcessed(eventId)) {
        // log nhẹ thôi
        // console.log(`[RIDE] skip duplicated ${evt.eventType} eventId=${eventId}`);
        return;
      }

      if (evt.eventType === "BOOKING_CANCELLED") {
        // Cancel any OFFERING ride for this booking and notify the driver currently being offered
        try {
          const bookingId = evt.aggregateId || evt.payload?.bookingId;
          if (bookingId) {
            const { rows } = await pool.query(
              `UPDATE rides SET status='CANCELLED', updated_at=now()
               WHERE booking_id=$1 AND status IN ('OFFERING','NO_DRIVER_FOUND')
               RETURNING id, current_offer_driver_id`,
              [bookingId]
            );
            for (const row of rows) {
              if (row.current_offer_driver_id) {
                // Unlock the driver
                try { await unlockDriver(row.current_offer_driver_id); } catch {}
                // Notify driver via SSE that the offer is cancelled
                await producer.send({
                  topic: rideTopic,
                  messages: [{
                    key: String(row.id),
                    value: JSON.stringify({
                      eventId: crypto.randomUUID(),
                      eventType: "RIDE_OFFER_CANCELLED",
                      aggregateType: "RIDE",
                      aggregateId: row.id,
                      occurredAt: new Date().toISOString(),
                      payload: {
                        rideId: row.id,
                        bookingId,
                        driverId: row.current_offer_driver_id,
                        reason: "booking_cancelled",
                      },
                    }),
                  }],
                });
                console.log(`[RIDE] BOOKING_CANCELLED → RIDE_OFFER_CANCELLED ride=${row.id} driver=${row.current_offer_driver_id}`);
              }
            }
          }
        } catch (e) {
          console.error("[RIDE] BOOKING_CANCELLED handler error:", e.message);
        }
        await markProcessed(eventId);
        return;
      }

      if (evt.eventType !== "BOOKING_MATCH_REQUESTED") {
        // MVP: ignore other event types
        await markProcessed(eventId);
        return;
      }

      // Handle BOOKING_MATCH_REQUESTED
      try {
        const bookingId = evt.aggregateId;
        const { userId, pickup, dropoff, vehicleType, pricingSnapshot } = evt.payload || {};
        if (!pickup?.lat || !pickup?.lng || !vehicleType) throw new Error("payload missing pickup/vehicleType");

        const fare       = pricingSnapshot?.fare       ?? null;
        const distanceM  = pricingSnapshot?.distanceM  ?? null;
        const durationS  = pricingSnapshot?.durationS  ?? null;
        const currency   = pricingSnapshot?.currency   || "VND";

        // Query nearby drivers
        const resp = await cbDriver.exec(() => axios.get(`${DRIVER_BASE_URL}/drivers/nearby`, {
          params: {
            lat: pickup.lat,
            lng: pickup.lng,
            radiusM: 3000,
            vehicleType,
            limit: 20,
          },
          timeout: 3000,
        }));

        const drivers = resp.data?.drivers || [];

        // Create or reuse ride for this booking (idempotent)
        const client = await pool.connect();
        let rideId;
        try {
          await client.query("BEGIN");

          const existing = await client.query(
            "SELECT id, status FROM rides WHERE booking_id=$1 FOR UPDATE",
            [bookingId]
          );

          if (existing.rowCount > 0) {
            rideId = existing.rows[0].id;
          } else {
            rideId = crypto.randomUUID();
            await client.query(
              `INSERT INTO rides(id, booking_id, user_id, status, candidates, candidate_index, pickup, dropoff, fare, distance_m, duration_s, currency, vehicle_type)
                VALUES ($1,$2,$3,'OFFERING',$4,0,$5,$6,$7,$8,$9,$10,$11)`,
                [rideId, bookingId, userId || null, JSON.stringify(drivers),
                pickup ? JSON.stringify(pickup) : null,
                dropoff ? JSON.stringify(dropoff) : null,
                fare, distanceM, durationS, currency, vehicleType || null]
            );
          }

          // Update latest candidates and ensure pickup/dropoff/fare are stored
          await client.query(
            `UPDATE rides SET candidates=$2, updated_at=now(),
              pickup   = COALESCE(pickup,   $3::jsonb),
              dropoff  = COALESCE(dropoff,  $4::jsonb),
              fare     = COALESCE(fare,     $5),
              distance_m = COALESCE(distance_m, $6),
              duration_s = COALESCE(duration_s, $7),
              currency   = COALESCE(currency,   $8),
              vehicle_type = COALESCE(vehicle_type, $9)
             WHERE id=$1`,
            [rideId, JSON.stringify(drivers),
             pickup  ? JSON.stringify(pickup)  : null,
             dropoff ? JSON.stringify(dropoff) : null,
             fare, distanceM, durationS, currency, vehicleType || null]
          );

          if (drivers.length === 0) {
            const nextRetry = new Date(Date.now() + DRIVER_RETRY_INTERVAL_SEC * 1000).toISOString();
            await client.query(
              `UPDATE rides SET status='NO_DRIVER_FOUND', retry_count=0, next_retry_at=$2, vehicle_type=$3, updated_at=now() WHERE id=$1`,
              [rideId, nextRetry, vehicleType || null]
            );
            await client.query("COMMIT");
            console.log(`[RIDE] NO_DRIVER_FOUND booking=${bookingId} ride=${rideId} (will retry ${nextRetry})`);
          } else {
            await client.query("COMMIT");
            console.log(`[RIDE] MATCH_REQUEST booking=${bookingId} ride=${rideId} drivers=${drivers.length}`);
            await offerNextDriver(rideId);
          }
        } catch (e) {
          try {
            await client.query("ROLLBACK");
          } catch {}
          throw e;
        } finally {
          client.release();
        }

        // Mark processed only after success
        await markProcessed(eventId);
      } catch (e) {
        console.error("[RIDE] handle BOOKING_MATCH_REQUESTED failed:", e.message);
        // IMPORTANT: do NOT markProcessed here
      }
    },
  });
}

main().catch((e) => {
  console.error("❌ ride-service fatal:", e);
  process.exit(1);
});