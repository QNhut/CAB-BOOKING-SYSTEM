import { Kafka } from "kafkajs";

const brokers       = (process.env.KAFKA_BROKERS       || "kafka:9092").split(",");
export const BOOKING_TOPIC = process.env.KAFKA_BOOKING_TOPIC || "taxi.bookings";
export const RIDE_TOPIC    = process.env.KAFKA_RIDE_TOPIC    || "taxi.rides";
export const PAYMENT_TOPIC = process.env.KAFKA_PAYMENT_TOPIC || "taxi.payments";
export const GROUP_ID      = process.env.KAFKA_GROUP_ID      || "notification-service";

const kafka    = new Kafka({ clientId: "notification-service", brokers });
export const consumer = kafka.consumer({ groupId: GROUP_ID });

// ── In-memory SSE client registry ────────────────────────────────────────────
export const userClients   = new Map(); // userId   -> Set(res)
export const driverClients = new Map(); // driverId -> Set(res)

export function addClient(map, id, res) {
  if (!map.has(id)) map.set(id, new Set());
  map.get(id).add(res);
}

export function removeClient(map, id, res) {
  const set = map.get(id);
  if (!set) return;
  set.delete(res);
  if (set.size === 0) map.delete(id);
}

export function sseWrite(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

export function broadcast(map, id, event, data) {
  const set = map.get(id);
  if (!set) { console.log(`[notif] broadcast ${event} -> id=${id} :: NO_CLIENTS`); return; }
  for (const res of set) sseWrite(res, event, data);
}

function routeEvent(evt) {
  const { eventType, payload } = evt;
  if (eventType === "RIDE_OFFERED_TO_DRIVER") {
    if (payload?.driverId) broadcast(driverClients, String(payload.driverId), "ride_offer", evt);
  } else if (eventType === "RIDE_ACCEPTED") {
    if (payload?.driverId) broadcast(driverClients, String(payload.driverId), "ride_accepted", evt);
    if (payload?.userId)   broadcast(userClients,   String(payload.userId),   "ride_accepted", evt);
  } else if (eventType === "PASSENGER_PICKED_UP") {
    if (payload?.driverId) broadcast(driverClients, String(payload.driverId), "passenger_picked_up", evt);
    if (payload?.userId)   broadcast(userClients,   String(payload.userId),   "passenger_picked_up", evt);
  } else if (eventType === "RIDE_COMPLETED") {
    if (payload?.driverId) broadcast(driverClients, String(payload.driverId), "ride_completed", evt);
    if (payload?.userId)   broadcast(userClients,   String(payload.userId),   "ride_completed", evt);
  } else if (eventType === "RIDE_OFFER_CANCELLED") {
    if (payload?.driverId) broadcast(driverClients, String(payload.driverId), "ride_offer_cancelled", evt);
  } else if (eventType === "RIDE_CANCELLED") {
    if (payload?.driverId) broadcast(driverClients, String(payload.driverId), "ride_cancelled", evt);
    if (payload?.userId)   broadcast(userClients,   String(payload.userId),   "ride_cancelled", evt);
  } else if (eventType === "BOOKING_CANCELLED") {
    if (payload?.userId)   broadcast(userClients,   String(payload.userId),   "booking_cancelled", evt);
  } else if (eventType?.startsWith("BOOKING_")) {
    if (payload?.userId)   broadcast(userClients,   String(payload.userId),   "booking", evt);
  } else if (eventType?.startsWith("PAYMENT_")) {
    if (payload?.userId)   broadcast(userClients,   String(payload.userId),   "payment", evt);
  }
}

async function startKafka() {
  await consumer.connect();
  await consumer.subscribe({ topics: [BOOKING_TOPIC, RIDE_TOPIC, PAYMENT_TOPIC], fromBeginning: false });
  console.log(`✅ notification-service consuming topics=${[BOOKING_TOPIC, RIDE_TOPIC, PAYMENT_TOPIC].join(",")}`);
  await consumer.run({
    eachMessage: async ({ topic: msgTopic, message }) => {
      if (!message.value) return;
      try {
        const evt = JSON.parse(message.value.toString());
        routeEvent(evt);
      } catch (e) {
        console.error("notification parse error:", e.message);
      }
    },
  });
}

export async function startKafkaWithRetry(attempt = 1, maxAttempts = 20, baseDelayMs = 3000) {
  try {
    await startKafka();
  } catch (e) {
    console.error(`[notif] Kafka start error (attempt ${attempt}/${maxAttempts}):`, e.message);
    if (attempt >= maxAttempts) { console.error("[notif] Giving up after max Kafka retries"); return; }
    const delay = Math.min(baseDelayMs * attempt, 30000);
    setTimeout(() => startKafkaWithRetry(attempt + 1, maxAttempts, baseDelayMs), delay);
  }
}
