import { Kafka } from "kafkajs";
import { Pool } from "pg";
import crypto from "crypto";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const kafka = new Kafka({
  clientId: "booking-consumer",
  brokers: (process.env.KAFKA_BROKERS || "kafka:9092").split(","),
});

const consumer = kafka.consumer({ groupId: process.env.KAFKA_GROUP_ID || "booking-service" });
const topic = process.env.KAFKA_RIDE_TOPIC || "taxi.rides";

await consumer.connect();
await consumer.subscribe({ topic, fromBeginning: false });

console.log("✅ booking-consumer started");

await consumer.run({
  eachMessage: async ({ message }) => {
    if (!message.value) return;
    const evt = JSON.parse(message.value.toString());

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
