import crypto from "crypto";
import axios from "axios";
import { pool } from "../config/database.js";
import { producer, RIDE_TOPIC } from "../config/kafka.js";
import { unlockDriver } from "../config/redis.js";
import {
  driverAuthMiddleware, userAuthMiddleware, adminAuthMiddleware,
  getDriverId, getUserId,
} from "../middlewares/auth.middleware.js";
import {
  getRideForUpdate, acceptRideOffer, assignDriver, rejectRideOffer, advanceCandidateIndex,
  getActiveRideForUser, getActiveRideForDriver, getOfferedRideForDriver,
  getCompletedRidesForDriver, getAllRidesAdmin,
} from "../models/ride.model.js";
import {
  cbBooking, cbDriver, cbAuth, setDriverState, fetchDriverProfile, publishEvent, offerNextDriver,
  OFFER_TIMEOUT_SEC,
} from "../services/ride.service.js";

const BOOKING_BASE_URL = process.env.BOOKING_BASE_URL || "http://booking-service:8003";

// ── Health ────────────────────────────────────────────────────────────────────
export async function healthCheck(_req, res) { res.json({ ok: true }); }

export async function circuitBreakers(_req, res) {
  res.json({
    geo: "N/A", auth: cbAuth.getState(),
    driver: cbDriver.getState(), booking: cbBooking.getState(),
  });
}

// ── Admin ─────────────────────────────────────────────────────────────────────
export async function adminGetAllRides(req, res) {
  try {
    const { rows } = await getAllRidesAdmin();
    res.json({ rides: rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

// ── User endpoints ────────────────────────────────────────────────────────────
export async function getUserCurrentRide(req, res) {
  try {
    const userId = getUserId(req);
    const result = await getActiveRideForUser(userId);
    if (!result.rowCount) return res.json({ type: "none", ride: null });
    const ride = result.rows[0];
    if (ride.status === "OFFERING") return res.json({ type: "searching", ride });
    return res.json({ type: "active", ride });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

export async function userCancelRide(req, res) {
  const client = await pool.connect();
  try {
    const rideId = req.params.rideId;
    const userId = getUserId(req);

    await client.query("BEGIN");
    const r = await getRideForUpdate(client, rideId);
    if (!r.rowCount) throw new Error("ride not found");
    const ride = r.rows[0];

    if (ride.user_id !== userId) throw new Error("not your ride");
    if (ride.status === "CANCELLED") {
      await client.query("COMMIT");
      return res.json({ ok: true, alreadyCancelled: true });
    }
    if (!["DRIVER_ASSIGNED", "PICKED_UP"].includes(ride.status))
      throw new Error(`Cannot cancel ride in status ${ride.status}`);

    await client.query("UPDATE rides SET status='CANCELLED', updated_at=now() WHERE id=$1", [rideId]);
    await client.query("COMMIT");

    const driverId = ride.driver_id;
    await publishEvent("RIDE_CANCELLED", rideId, { rideId, bookingId: ride.booking_id, userId, driverId, reason: "user_cancelled" });

    if (driverId) {
      try { await setDriverState(driverId, "ONLINE"); } catch {}
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
}

// ── Driver endpoints ──────────────────────────────────────────────────────────
export async function getDriverCurrentRide(req, res) {
  try {
    const driverId = getDriverId(req);
    const active   = await getActiveRideForDriver(driverId);
    if (active.rowCount > 0) return res.json({ type: "active", ride: active.rows[0] });

    const offered = await getOfferedRideForDriver(driverId);
    if (offered.rowCount > 0) return res.json({ type: "offered", ride: offered.rows[0] });

    return res.json({ type: "none", ride: null });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

export async function getDriverRideHistory(req, res) {
  try {
    const driverId = getDriverId(req);
    const limit    = Math.min(Number(req.query.limit) || 20, 50);
    const result   = await getCompletedRidesForDriver(driverId, limit);

    const rides = result.rows;
    if (!rides.length) return res.json({ rides: [] });

    const bookingIds = rides.map((r) => r.booking_id).filter(Boolean);
    let bookingMap = {};
    try {
      const bResp = await cbBooking.exec(() => axios.post(
        `${BOOKING_BASE_URL}/bookings/internal/batch`,
        { ids: bookingIds }, { timeout: 3000 }
      ));
      bookingMap = bResp.data?.bookings || {};
    } catch {}

    const enriched = rides.map((r) => ({
      rideId: r.id, bookingId: r.booking_id, userId: r.user_id,
      status: r.status, completedAt: r.updated_at || r.created_at,
      ...(bookingMap[r.booking_id] || {}),
    }));

    res.json({ rides: enriched });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

export async function acceptRide(req, res) {
  const client = await pool.connect();
  try {
    const rideId   = req.params.rideId;
    const driverId = getDriverId(req);

    await client.query("BEGIN");
    const r = await getRideForUpdate(client, rideId);
    if (!r.rowCount) throw new Error("ride not found");
    const ride = r.rows[0];

    if (ride.status !== "OFFERING") throw new Error(`ride status not OFFERING (current=${ride.status})`);
    if (ride.current_offer_driver_id !== driverId) throw new Error("not current offered driver");
    if (ride.offer_expires_at && new Date(ride.offer_expires_at).getTime() < Date.now()) throw new Error("offer expired");

    const upd = await acceptRideOffer(client, rideId, driverId);
    if (upd.rowCount === 0) throw new Error("no OFFERED record for this driver");

    await assignDriver(client, rideId, driverId);
    await client.query("COMMIT");

    await unlockDriver(driverId);

    try { await setDriverState(driverId, "BUSY"); } catch {}

    const driverProfile = await fetchDriverProfile(driverId);
    await publishEvent("RIDE_ACCEPTED", rideId, {
      rideId, bookingId: ride.booking_id, userId: ride.user_id, driverId,
      driverProfile: driverProfile ? {
        full_name: driverProfile.full_name || null, phone: driverProfile.phone || null,
        vehicle_type: driverProfile.vehicle_type || null, license_plate: driverProfile.license_plate || null,
      } : null,
    });

    res.json({ ok: true, rideId, status: "DRIVER_ASSIGNED" });
  } catch (e) {
    try { await client.query("ROLLBACK"); } catch {}
    res.status(400).json({ error: e.message });
  } finally {
    client.release();
  }
}

export async function rejectRide(req, res) {
  const client = await pool.connect();
  try {
    const rideId   = req.params.rideId;
    const driverId = getDriverId(req);

    await client.query("BEGIN");
    const r = await getRideForUpdate(client, rideId);
    if (!r.rowCount) throw new Error("ride not found");
    const ride = r.rows[0];

    if (ride.status !== "OFFERING") throw new Error(`ride status not OFFERING (current=${ride.status})`);

    await rejectRideOffer(client, rideId, driverId);
    await advanceCandidateIndex(client, rideId);
    await client.query("COMMIT");

    await unlockDriver(driverId);
    await offerNextDriver(rideId);

    res.json({ ok: true });
  } catch (e) {
    try { await client.query("ROLLBACK"); } catch {}
    res.status(400).json({ error: e.message });
  } finally {
    client.release();
  }
}

export async function pickupPassenger(req, res) {
  const client = await pool.connect();
  try {
    const rideId   = req.params.rideId;
    const driverId = getDriverId(req);

    await client.query("BEGIN");
    const r = await getRideForUpdate(client, rideId);
    if (!r.rowCount) throw new Error("ride not found");
    const ride = r.rows[0];

    if (ride.driver_id !== driverId) throw new Error("not your ride");
    if (ride.status === "PICKED_UP") { await client.query("COMMIT"); return res.json({ ok: true, alreadyPickedUp: true }); }
    if (ride.status !== "DRIVER_ASSIGNED") throw new Error(`Cannot mark pickup in status ${ride.status}`);

    await client.query("UPDATE rides SET status='PICKED_UP', updated_at=now() WHERE id=$1", [rideId]);
    await client.query("COMMIT");

    await publishEvent("PASSENGER_PICKED_UP", rideId, { rideId, bookingId: ride.booking_id, userId: ride.user_id, driverId });

    console.log(`[RIDE] PASSENGER_PICKED_UP ride=${rideId} driver=${driverId}`);
    res.json({ ok: true });
  } catch (e) {
    try { await client.query("ROLLBACK"); } catch {}
    res.status(400).json({ error: e.message });
  } finally {
    client.release();
  }
}

export async function completeRide(req, res) {
  const client = await pool.connect();
  try {
    const rideId   = req.params.rideId;
    const driverId = getDriverId(req);

    await client.query("BEGIN");
    const r = await getRideForUpdate(client, rideId);
    if (!r.rowCount) throw new Error("ride not found");
    const ride = r.rows[0];

    if (ride.driver_id !== driverId) throw new Error("not your ride");
    if (ride.status === "COMPLETED") { await client.query("COMMIT"); return res.json({ ok: true, alreadyCompleted: true }); }

    await client.query("UPDATE rides SET status='COMPLETED', updated_at=now() WHERE id=$1", [rideId]);
    await client.query("COMMIT");

    await publishEvent("RIDE_COMPLETED", rideId, { rideId, bookingId: ride.booking_id, userId: ride.user_id, driverId });

    try { await setDriverState(driverId, "ONLINE"); } catch {}
    await unlockDriver(driverId);

    res.json({ ok: true });
  } catch (e) {
    try { await client.query("ROLLBACK"); } catch {}
    res.status(400).json({ error: e.message });
  } finally {
    client.release();
  }
}

// Export middleware references for routes
export { driverAuthMiddleware, userAuthMiddleware, adminAuthMiddleware };
