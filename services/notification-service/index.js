import express from "express";
import cors from "cors";
import { Kafka } from "kafkajs";
import jwt from "jsonwebtoken";
import { createLogger } from "../../shared/logger.js";
import { createHttpMetrics } from "../../shared/http-metrics.js";

const app = express();
app.use(cors());
app.use(express.json());
app.use(cors({ origin: "*", credentials: false }));
const { metricsMiddleware, metricsEndpoint } = createHttpMetrics("notification-service");
app.use(metricsMiddleware);

const PORT = Number(process.env.PORT || 8006);
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-in-production-please";

const kafka = new Kafka({
  clientId: "notification-service",
  brokers: (process.env.KAFKA_BROKERS || "kafka:9092").split(","),
});

const bookingTopic = process.env.KAFKA_BOOKING_TOPIC || "taxi.bookings";
const rideTopic    = process.env.KAFKA_RIDE_TOPIC    || "taxi.rides";
const paymentTopic = process.env.KAFKA_PAYMENT_TOPIC || "taxi.payments";
const groupId = process.env.KAFKA_GROUP_ID || "notification-service";
const log = createLogger("notification-service");

const consumer = kafka.consumer({ groupId });

// In-memory connection registry
const userClients = new Map();   // userId -> Set(res)
const driverClients = new Map(); // driverId -> Set(res)

function addClient(map, id, res) {
  if (!map.has(id)) map.set(id, new Set());
  map.get(id).add(res);
}

function removeClient(map, id, res) {
  const set = map.get(id);
  if (!set) return;
  set.delete(res);
  if (set.size === 0) map.delete(id);
}

function sseWrite(res, event, data) {
  // SSE format
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function broadcast(map, id, event, data) {
  const set = map.get(id);
  if (!set) {
    log.debug("notification_broadcast_skipped", { event, target_id: id, reason: "no_clients", registry_size: map.size });
    return;
  }
  log.debug("notification_broadcast", { event, target_id: id, client_count: set.size });
  for (const res of set) {
    sseWrite(res, event, data);
  }
}

// SSE endpoint
app.get("/notifications/stream", (req, res) => {
  try {
    // Support both token (JWT) and legacy role/userId/driverId
    const token = String(req.query.token || "");
    let role, userId, driverId;

    if (token) {
      // Decode JWT token
      const decoded = jwt.verify(token, JWT_SECRET);
      role = String(decoded.role || "").toUpperCase();
      userId = decoded.userId || decoded.sub;
      driverId = decoded.driverId;
    } else {
      // Legacy query params
      role = String(req.query.role || "").toUpperCase();
      userId = String(req.query.userId || "");
      driverId = String(req.query.driverId || "");
    }

    if (role !== "USER" && role !== "DRIVER") {
      return res.status(400).json({ error: "role must be USER|DRIVER (from token or query)" });
    }
    if (role === "USER" && !userId) {
      return res.status(400).json({ error: "userId required (from token or query)" });
    }
    if (role === "DRIVER" && !driverId) {
      return res.status(400).json({ error: "driverId required (from token or query)" });
    }

    // SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no"); // nếu chạy qua nginx
    res.setHeader("Content-Encoding", "none"); // tránh compression buffering
    res.flushHeaders?.();

    // register
    const id = role === "USER" ? userId : driverId;
    if (role === "USER") addClient(userClients, id, res);
    else addClient(driverClients, id, res);
    log.info("notification_sse_connected", {
      role,
      client_id: id,
      connected_users: userClients.size,
      connected_drivers: driverClients.size,
    });

    // hello + heartbeat (keep-alive)
    sseWrite(res, "hello", { ok: true, role, id, ts: Date.now() });

    const heartbeat = setInterval(() => {
      // comment line to keep connection alive
      res.write(`: ping ${Date.now()}\n\n`);
    }, 15000);

    req.on("close", () => {
      clearInterval(heartbeat);
      if (role === "USER") removeClient(userClients, id, res);
      else removeClient(driverClients, id, res);
      log.info("notification_sse_disconnected", {
        role,
        client_id: id,
        connected_users: userClients.size,
        connected_drivers: driverClients.size,
      });
    });
  } catch (err) {
    log.error("notification_sse_error", { error: err.message });
    res.status(400).json({ error: err.message });
  }
});

app.get("/health", (req, res) => res.json({ ok: true }));
app.get("/notifications/health", (req, res) => res.json({ ok: true }));
app.get("/metrics", metricsEndpoint);

// Debug: show connected clients
app.get("/notifications/debug", (req, res) => {
  const users = {};
  for (const [k, v] of userClients) users[k] = v.size;
  const drivers = {};
  for (const [k, v] of driverClients) drivers[k] = v.size;
  res.json({ users, drivers });
});

// ---- Kafka consume & route events ----
function routeEvent(evt) {
  const { eventType, payload } = evt;

  // 1) driver-side offer
  if (eventType === "RIDE_OFFERED_TO_DRIVER") {
    const driverId = payload?.driverId;
    if (driverId) broadcast(driverClients, String(driverId), "ride_offer", evt);
    return;
  }

  // 2) ride accepted/completed -> send to both (if ids exist)
  if (eventType === "RIDE_ACCEPTED") {
    const driverId = payload?.driverId;
    const userId = payload?.userId; // nếu bạn có, sẽ gửi user
    if (driverId) broadcast(driverClients, String(driverId), "ride_accepted", evt);
    if (userId) broadcast(userClients, String(userId), "ride_accepted", evt);
    return;
  }

  if (eventType === "PASSENGER_PICKED_UP") {
    const driverId = payload?.driverId;
    const userId = payload?.userId;
    if (driverId) broadcast(driverClients, String(driverId), "passenger_picked_up", evt);
    if (userId) broadcast(userClients, String(userId), "passenger_picked_up", evt);
    return;
  }

  if (eventType === "RIDE_COMPLETED") {
    const driverId = payload?.driverId;
    const userId = payload?.userId;
    if (driverId) broadcast(driverClients, String(driverId), "ride_completed", evt);
    if (userId) broadcast(userClients, String(userId), "ride_completed", evt);
    return;
  }

  // 2b) offer cancelled — notify the driver whose offer was pulled
  if (eventType === "RIDE_OFFER_CANCELLED") {
    const driverId = payload?.driverId;
    if (driverId) broadcast(driverClients, String(driverId), "ride_offer_cancelled", evt);
    return;
  }

  // 2c) ride cancelled by user — notify both driver and user
  if (eventType === "RIDE_CANCELLED") {
    const driverId = payload?.driverId;
    const userId = payload?.userId;
    if (driverId) broadcast(driverClients, String(driverId), "ride_cancelled", evt);
    if (userId) broadcast(userClients, String(userId), "ride_cancelled", evt);
    return;
  }

  // 3) booking cancelled → dedicated SSE event for user
  if (eventType === "BOOKING_CANCELLED") {
    const userId = payload?.userId;
    if (userId) broadcast(userClients, String(userId), "booking_cancelled", evt);
    return;
  }

  // 4) generic booking updates
  if (eventType && eventType.startsWith("BOOKING_")) {
    const userId = payload?.userId;
    if (userId) broadcast(userClients, String(userId), "booking", evt);
    return;
  }

  // 4) payment updates
  if (eventType && eventType.startsWith("PAYMENT_")) {
    const userId = payload?.userId;
    if (userId) broadcast(userClients, String(userId), "payment", evt);
    return;
  }
}

async function startKafka() {
  await consumer.connect();
  await consumer.subscribe({ topics: [bookingTopic, rideTopic, paymentTopic], fromBeginning: false });
  log.info("notification_kafka_consuming", {
    topics: [bookingTopic, rideTopic, paymentTopic],
    group_id: groupId,
  });

  await consumer.run({
    eachMessage: async ({ topic: msgTopic, message }) => {
      if (!message.value) return;
      try {
        const evt = JSON.parse(message.value.toString());
        log.debug("notification_kafka_message", {
          event_type: evt.eventType,
          aggregate_id: evt.aggregateId,
          topic: msgTopic,
        });
        routeEvent(evt);
      } catch (e) {
        log.warn("notification_parse_error", { error: e.message, topic: msgTopic });
      }
    },
  });
}

app.listen(PORT, () => log.info("notification_service_started", { port: PORT }));

// Retry startKafka with exponential backoff — handles race condition where
// Kafka is healthy but the topic doesn't exist yet when the service first connects.
async function startKafkaWithRetry(attempt = 1, maxAttempts = 20, baseDelayMs = 3000) {
  try {
    await startKafka();
  } catch (e) {
    log.error("notification_kafka_start_error", {
      attempt,
      max_attempts: maxAttempts,
      error: e.message,
    });
    if (attempt >= maxAttempts) {
      log.error("notification_kafka_start_aborted", { attempt, max_attempts: maxAttempts });
      return;
    }
    const delay = Math.min(baseDelayMs * attempt, 30000);
    log.warn("notification_kafka_retry_scheduled", { attempt, delay_ms: delay });
    setTimeout(() => startKafkaWithRetry(attempt + 1, maxAttempts, baseDelayMs), delay);
  }
}

startKafkaWithRetry();
