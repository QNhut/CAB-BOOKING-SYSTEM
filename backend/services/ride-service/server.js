import crypto from "crypto";
import { app, runMigrations, pool, producer, consumer, BOOKING_TOPIC, RIDE_TOPIC, redis, unlockDriver, startTimeoutLoop, startRetryLoop, offerNextDriver, fetchNearbyDrivers, alreadyProcessed, markProcessed, insertRide, updateRideCandidates, setRideNoDriverFoundWithRetry, cancelOfferingRidesByBooking, DRIVER_RETRY_INTERVAL_SEC } from "./app.js";

const PORT = Number(process.env.PORT || 8005);

// ── Kafka consumer ──────────────────────────────────────────────────────────
async function startKafkaConsumer() {
  await consumer.subscribe({ topic: BOOKING_TOPIC, fromBeginning: false });
  console.log(`✅ ride-service consuming ${BOOKING_TOPIC}`);

  await consumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value) return;
      const evt = JSON.parse(message.value.toString());
      const eventId = evt.eventId;
      if (!eventId) return;
      if (await alreadyProcessed(eventId)) return;

      if (evt.eventType === "BOOKING_CANCELLED") {
        try {
          const bookingId = evt.aggregateId || evt.payload?.bookingId;
          if (bookingId) {
            const { rows } = await cancelOfferingRidesByBooking(bookingId);
            for (const row of rows) {
              if (row.current_offer_driver_id) {
                try { await unlockDriver(row.current_offer_driver_id); } catch {}
                await producer.send({
                  topic: RIDE_TOPIC,
                  messages: [{
                    key: String(row.id),
                    value: JSON.stringify({
                      eventId: crypto.randomUUID(), eventType: "RIDE_OFFER_CANCELLED",
                      aggregateType: "RIDE", aggregateId: row.id,
                      occurredAt: new Date().toISOString(),
                      payload: { rideId: row.id, bookingId, driverId: row.current_offer_driver_id, reason: "booking_cancelled" },
                    }),
                  }],
                });
                console.log(`[RIDE] BOOKING_CANCELLED → RIDE_OFFER_CANCELLED ride=${row.id}`);
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
        await markProcessed(eventId);
        return;
      }

      // Handle BOOKING_MATCH_REQUESTED
      try {
        const bookingId = evt.aggregateId;
        const { userId, pickup, dropoff, vehicleType, pricingSnapshot } = evt.payload || {};
        if (!pickup?.lat || !pickup?.lng || !vehicleType) throw new Error("payload missing pickup/vehicleType");

        const fare      = pricingSnapshot?.fare      ?? null;
        const distanceM = pricingSnapshot?.distanceM ?? null;
        const durationS = pricingSnapshot?.durationS ?? null;
        const currency  = pricingSnapshot?.currency  || "VND";

        const drivers = await fetchNearbyDrivers(pickup, vehicleType);

        const client = await pool.connect();
        let rideId;
        try {
          await client.query("BEGIN");

          const existing = await client.query(
            "SELECT id, status FROM rides WHERE booking_id=$1 FOR UPDATE", [bookingId]
          );
          if (existing.rowCount > 0) {
            rideId = existing.rows[0].id;
          } else {
            rideId = crypto.randomUUID();
            await insertRide(client, { id: rideId, bookingId, userId, candidates: drivers, pickup, dropoff, fare, distanceM, durationS, currency, vehicleType });
          }

          await updateRideCandidates(client, { rideId, candidates: drivers, pickup, dropoff, fare, distanceM, durationS, currency, vehicleType });

          if (drivers.length === 0) {
            const nextRetry = new Date(Date.now() + DRIVER_RETRY_INTERVAL_SEC * 1000).toISOString();
            await setRideNoDriverFoundWithRetry(client, rideId, nextRetry);
            await client.query("COMMIT");
            console.log(`[RIDE] NO_DRIVER_FOUND booking=${bookingId} ride=${rideId}`);
          } else {
            await client.query("COMMIT");
            console.log(`[RIDE] MATCH_REQUEST booking=${bookingId} ride=${rideId} drivers=${drivers.length}`);
            await offerNextDriver(rideId);
          }
        } catch (e) {
          try { await client.query("ROLLBACK"); } catch {}
          throw e;
        } finally {
          client.release();
        }

        await markProcessed(eventId);
      } catch (e) {
        console.error("[RIDE] handle BOOKING_MATCH_REQUESTED failed:", e.message);
      }
    },
  });
}

async function main() {
  await runMigrations();

  await redis.connect();
  console.log("✅ ride-service redis connected");

  await producer.connect();
  console.log("✅ ride-service producer connected");

  await consumer.connect();
  console.log("✅ ride-service consumer connected");

  startTimeoutLoop();
  startRetryLoop();

  app.listen(PORT, () => console.log(`✅ Ride service on http://localhost:${PORT}`));

  startKafkaConsumer().catch((e) => console.error("[RIDE] Kafka start error:", e.message));
}

main().catch((e) => {
  console.error("❌ ride-service fatal:", e);
  process.exit(1);
});
