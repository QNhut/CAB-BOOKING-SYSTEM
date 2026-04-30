import jwt from "jsonwebtoken";
import { userClients, driverClients, addClient, removeClient, sseWrite } from "../services/notification.service.js";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-in-production-please";

export function healthCheck(_req, res) { res.json({ ok: true }); }

/** POST /notifications — push a notification to a user/driver via SSE (or store for polling) */
export function sendNotification(req, res) {
  const { user_id, driver_id, message } = req.body || {};
  if (!message) return res.status(400).json({ message: "message is required" });

  // Try to push via SSE to connected clients
  if (user_id) {
    const clients = userClients.get(String(user_id));
    if (clients) for (const c of clients) sseWrite(c, "notification", { message, user_id, timestamp: new Date().toISOString() });
  }
  if (driver_id) {
    const clients = driverClients.get(String(driver_id));
    if (clients) for (const c of clients) sseWrite(c, "notification", { message, driver_id, timestamp: new Date().toISOString() });
  }

  res.json({
    status:    "sent",
    user_id:   user_id   || null,
    driver_id: driver_id || null,
    message,
    timestamp: new Date().toISOString(),
  });
}

/** GET /notifications?driver_id=&booking_id=&user_id= — polling endpoint */
export function getNotifications(req, res) {
  const { driver_id, booking_id, user_id } = req.query;
  res.json({
    driver_id:  driver_id  || null,
    user_id:    user_id    || null,
    booking_id: booking_id || null,
    message:    booking_id
      ? `Ride assignment for booking ${booking_id}`
      : "No pending notifications",
    timestamp:  new Date().toISOString(),
  });
}

export function debugClients(_req, res) {
  const users = {};
  for (const [k, v] of userClients) users[k] = v.size;
  const drivers = {};
  for (const [k, v] of driverClients) drivers[k] = v.size;
  res.json({ users, drivers });
}

export function sseStream(req, res) {
  try {
    const token = String(req.query.token || "");
    let role, userId, driverId;

    if (token) {
      const decoded = jwt.verify(token, JWT_SECRET);
      role = String(decoded.role || "").toUpperCase();
      userId = decoded.userId || decoded.sub;
      driverId = decoded.driverId;
    } else {
      role     = String(req.query.role     || "").toUpperCase();
      userId   = String(req.query.userId   || "");
      driverId = String(req.query.driverId || "");
    }

    if (role !== "USER" && role !== "DRIVER")
      return res.status(400).json({ error: "role must be USER|DRIVER" });
    if (role === "USER"   && !userId)   return res.status(400).json({ error: "userId required" });
    if (role === "DRIVER" && !driverId) return res.status(400).json({ error: "driverId required" });

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.setHeader("Content-Encoding", "none");
    res.flushHeaders?.();

    const id = role === "USER" ? userId : driverId;
    if (role === "USER") addClient(userClients, id, res);
    else addClient(driverClients, id, res);
    console.log(`[notif] SSE CONNECTED role=${role} id=${id}`);

    sseWrite(res, "hello", { ok: true, role, id, ts: Date.now() });

    const heartbeat = setInterval(() => res.write(`: ping ${Date.now()}\n\n`), 15000);

    req.on("close", () => {
      clearInterval(heartbeat);
      if (role === "USER") removeClient(userClients, id, res);
      else removeClient(driverClients, id, res);
      console.log(`[notif] SSE DISCONNECTED role=${role} id=${id}`);
    });
  } catch (err) {
    console.error("SSE connection error:", err.message);
    res.status(400).json({ error: err.message });
  }
}
