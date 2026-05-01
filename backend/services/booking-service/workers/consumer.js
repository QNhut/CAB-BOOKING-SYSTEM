import { Kafka } from "kafkajs";
import { Pool } from "pg";
import crypto from "crypto";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const kafka = new Kafka({
  clientId: "booking-consumer",
  brokers: (process.env.KAFKA_BROKERS || "kafka:9092").split(","),
});

const consumer = kafka.consumer({ groupId: process.env.KAFKA_GROUP_ID || "booking-service" });
const rideTopic = process.env.KAFKA_RIDE_TOPIC || "taxi.rides";
const paymentTopic = process.env.KAFKA_PAYMENT_TOPIC || "taxi.payments";

await consumer.connect();
await consumer.subscribe({ topic: rideTopic, fromBeginning: false });
await consumer.subscribe({ topic: paymentTopic, fromBeginning: false });

console.log(`✅ booking-consumer started topics=${[rideTopic, paymentTopic].join(",")}`);

await consumer.run({
  eachMessage: async ({ message }) => {
    if (!message.value) return;
    const evt = JSON.parse(message.value.toString());

    // ── PAYMENT_COMPLETED: booking -> PAID + request matching ─────────────────
    if (evt.eventType === "PAYMENT_COMPLETED") {
      const bookingId = evt.payload?.bookingId || evt.payload?.orderId;
      if (!bookingId) return;

      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const bookingResult = await client.query(
          `SELECT id, user_id, status, payment_method, vehicle_type,
                  pickup_lat, pickup_lng, pickup_address,
                  dropoff_lat, dropoff_lng, dropoff_address,
                  fare, currency, distance_m, duration_s
             FROM bookings
            WHERE id=$1
            FOR UPDATE`,
          [bookingId]
        );

        const booking = bookingResult.rows[0];
        if (!booking) {
          await client.query("COMMIT");
          console.warn(`[BOOKING] PAYMENT_COMPLETED ignored: booking=${bookingId} not found`);
          return;
        }

        if (["COMPLETED", "CANCELLED", "MATCHED", "PAID"].includes(booking.status)) {
          await client.query("COMMIT");
          console.log(`[BOOKING] PAYMENT_COMPLETED skipped: booking=${bookingId} status=${booking.status}`);
          return;
        }

        const updateResult = await client.query(
          `UPDATE bookings
              SET status='PAID', payment_status='PAID', updated_at=now()
            WHERE id=$1`,
          [bookingId]
        );

        if (updateResult.rowCount > 0) {
          await client.query(
            `INSERT INTO booking_status_history(id, booking_id, from_status, to_status, reason)
             VALUES ($1,$2,$3,$4,$5)
             ON CONFLICT DO NOTHING`,
            [crypto.randomUUID(), bookingId, booking.status, "PAID", "payment_completed"]
          );

          await client.query(
            `INSERT INTO outbox_events (id, aggregate_type, aggregate_id, event_type, payload)
             VALUES ($1,$2,$3,$4,$5)
             ON CONFLICT DO NOTHING`,
            [
              crypto.randomUUID(),
              "BOOKING",
              bookingId,
              "BOOKING_MATCH_REQUESTED",
              {
                bookingId,
                userId: booking.user_id,
                requestedAt: new Date().toISOString(),
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
                vehicleType: booking.vehicle_type,
                paymentMethod: booking.payment_method,
                pricingSnapshot: {
                  fare: booking.fare,
                  currency: booking.currency,
                  distanceM: booking.distance_m,
                  durationS: booking.duration_s,
                },
              },
            ]
          );
        }

        await client.query("COMMIT");
        console.log(`[BOOKING] PAYMENT_COMPLETED: booking=${bookingId} -> PAID + MATCH_REQUESTED`);
      } catch (e) {
        try { await client.query("ROLLBACK"); } catch {}
        console.error("[BOOKING] PAYMENT_COMPLETED error:", e.message);
      } finally {
        client.release();
      }
      return;
    }

    // ── RIDE_ACCEPTED: booking -> MATCHED ──────────────────────────────
    if (evt.eventType === "RIDE_ACCEPTED") {
      const { bookingId, rideId, driverId } = evt.payload || {};
      if (!bookingId) return;

      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const r = await client.query(
          `UPDATE bookings
           SET status='MATCHED', ride_id=$2, driver_id=$3, updated_at=now()
           WHERE id=$1 AND status NOT IN ('COMPLETED','CANCELLED')`,
          [bookingId, rideId, driverId]
        );
        if (r.rowCount > 0) {
          await client.query(
            `INSERT INTO booking_status_history(id, booking_id, from_status, to_status, reason)
             VALUES ($1,$2,$3,$4,$5)
             ON CONFLICT DO NOTHING`,
            [crypto.randomUUID(), bookingId, "PAID", "MATCHED", `driver=${driverId}`]
          );
        }
        await client.query("COMMIT");
        console.log(`[BOOKING] RIDE_ACCEPTED: booking=${bookingId} -> MATCHED ride=${rideId}`);
      } catch (e) {
        try { await client.query("ROLLBACK"); } catch {}
        console.error("[BOOKING] RIDE_ACCEPTED error:", e.message);
      } finally {
        client.release();
      }
      return;
    }

    // ── RIDE_COMPLETED: booking -> COMPLETED ───────────────────────────
    if (evt.eventType === "RIDE_COMPLETED") {
      const { rideId, bookingId } = evt.payload || {};
      // Support lookup by bookingId (preferred) or rideId
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        let updated = 0;
        if (bookingId) {
          const r = await client.query(
            `UPDATE bookings
             SET status='COMPLETED', updated_at=now()
             WHERE id=$1 AND status NOT IN ('COMPLETED','CANCELLED')`,
            [bookingId]
          );
          updated = r.rowCount;
        }
        // Fallback: lookup by ride_id
        if (!updated && rideId) {
          const r = await client.query(
            `UPDATE bookings
             SET status='COMPLETED', updated_at=now()
             WHERE ride_id=$1 AND status NOT IN ('COMPLETED','CANCELLED')`,
            [rideId]
          );
          updated = r.rowCount;
        }
        await client.query("COMMIT");
        console.log(`[BOOKING] RIDE_COMPLETED: ${updated} booking(s) -> COMPLETED (rideId=${rideId}, bookingId=${bookingId})`);
      } catch (e) {
        try { await client.query("ROLLBACK"); } catch {}
        console.error("[BOOKING] RIDE_COMPLETED error:", e.message);
      } finally {
        client.release();
      }
      return;
    }

    // ── PAYMENT_FAILED: booking -> CANCELLED (compensation) ────────────
    if (evt.eventType === "PAYMENT_FAILED") {
      const { bookingId } = evt.payload || {};
      if (!bookingId) return;
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const r = await client.query(
          `UPDATE bookings SET status='CANCELLED', updated_at=now()
           WHERE id=$1 AND status NOT IN ('COMPLETED','CANCELLED')`,
          [bookingId]
        );
        if (r.rowCount > 0) {
          await client.query(
            `INSERT INTO booking_status_history(id, booking_id, from_status, to_status, reason)
             VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`,
            [crypto.randomUUID(), bookingId, "WAITING_PAYMENT", "CANCELLED", "payment_failed"]
          );
        }
        await client.query("COMMIT");
        console.log(`[BOOKING] PAYMENT_FAILED: booking=${bookingId} -> CANCELLED`);
      } catch (e) {
        try { await client.query("ROLLBACK"); } catch {}
        console.error("[BOOKING] PAYMENT_FAILED error:", e.message);
      } finally {
        client.release();
      }
      return;
    }
  }
});
