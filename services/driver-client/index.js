import { Kafka } from "kafkajs";
import axios from "axios";
import { createLogger } from "../../shared/logger.js";

const brokers = (process.env.KAFKA_BROKERS || "kafka:9092").split(",");
const topic = process.env.KAFKA_RIDE_TOPIC || "taxi.rides";
const groupId = process.env.KAFKA_GROUP_ID || "driver-client";

const DRIVER_ID = process.env.DRIVER_ID || "d1";
const RIDE_BASE_URL = process.env.RIDE_BASE_URL || "http://ride-service:8005";
const log = createLogger("driver-client");

const kafka = new Kafka({ clientId: `driver-${DRIVER_ID}`, brokers });
const consumer = kafka.consumer({ groupId });

await consumer.connect();
await consumer.subscribe({ topic, fromBeginning: false });

log.info("driver_client_started", { driver_id: DRIVER_ID, topic, group_id: groupId });

await consumer.run({
  eachMessage: async ({ message }) => {
    if (!message.value) return;
    const evt = JSON.parse(message.value.toString());

    if (evt.eventType === "RIDE_OFFERED_TO_DRIVER" && evt.payload?.driverId === DRIVER_ID) {
      log.info("driver_offer_received", { driver_id: DRIVER_ID, ride_id: evt.payload.rideId, booking_id: evt.payload.bookingId });

      // MVP auto-accept sau 1s (để test)
      await new Promise(r => setTimeout(r, 1000));

      try {
        const url = `${RIDE_BASE_URL}/rides/${evt.payload.rideId}/driver/accept`;
        const resp = await axios.post(url, {}, { headers: { "x-driver-id": DRIVER_ID }, timeout: 3000 });
        log.info("driver_offer_accepted", { driver_id: DRIVER_ID, ride_id: evt.payload.rideId, response: resp.data });
      } catch (e) {
        log.error("driver_offer_accept_failed", { driver_id: DRIVER_ID, ride_id: evt.payload.rideId, error: e.response?.data || e.message });
      }
    }
  }
});
