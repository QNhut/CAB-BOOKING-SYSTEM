import express from "express";
import cors from "cors";
import { createClient } from "redis";
import jwt from "jsonwebtoken";
import { createLogger } from "../../shared/logger.js";
import { createHttpMetrics } from "../../shared/http-metrics.js";
import { createTracingMiddleware } from "../../shared/jaeger-tracing.js";

const log = createLogger("driver-service");
const { metricsMiddleware, metricsEndpoint } = createHttpMetrics("driver-service");

const app = express();
app.use(cors());
app.use(express.json());
app.use(createTracingMiddleware("driver-service"));
app.use(metricsMiddleware);

const PORT = Number(process.env.PORT || 8004);
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const HB_TTL_SEC = Number(process.env.HB_TTL_SEC || 1800); // 30 phút
const STATE_TTL_SEC = Number(process.env.STATE_TTL_SEC || 1800); // 30 phút
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-in-production-please";

const redis = createClient({ url: REDIS_URL });
redis.on("error", (e) => log.error("redis_error", { error: e.message }));
await redis.connect();
import axios from "axios";
const DRIVER_BASE_URL = process.env.DRIVER_BASE_URL || "http://driver-service:8004";

function assertLatLng(lat, lng) {
  if (typeof lat !== "number" || typeof lng !== "number") throw new Error("lat/lng must be numbers");
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) throw new Error("lat/lng out of range");
}

function geoKey(vehicleType) {
  if (!vehicleType) throw new Error("vehicleType required");
  return `geo:drivers:${vehicleType}`;
}

const hbKey = (driverId) => `driver:hb:${driverId}`;
const stateKey = (driverId) => `driver:state:${driverId}`;
const vehicleKey = (driverId) => `driver:vehicle:${driverId}`;

// Auth middleware: support both JWT and legacy x-driver-id
function authMiddleware(req, res, next) {
  try {
    // Try JWT first
    const authHeader = req.header("Authorization");
    log.debug("driver_auth_attempt", {
      has_authorization: Boolean(authHeader),
      has_legacy_driver_id: Boolean(req.header("x-driver-id")),
    });
    
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      const decoded = jwt.verify(token, JWT_SECRET);
      log.debug("driver_auth_jwt_decoded", {
        role: decoded.role,
        driver_id: decoded.driverId || null,
        account_id: decoded.sub || null,
      });
      
      if (decoded.role !== "DRIVER") {
        return res.status(403).json({ error: "Forbidden: DRIVER role required" });
      }
      
      req.auth = {
        accountId: decoded.sub,
        role: decoded.role,
        driverId: decoded.driverId,
      };
      return next();
    }
    
    // Fallback to legacy x-driver-id (for backward compatibility)
    const legacyId = req.header("x-driver-id");
    if (legacyId) {
      log.info("driver_auth_legacy_header_used", { driver_id: legacyId });
      req.auth = { driverId: legacyId, role: "DRIVER", accountId: null };
      return next();
    }
    
    return res.status(401).json({ error: "Missing authentication (Bearer token or x-driver-id)" });
  } catch (err) {
    log.error("driver_auth_error", { error: err.message, error_name: err.name });
    if (err.name === "JsonWebTokenError") {
      return res.status(401).json({ error: "Invalid token" });
    }
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Token expired" });
    }
    return res.status(500).json({ error: err.message });
  }
}

function getDriverId(req) {
  if (!req.auth?.driverId) throw new Error("Missing driverId");
  return req.auth.driverId;
}

// Health
app.get("/health", async (req, res) => {
  try {
    await redis.ping();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});
app.get("/drivers/health", async (req, res) => {
  try {
    await redis.ping();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});
app.get("/metrics", metricsEndpoint);

// --- GET current driver state (auto-restore on dashboard load) ---
app.get("/drivers/me", authMiddleware, async (req, res) => {
  try {
    const driverId = getDriverId(req);
    
    const [status, vehicleType, hb] = await Promise.all([
      redis.get(stateKey(driverId)),
      redis.get(vehicleKey(driverId)),
      redis.get(hbKey(driverId)),
    ]);

    let location = null;
    if (vehicleType && (status === "ONLINE" || status === "BUSY")) {
      // Try to get location from geo index
      try {
        const geoPos = await redis.geoPos(geoKey(vehicleType), driverId);
        if (geoPos && geoPos[0]) {
          location = {
            lng: Number(geoPos[0].longitude),
            lat: Number(geoPos[0].latitude),
          };
        }
      } catch (err) {
        // Geo position might not exist yet
      }
    }

    res.json({
      driverId,
      status: status || "OFFLINE",
      vehicleType: vehicleType || null,
      location,
      isActive: !!hb, // heartbeat exists = active in last 30min
      ttlSec: STATE_TTL_SEC,
    });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// --- 1) Set status ONLINE/OFFLINE ---
app.post("/drivers/me/status", authMiddleware, async (req, res) => {
  try {
    const driverId = getDriverId(req);
    const { status, vehicleType, lat, lng } = req.body || {};

    if (!["ONLINE", "OFFLINE", "BUSY"].includes(status)) {
      throw new Error("status must be ONLINE|OFFLINE|BUSY");
    }

    // MVP: cho phép truyền vehicleType khi set ONLINE lần đầu
    if (vehicleType) {
      await redis.set(vehicleKey(driverId), vehicleType);
    }
    const vt = await redis.get(vehicleKey(driverId));
    if (!vt && status !== "OFFLINE") {
      throw new Error("vehicleType missing: set it once via body {vehicleType:'CAR_4'}");
    }

    if (status === "OFFLINE") {
      // remove khỏi geo sets (nếu có vt thì remove đúng set, nếu không thì remove cả 2 set)
      const candidates = vt ? [vt] : ["CAR_4", "CAR_7"];
      for (const v of candidates) {
          await redis.sendCommand(["ZREM", geoKey(v), driverId]);
      }
      await redis.set(stateKey(driverId), "OFFLINE");
      await redis.del(hbKey(driverId));
      return res.json({ driverId, status: "OFFLINE" });
    }

    // If client provided lat/lng together with status, add to GEO index so
    // the driver becomes immediately discoverable without a separate location call.
    if (typeof lat === "number" && typeof lng === "number") {
      try {
        assertLatLng(lat, lng);
        await redis.geoAdd(geoKey(vt), { longitude: lng, latitude: lat, member: driverId });
      } catch (err) {
        log.warn("driver_status_invalid_lat_lng", { driver_id: driverId, error: err.message });
      }
    }

    // ONLINE/BUSY: set state với TTL 30 phút
    await redis.set(stateKey(driverId), status, { EX: STATE_TTL_SEC });
    // Refresh heartbeat whenever driver is ONLINE/BUSY so /drivers/nearby includes them.
    await redis.set(hbKey(driverId), "1", { EX: HB_TTL_SEC });
    // If location not provided here, driver will be added to GEO when they POST /drivers/me/location
    res.json({ driverId, status, vehicleType: vt, ttlSec: STATE_TTL_SEC });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// --- 2) Update location (requires ONLINE/BUSY) ---
app.post("/drivers/me/location", authMiddleware, async (req, res) => {
  try {
    const driverId = getDriverId(req);
    const { lat, lng, accuracyM, ts } = req.body || {};
    assertLatLng(lat, lng);

    const st = await redis.get(stateKey(driverId));
    if (!st || st === "OFFLINE") throw new Error("driver is OFFLINE (set status ONLINE first)");

    const vt = await redis.get(vehicleKey(driverId));
    if (!vt) throw new Error("vehicleType missing (set via /drivers/me/status)");

    // GEOADD: redis expects lng lat
    await redis.geoAdd(geoKey(vt), { longitude: lng, latitude: lat, member: driverId });

    // heartbeat TTL
    await redis.set(hbKey(driverId), "1", { EX: HB_TTL_SEC });

    res.json({
      ok: true,
      driverId,
      vehicleType: vt,
      state: st,
      stored: { lat, lng, accuracyM: accuracyM ?? null, ts: ts ?? null },
      hbTtlSec: HB_TTL_SEC,
    });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// --- 3) Query nearby drivers (Ride calls this) ---
app.get("/drivers/nearby", async (req, res) => {
  try {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    const radiusM = Number(req.query.radiusM || 3000);
    const vehicleType = String(req.query.vehicleType || "");
    const limit = Number(req.query.limit || 20);

    assertLatLng(lat, lng);
    if (!vehicleType) throw new Error("vehicleType required");
    if (!Number.isFinite(radiusM) || radiusM <= 0) throw new Error("radiusM invalid");
    if (!Number.isFinite(limit) || limit <= 0 || limit > 200) throw new Error("limit invalid");

    // Redis GEOSEARCH with distance
    // node-redis v4: use sendCommand for GEOSEARCH
    const raw = await redis.sendCommand([
      "GEOSEARCH",
      geoKey(vehicleType),
      "FROMLONLAT",
      String(lng),
      String(lat),
      "BYRADIUS",
      String(radiusM),
      "m",
      "WITHDIST",
      "ASC",
      "COUNT",
      String(limit),
    ]);

    // raw: [ [member, dist], [member, dist], ... ]
    const pairs = (raw || []).map(([member, dist]) => ({ driverId: member, distanceM: Math.round(Number(dist)) }));

    // Filter by heartbeat + ONLINE state (cheap pipeline)
    const pipeline = redis.multi();
    for (const p of pairs) {
      pipeline.exists(hbKey(p.driverId));
      pipeline.get(stateKey(p.driverId));
    }
    const rawResults = await pipeline.exec(); // may be flat replies or [err, reply] tuples depending client/runtime
    const results = (rawResults || []).map((r) => {
      if (Array.isArray(r) && r.length === 2) return r[1];
      return r;
    });
    const drivers = [];

    for (let i = 0; i < pairs.length; i++) {
      const existsHb = Number(results[i * 2]) === 1;
      const st = results[i * 2 + 1];
      if (!existsHb) continue;
      if (st !== "ONLINE") continue; // MVP: chỉ match ONLINE (BUSY thì bỏ)
      drivers.push(pairs[i]);
    }

    res.json({ drivers });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// internal: set driver state BUSY/ONLINE quickly (ride-service calls)
app.post("/internal/drivers/:driverId/state", async (req, res) => {
  try {
    const { driverId } = req.params;
    const { state } = req.body || {};
    if (!["ONLINE", "BUSY", "OFFLINE"].includes(state)) {
      throw new Error("state must be ONLINE|BUSY|OFFLINE");
    }
    await redis.set(stateKey(driverId), state);

    res.json({ ok: true, driverId, state });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.get("/drivers/:driverId/debug", async (req, res) => {
  const { driverId } = req.params;
  const vt = await redis.get(vehicleKey(driverId));
  const st = await redis.get(stateKey(driverId));
  const hb = await redis.ttl(hbKey(driverId));
  res.json({ driverId, vehicleType: vt, state: st, hbTtlSec: hb });
});

app.listen(PORT, () => log.info("driver_service_started", { port: PORT }));
