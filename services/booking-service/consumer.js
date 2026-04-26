import { Kafka } from "kafkajs";
import { Pool } from "pg";
import crypto from "crypto";
import { createLogger } from "../../shared/logger.js";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const kafka = new Kafka({
  clientId: "booking-consumer",
  brokers: (process.env.KAFKA_BROKERS || "kafka:9092").split(","),
});

const consumer = kafka.consumer({
  groupId: process.env.KAFKA_GROUP_ID || "booking-compensation-service",
});
const rideTopic = process.env.KAFKA_RIDE_TOPIC || "taxi.rides";
const paymentTopic = process.env.KAFKA_PAYMENT_TOPIC || "taxi.payments";
const log = createLogger("booking-consumer");

await consumer.connect();
await consumer.subscribe({ topics: [rideTopic, paymentTopic], fromBeginning: false });

log.info("booking_consumer_started", { topics: [rideTopic, paymentTopic] });

await consumer.run({
  eachMessage: async ({ message }) => {
    if (!message.value) return;
    const evt = JSON.parse(message.value.toString());

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
        log.info("booking_consumer_ride_accepted", { booking_id: bookingId, ride_id: rideId, driver_id: driverId });
      } catch (e) {
        try { await client.query("ROLLBACK"); } catch {}
        log.error("booking_consumer_ride_accepted_error", { error: e.message, booking_id: bookingId, ride_id: rideId });
      } finally {
        client.release();
      }
      return;
    }

    if (evt.eventType === "RIDE_COMPLETED") {
      const { rideId, bookingId } = evt.payload || {};
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
        log.info("booking_consumer_ride_completed", { updated_count: updated, ride_id: rideId || null, booking_id: bookingId || null });
      } catch (e) {
        try { await client.query("ROLLBACK"); } catch {}
        log.error("booking_consumer_ride_completed_error", { error: e.message, ride_id: rideId || null, booking_id: bookingId || null });
      } finally {
        client.release();
      }
      return;
    }

    if (evt.eventType === "PAYMENT_FAILED") {
      const { bookingId } = evt.payload || {};
      if (!bookingId) return;
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const r = await client.query(
          `UPDATE bookings
           SET status='CANCELLED', updated_at=now()
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
        log.info("booking_consumer_payment_failed", { booking_id: bookingId, status: "CANCELLED" });
      } catch (e) {
        try { await client.query("ROLLBACK"); } catch {}
        log.error("booking_consumer_payment_failed_error", { error: e.message, booking_id: bookingId });
      } finally {
        client.release();
      }
      return;
    }
  },
});
