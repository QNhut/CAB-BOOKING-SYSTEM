import { redis, hbKey, stateKey, vehicleKey, geoKey, HB_TTL_SEC, STATE_TTL_SEC } from "../config/redis.js";
import { authMiddleware, getDriverId } from "../middlewares/auth.middleware.js";

function assertLatLng(lat, lng) {
  if (typeof lat !== "number" || typeof lng !== "number") throw new Error("lat/lng must be numbers");
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) throw new Error("lat/lng out of range");
}

// ── Health ────────────────────────────────────────────────────────────────────
export async function healthCheck(req, res) {
  try {
    await redis.ping();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
}

// ── Get current driver info ────────────────────────────────────────────────────
export async function getMe(req, res) {
  try {
    const driverId = getDriverId(req);
    const [status, vehicleType, hb] = await Promise.all([
      redis.get(stateKey(driverId)),
      redis.get(vehicleKey(driverId)),
      redis.get(hbKey(driverId)),
    ]);

    let location = null;
    if (vehicleType && (status === "ONLINE" || status === "BUSY")) {
      try {
        const geoPos = await redis.geoPos(geoKey(vehicleType), driverId);
        if (geoPos?.[0]) {
          location = { lng: Number(geoPos[0].longitude), lat: Number(geoPos[0].latitude) };
        }
      } catch {}
    }

    res.json({
      driverId, status: status || "OFFLINE", vehicleType: vehicleType || null,
      location, isActive: !!hb, ttlSec: STATE_TTL_SEC,
    });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
}

// ── Set status ────────────────────────────────────────────────────────────────
export async function setStatus(req, res) {
  try {
    const driverId = getDriverId(req);
    const { status, vehicleType, lat, lng } = req.body || {};

    if (!["ONLINE", "OFFLINE", "BUSY"].includes(status))
      throw new Error("status must be ONLINE|OFFLINE|BUSY");

    if (vehicleType) await redis.set(vehicleKey(driverId), vehicleType);
    const vt = await redis.get(vehicleKey(driverId));

    if (!vt && status !== "OFFLINE")
      throw new Error("vehicleType missing: set it once via body {vehicleType:'CAR_4'}");

    if (status === "OFFLINE") {
      const candidates = vt ? [vt] : ["CAR_4", "CAR_7"];
      for (const v of candidates) await redis.sendCommand(["ZREM", geoKey(v), driverId]);
      await redis.set(stateKey(driverId), "OFFLINE");
      await redis.del(hbKey(driverId));
      return res.json({ driverId, status: "OFFLINE" });
    }

    if (typeof lat === "number" && typeof lng === "number") {
      try {
        assertLatLng(lat, lng);
        await redis.geoAdd(geoKey(vt), { longitude: lng, latitude: lat, member: driverId });
      } catch {}
    }

    await redis.set(stateKey(driverId), status, { EX: STATE_TTL_SEC });
    await redis.set(hbKey(driverId), "1", { EX: HB_TTL_SEC });
    res.json({ driverId, status, vehicleType: vt, ttlSec: STATE_TTL_SEC });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
}

// ── Set driver status by ID (PUT /drivers/:driverId/status) ────────────────────
export async function setDriverStatusById(req, res) {
  try {
    const driverId = req.params.driverId;
    const { status, vehicleType } = req.body || {};
    if (!driverId) return res.status(400).json({ error: "driverId required" });
    if (!status || !["ONLINE","OFFLINE","BUSY"].includes(status))
      return res.status(400).json({ error: "status must be ONLINE|OFFLINE|BUSY" });

    if (vehicleType) await redis.set(vehicleKey(driverId), vehicleType);
    const vt = await redis.get(vehicleKey(driverId));

    if (status === "OFFLINE") {
      const candidates = vt ? [vt] : ["CAR_4","CAR_7"];
      for (const v of candidates) await redis.sendCommand(["ZREM", geoKey(v), driverId]);
      await redis.set(stateKey(driverId), "OFFLINE");
      await redis.del(hbKey(driverId));
      return res.json({ driver_id: driverId, status: "OFFLINE" });
    }

    await redis.set(stateKey(driverId), status, { EX: STATE_TTL_SEC });
    await redis.set(hbKey(driverId), "1", { EX: HB_TTL_SEC });
    res.json({ driver_id: driverId, status, vehicleType: vt || vehicleType });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
}

// ── Update location ────────────────────────────────────────────────────────────
export async function updateLocation(req, res) {
  try {
    const driverId = getDriverId(req);
    const { lat, lng, accuracyM, ts } = req.body || {};
    assertLatLng(lat, lng);

    const st = await redis.get(stateKey(driverId));
    if (!st || st === "OFFLINE") throw new Error("driver is OFFLINE (set status ONLINE first)");

    const vt = await redis.get(vehicleKey(driverId));
    if (!vt) throw new Error("vehicleType missing");

    await redis.geoAdd(geoKey(vt), { longitude: lng, latitude: lat, member: driverId });
    await redis.set(hbKey(driverId), "1", { EX: HB_TTL_SEC });

    res.json({
      ok: true, driverId, vehicleType: vt, state: st,
      stored: { lat, lng, accuracyM: accuracyM ?? null, ts: ts ?? null },
      hbTtlSec: HB_TTL_SEC,
    });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
}

// ── Nearby drivers ────────────────────────────────────────────────────────────
export async function getNearbyDrivers(req, res) {
  try {
    const lat         = Number(req.query.lat);
    const lng         = Number(req.query.lng);
    const radiusM     = Number(req.query.radiusM || 3000);
    const vehicleType = String(req.query.vehicleType || "");
    const limit       = Number(req.query.limit || 20);

    assertLatLng(lat, lng);
    if (!vehicleType) throw new Error("vehicleType required");
    if (!Number.isFinite(radiusM) || radiusM <= 0) throw new Error("radiusM invalid");
    if (!Number.isFinite(limit) || limit <= 0 || limit > 200) throw new Error("limit invalid");

    const raw = await redis.sendCommand([
      "GEOSEARCH", geoKey(vehicleType), "FROMLONLAT", String(lng), String(lat),
      "BYRADIUS", String(radiusM), "m", "WITHDIST", "ASC", "COUNT", String(limit),
    ]);

    const pairs = (raw || []).map(([member, dist]) => ({ driverId: member, distanceM: Math.round(Number(dist)) }));

    const pipeline = redis.multi();
    for (const p of pairs) {
      pipeline.exists(hbKey(p.driverId));
      pipeline.get(stateKey(p.driverId));
    }
    const rawResults = await pipeline.exec();
    const results = (rawResults || []).map((r) => (Array.isArray(r) && r.length === 2 ? r[1] : r));

    const drivers = [];
    for (let i = 0; i < pairs.length; i++) {
      if (Number(results[i * 2]) !== 1) continue;
      if (results[i * 2 + 1] !== "ONLINE") continue;
      drivers.push(pairs[i]);
    }

    res.json({ drivers });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
}

// ── Internal state update ─────────────────────────────────────────────────────
export async function internalSetState(req, res) {
  try {
    const { driverId } = req.params;
    const { state }    = req.body || {};
    if (!["ONLINE", "BUSY", "OFFLINE"].includes(state)) throw new Error("state must be ONLINE|BUSY|OFFLINE");
    await redis.set(stateKey(driverId), state);
    res.json({ ok: true, driverId, state });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
}

// ── Debug ─────────────────────────────────────────────────────────────────────
export async function debugDriver(req, res) {
  const { driverId } = req.params;
  const vt  = await redis.get(vehicleKey(driverId));
  const st  = await redis.get(stateKey(driverId));
  const hb  = await redis.ttl(hbKey(driverId));
  res.json({ driverId, vehicleType: vt, state: st, hbTtlSec: hb });
}

export { authMiddleware };
