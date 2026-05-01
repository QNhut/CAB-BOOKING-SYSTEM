import { Pool } from "pg";
import { createLogger } from "../../../shared/logger.js";

export const log  = createLogger("user-service");
const pool        = new Pool({ connectionString: process.env.DATABASE_URL });

export { pool };

export async function migrate() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_preferences (
      user_id   UUID PRIMARY KEY,
      language  VARCHAR(10) DEFAULT 'vi',
      currency  VARCHAR(10) DEFAULT 'VND',
      notifications_enabled BOOLEAN DEFAULT true,
      default_vehicle_type  VARCHAR(20) DEFAULT 'CAR_4',
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS saved_locations (
      id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      user_id    UUID NOT NULL,
      label      VARCHAR(50) NOT NULL,
      address    TEXT NOT NULL,
      lat        DOUBLE PRECISION NOT NULL,
      lng        DOUBLE PRECISION NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_saved_locations_user ON saved_locations(user_id);
  `);
  log.info("migrations applied");
}

export async function getPreferences(userId) {
  const r = await pool.query("SELECT * FROM user_preferences WHERE user_id=$1", [userId]);
  return r.rows[0] || null;
}

export async function upsertPreferences(userId, { language, currency, notifications_enabled, default_vehicle_type }) {
  const r = await pool.query(
    `INSERT INTO user_preferences (user_id, language, currency, notifications_enabled, default_vehicle_type, updated_at)
     VALUES ($1, $2, $3, $4, $5, now())
     ON CONFLICT (user_id)
     DO UPDATE SET language=COALESCE($2, user_preferences.language),
                   currency=COALESCE($3, user_preferences.currency),
                   notifications_enabled=COALESCE($4, user_preferences.notifications_enabled),
                   default_vehicle_type=COALESCE($5, user_preferences.default_vehicle_type),
                   updated_at=now()
     RETURNING *`,
    [userId, language || "vi", currency || "VND", notifications_enabled ?? true, default_vehicle_type || "CAR_4"]
  );
  return r.rows[0];
}

export async function getLocations(userId) {
  const r = await pool.query("SELECT * FROM saved_locations WHERE user_id=$1 ORDER BY created_at DESC", [userId]);
  return r.rows;
}

export async function insertLocation(userId, { label, address, lat, lng }) {
  const r = await pool.query(
    "INSERT INTO saved_locations (user_id, label, address, lat, lng) VALUES ($1,$2,$3,$4,$5) RETURNING *",
    [userId, label, address, lat, lng]
  );
  return r.rows[0];
}

export async function deleteLocation(locationId, userId) {
  const r = await pool.query("DELETE FROM saved_locations WHERE id=$1 AND user_id=$2", [locationId, userId]);
  return r.rowCount;
}
