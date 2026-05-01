import { Pool } from "pg";

// Minimal logger fallback (review-service may not have shared/ path in its node_modules context)
let createLoggerFn;
try {
  const mod = await import("../../../shared/logger.js");
  createLoggerFn = mod.createLogger;
} catch {
  createLoggerFn = (name) => ({
    info: (msg, meta) => console.log(JSON.stringify({ level: "info",  service: name, msg, ...meta })),
    warn: (msg, meta) => console.warn(JSON.stringify({ level: "warn",  service: name, msg, ...meta })),
    error:(msg, meta) => console.error(JSON.stringify({ level: "error", service: name, msg, ...meta })),
  });
}
export const log  = createLoggerFn("review-service");
export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function migrate() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS reviews (
      id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      booking_id  UUID NOT NULL UNIQUE,
      user_id     UUID NOT NULL,
      driver_id   UUID NOT NULL,
      rating      SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
      comment     TEXT,
      created_at  TIMESTAMPTZ DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_reviews_driver ON reviews(driver_id);
    CREATE INDEX IF NOT EXISTS idx_reviews_user   ON reviews(user_id);
  `);
  log.info("migrations applied");
}

export async function insertReview(bookingId, userId, driverId, rating, comment) {
  const r = await pool.query(
    `INSERT INTO reviews (booking_id, user_id, driver_id, rating, comment)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [bookingId, userId, driverId, rating, comment || null]
  );
  return r.rows[0];
}

export async function getDriverReviews(driverId) {
  const r = await pool.query(
    "SELECT * FROM reviews WHERE driver_id=$1 ORDER BY created_at DESC",
    [driverId]
  );
  return r.rows;
}

export async function getDriverStats(driverId) {
  const r = await pool.query(
    "SELECT COUNT(*) AS total, ROUND(AVG(rating),2) AS avg_rating FROM reviews WHERE driver_id=$1",
    [driverId]
  );
  return r.rows[0];
}

export async function getReviewByBooking(bookingId) {
  const r = await pool.query("SELECT * FROM reviews WHERE booking_id=$1", [bookingId]);
  return r.rows[0] || null;
}
