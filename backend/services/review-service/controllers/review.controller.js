import jwt from "jsonwebtoken";
import { log, insertReview, getDriverReviews, getDriverStats, getReviewByBooking } from "../models/review.model.js";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-in-production-please";

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

export function healthCheck(_req, res) { res.json({ ok: true, service: "review-service" }); }

export async function createReview(req, res) {
  try {
    const userId = req.auth.userId || req.auth.sub;
    const { booking_id, driver_id, rating, comment } = req.body;
    if (!booking_id || !driver_id || !rating)
      return res.status(400).json({ error: "booking_id, driver_id, rating required" });
    if (rating < 1 || rating > 5)
      return res.status(422).json({ error: "rating must be between 1 and 5" });
    const row = await insertReview(booking_id, userId, driver_id, rating, comment);
    res.status(201).json(row);
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ error: "Review already exists for this booking" });
    log.error("create review failed", { error: err.message });
    res.status(500).json({ error: "Internal error" });
  }
}

export async function listDriverReviews(req, res) {
  try {
    const rows = await getDriverReviews(req.params.driverId);
    res.json({ reviews: rows });
  } catch (err) {
    log.error("list driver reviews failed", { error: err.message });
    res.status(500).json({ error: "Internal error" });
  }
}

export async function driverStats(req, res) {
  try {
    res.json(await getDriverStats(req.params.driverId));
  } catch (err) {
    log.error("driver stats failed", { error: err.message });
    res.status(500).json({ error: "Internal error" });
  }
}

export async function bookingReview(req, res) {
  try {
    const row = await getReviewByBooking(req.params.bookingId);
    if (!row) return res.status(404).json({ error: "Review not found" });
    res.json(row);
  } catch (err) {
    log.error("get booking review failed", { error: err.message });
    res.status(500).json({ error: "Internal error" });
  }
}
