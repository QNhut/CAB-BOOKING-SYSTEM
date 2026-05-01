import { app, runMigrations, pool, createProducer, createConsumer, KAFKA_BOOKING_TOPIC, KAFKA_RIDE_TOPIC, uuid, cancelExpiredBookings } from "./app.js";
import { setProducer } from "./controllers/booking.controller.js";

const PORT = process.env.PORT || 8003;

const bookingProducer = createProducer("booking-service-producer");
const kafkaConsumer   = createConsumer("booking-service-consumer", "booking-service");

// ── Kafka consumer ──────────────────────────────────────────────────────────
async function startKafkaConsumer() {
  await kafkaConsumer.connect();
  await kafkaConsumer.subscribe({ topic: KAFKA_RIDE_TOPIC, fromBeginning: false });
  console.log(`✅ booking-service consuming ${KAFKA_RIDE_TOPIC}`);

  await kafkaConsumer.run({
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

// ── Auto-cancel job ─────────────────────────────────────────────────────────
async function startAutoCancelJob() {
  const JOB_INTERVAL_MS = 30_000;
  const EXPIRE_MINUTES  = 2;

  async function runCancelJob() {
    try {
      const { rows } = await cancelExpiredBookings(EXPIRE_MINUTES);
      if (rows.length > 0) {
        console.log(`[BOOKING] auto-cancelled ${rows.length} expired booking(s)`);
        const msgs = rows.map((bk) => ({
          key:   bk.id,
          value: JSON.stringify({
            eventId: uuid(), eventType: "BOOKING_CANCELLED",
            aggregateType: "BOOKING", aggregateId: bk.id,
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

async function main() {
  await runMigrations();
  await bookingProducer.connect();
  console.log("✅ booking-service Kafka producer connected");

  setProducer(bookingProducer, KAFKA_BOOKING_TOPIC);

  app.listen(PORT, () => {
    console.log(`Booking service running on http://localhost:${PORT}`);
  });

  startKafkaConsumer().catch((e) => console.error("[BOOKING] Kafka start error:", e.message));
  startAutoCancelJob().catch((e) => console.error("[BOOKING] auto-cancel start error:", e.message));
}

main().catch((err) => {
  console.error("❌ booking-service fatal:", err);
  process.exit(1);
});
