import { pool } from "../config/database.js";
import { getUserId } from "../middlewares/auth.middleware.js";
import {
  getActiveBooking, insertBooking, insertStatusHistory, insertOutboxEvent,
  findIdempotent, getBookingById, getUserBookingHistory, getUserBookings,
  updateBookingStatusById, batchGetBookings,
  getOutboxEvents, findBookingForCancel, cancelBooking,
} from "../models/booking.model.js";
import { uuid, ValidationError, assertLatLng, VALID_PAYMENT_METHODS } from "../services/booking.service.js";

// bookingProducer is injected at app startup
let _producer = null;
let _bookingTopic = null;

export function setProducer(producer, bookingTopic) {
  _producer = producer;
  _bookingTopic = bookingTopic;
}

// ── Health ───────────────────────────────────────────────────────────────────
export async function healthCheck(req, res) {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
}

// ── Active booking ────────────────────────────────────────────────────────────
export async function getMyActiveBooking(req, res) {
  try {
    const userId = getUserId(req);
    const result = await getActiveBooking(userId);

    if (result.rowCount === 0) return res.json({ booking: null });

    const booking = result.rows[0];
    let ride = null;
    if (booking.ride_id) ride = { id: booking.ride_id };

    res.json({
      booking: {
        id: booking.id,
        status: booking.status,
        vehicleType: booking.vehicle_type,
        pickup:  { lat: booking.pickup_lat,  lng: booking.pickup_lng,  address: booking.pickup_address },
        dropoff: { lat: booking.dropoff_lat, lng: booking.dropoff_lng, address: booking.dropoff_address },
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
}

// ── Create booking ─────────────────────────────────────────────────────────────
export async function createBooking(req, res) {
  const client = await pool.connect();
  try {
    const idempotencyKey = req.header("X-Idempotency-Key") || req.header("Idempotency-Key");
    if (idempotencyKey) {
      const existing = await findIdempotent(client, idempotencyKey);
      if (existing.rows.length > 0) {
        return res.json({ booking_id: existing.rows[0].id, bookingId: existing.rows[0].id, status: existing.rows[0].status, deduplicated: true });
      }
    }

    // Accept simplified body: `drop` as alias for `dropoff`; optional vehicleType/paymentMethod/pricingSnapshot
    const body = req.body || {};
    const { userId, pickup, distance_km, simulate_no_driver } = body;
    const dropoff = body.dropoff || body.drop;

    // Simulation flag: no drivers available (FE-TC13)
    if (simulate_no_driver) {
      return res.json({ status: "PENDING", message: "No drivers available at this time. Please try again later.", booking_id: null });
    }

    const vehicleType   = body.vehicleType   || "CAR_4";
    const paymentMethod = body.paymentMethod || "CASH";
    let   pricingSnapshot = body.pricingSnapshot;

    const finalUserId = getUserId(req);
    if (userId && String(userId) !== String(finalUserId)) {
      return res.status(403).json({ error: "userId does not match authenticated user" });
    }

    // Validate required fields (with 400/422 distinction)
    try {
      assertLatLng(pickup,  "pickup");
      assertLatLng(dropoff, "dropoff");
    } catch (ve) {
      if (ve.name === "ValidationError") return res.status(422).json({ detail: ve.message });
      return res.status(400).json({ message: ve.message });
    }

    if (!VALID_PAYMENT_METHODS.includes(paymentMethod)) {
      return res.status(400).json({ message: "Invalid payment method", valid: VALID_PAYMENT_METHODS });
    }

    // Build pricingSnapshot from distance_km if not provided
    if (!pricingSnapshot?.fare) {
      const distKm = Number(distance_km) || 5;
      const distM  = Math.round(distKm * 1000);
      const durS   = Math.round(distKm * 120);       // ~2 min/km
      const fare   = Math.round(distM * 5);           // ~5000 VND/km
      pricingSnapshot = { fare, distanceM: distM, durationS: durS, currency: "VND" };
    }

    const distKm        = (pricingSnapshot.distanceM / 1000) || Number(distance_km) || 5;
    const eta           = Math.max(1, Math.round(distKm * 2));  // simple estimate
    const surge         = 1.0;
    const bookingId     = uuid();
    const status        = "REQUESTED";
    const createdAt     = new Date().toISOString();
    const paymentStatus = paymentMethod === "VNPAY" ? "PENDING" : "NOT_REQUIRED";

    await client.query("BEGIN");

    await insertBooking(client, {
      id: bookingId, userId: finalUserId, status, paymentMethod, paymentStatus,
      pickup, dropoff, vehicleType,
      distanceM: pricingSnapshot.distanceM, durationS: pricingSnapshot.durationS,
      fare: pricingSnapshot.fare, currency: pricingSnapshot.currency || "VND",
      idempotencyKey,
    });

    await insertStatusHistory(client, uuid(), bookingId, null, status, "created");

    await insertOutboxEvent(client, uuid(), "BOOKING", bookingId, "BOOKING_CREATED", {
      bookingId, userId: finalUserId, status, paymentMethod, vehicleType,
      pickup, dropoff, pricingSnapshot, createdAt,
    });

    if (paymentMethod !== "VNPAY") {
      await insertOutboxEvent(client, uuid(), "BOOKING", bookingId, "BOOKING_MATCH_REQUESTED", {
        bookingId, userId: finalUserId, requestedAt: createdAt,
        pickup, dropoff, vehicleType, paymentMethod, pricingSnapshot,
      });
    }

    await client.query("COMMIT");
    res.json({
      booking_id: bookingId, bookingId, status,
      created_at: createdAt,
      eta, price: pricingSnapshot.fare, surge,
    });
  } catch (e) {
    await client.query("ROLLBACK");
    if (e.name === "ValidationError") return res.status(422).json({ detail: e.message });
    res.status(400).json({ message: e.message || "Bad Request" });
  } finally {
    client.release();
  }
}

// ── List bookings for user (GET /bookings) ────────────────────────────────────
export async function listBookings(req, res) {
  try {
    const userId = getUserId(req);
    const limit  = Math.min(Number(req.query.limit) || 50, 100);
    const result = await getUserBookings(userId, limit);
    const bookings = result.rows.map((b) => ({
      booking_id: b.id,
      status:     b.status,
      fare:       b.fare,
      currency:   b.currency,
      created_at: b.created_at,
    }));
    res.json(bookings);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

// ── Update booking status (PUT /bookings/:id/status) ──────────────────────────
export async function updateBookingStatus(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body || {};
    const VALID = ["REQUESTED","ACCEPTED","DRIVER_ASSIGNED","PICKED_UP","COMPLETED","CANCELLED","FAILED"];
    if (!status || !VALID.includes(status))
      return res.status(400).json({ message: `status must be one of: ${VALID.join(",")}` });
    const r = await updateBookingStatusById(id, status);
    if (!r.rowCount) return res.status(404).json({ message: "Booking not found" });
    res.json({ booking_id: r.rows[0].id, status: r.rows[0].status });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

// ── Get booking by id ─────────────────────────────────────────────────────────
export async function getBooking(req, res) {
  try {
    const r = await getBookingById(req.params.id);
    if (!r.rows.length) return res.status(404).json({ error: "Not found" });
    res.json(r.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

// ── User booking history ───────────────────────────────────────────────────────
export async function getMyHistory(req, res) {
  try {
    const userId = getUserId(req);
    const limit  = Math.min(Number(req.query.limit) || 20, 50);
    const result = await getUserBookingHistory(userId, limit);

    const rides = result.rows.map((b) => ({
      bookingId:   b.id,
      status:      b.status,
      vehicleType: b.vehicle_type,
      pickup:  { lat: b.pickup_lat,  lng: b.pickup_lng,  address: b.pickup_address },
      dropoff: { lat: b.dropoff_lat, lng: b.dropoff_lng, address: b.dropoff_address },
      fare: b.fare, currency: b.currency, distanceM: b.distance_m, durationS: b.duration_s,
      rideId: b.ride_id, driverId: b.driver_id || "",
      completedAt: b.updated_at || b.created_at,
    }));
    res.json({ rides });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

// ── Internal batch ─────────────────────────────────────────────────────────────
export async function internalBatch(req, res) {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) return res.json({ bookings: {} });

    const result   = await batchGetBookings(ids);
    const bookings = {};
    for (const b of result.rows) {
      bookings[b.id] = {
        pickup:  { lat: b.pickup_lat,  lng: b.pickup_lng,  address: b.pickup_address },
        dropoff: { lat: b.dropoff_lat, lng: b.dropoff_lng, address: b.dropoff_address },
        fare: b.fare, currency: b.currency, distanceM: b.distance_m, durationS: b.duration_s,
        vehicleType: b.vehicle_type, completedAt: b.updated_at || b.created_at,
      };
    }
    res.json({ bookings });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

// ── Outbox viewer ─────────────────────────────────────────────────────────────
export async function viewOutbox(req, res) {
  const status = req.query.status || "NEW";
  const r = await getOutboxEvents(status);
  res.json({ items: r.rows });
}

// ── Cancel booking ─────────────────────────────────────────────────────────────
export async function cancelUserBooking(req, res) {
  const { id } = req.params;
  const userId = getUserId(req);
  try {
    const { rows } = await findBookingForCancel(id);
    if (!rows.length) return res.status(404).json({ error: "Booking not found" });

    const bk = rows[0];
    if (String(bk.user_id) !== String(userId))
      return res.status(403).json({ error: "Not your booking" });
    if (["COMPLETED", "CANCELLED"].includes(bk.status))
      return res.status(400).json({ error: `Booking already ${bk.status}` });
    if (["MATCHED", "DRIVER_ASSIGNED"].includes(bk.status))
      return res.status(400).json({ error: "Cannot cancel: driver already assigned" });

    await cancelBooking(id);

    if (_producer && _bookingTopic) {
      const evt = {
        eventId: uuid(), eventType: "BOOKING_CANCELLED",
        aggregateType: "BOOKING", aggregateId: id,
        occurredAt: new Date().toISOString(),
        payload: { bookingId: id, userId, reason: "user_cancelled" },
      };
      await _producer.send({ topic: _bookingTopic, messages: [{ key: id, value: JSON.stringify(evt) }] });
    }

    console.log(`[BOOKING] manual cancel: booking=${id} userId=${userId}`);
    res.json({ ok: true, bookingId: id, status: "CANCELLED" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
