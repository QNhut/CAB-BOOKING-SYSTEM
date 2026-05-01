import jwt from "jsonwebtoken";
import { log, getPreferences, upsertPreferences, getLocations, insertLocation, deleteLocation } from "../models/user.model.js";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-in-production-please";

function getAuth(req) { return req.auth.userId || req.auth.sub; }

export function authMiddleware(req, res, next) {
  try {
    const token = (req.headers.authorization || "").replace("Bearer ", "");
    if (!token) return res.status(401).json({ error: "Missing token" });
    req.auth = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

export async function getPrefs(req, res) {
  try {
    const prefs = await getPreferences(getAuth(req));
    res.json(prefs || { user_id: getAuth(req), language: "vi", currency: "VND", notifications_enabled: true, default_vehicle_type: "CAR_4" });
  } catch (err) { log.error("get preferences failed", { error: err.message }); res.status(500).json({ error: "Internal error" }); }
}

export async function getUserById(req, res) {
  try {
    const requestedId = req.params.userId;
    const callerId    = getAuth(req);
    if (String(requestedId) !== String(callerId)) {
      return res.status(403).json({ message: "Access denied", error: "Forbidden: cannot access other user data" });
    }
    const prefs = await getPreferences(callerId);
    res.json({ user_id: callerId, ...(prefs || {}) });
  } catch (err) { res.status(500).json({ error: "Internal error" }); }
}

export async function updatePrefs(req, res) {
  try {
    const row = await upsertPreferences(getAuth(req), req.body);
    res.json(row);
  } catch (err) { log.error("update preferences failed", { error: err.message }); res.status(500).json({ error: "Internal error" }); }
}

export async function listLocations(req, res) {
  try {
    res.json({ locations: await getLocations(getAuth(req)) });
  } catch (err) { log.error("get locations failed", { error: err.message }); res.status(500).json({ error: "Internal error" }); }
}

export async function createLocation(req, res) {
  try {
    const { label, address, lat, lng } = req.body;
    if (!label || !address || lat == null || lng == null)
      return res.status(400).json({ error: "label, address, lat, lng required" });
    res.status(201).json(await insertLocation(getAuth(req), { label, address, lat, lng }));
  } catch (err) { log.error("create location failed", { error: err.message }); res.status(500).json({ error: "Internal error" }); }
}

export async function removeLocation(req, res) {
  try {
    const n = await deleteLocation(req.params.id, getAuth(req));
    if (!n) return res.status(404).json({ error: "Location not found" });
    res.json({ deleted: true });
  } catch (err) { log.error("delete location failed", { error: err.message }); res.status(500).json({ error: "Internal error" }); }
}

export function healthCheck(_req, res) { res.json({ ok: true, service: "user-service" }); }
