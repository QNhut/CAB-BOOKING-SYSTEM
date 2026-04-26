import express from "express";
import cors from "cors";
import { Pool } from "pg";
import jwt from "jsonwebtoken";
import { createLogger } from "../../../shared/logger.js";
import { createHttpMetrics } from "../../../shared/http-metrics.js";

const log = createLogger("user-service");
const { metricsMiddleware, metricsEndpoint } = createHttpMetrics("user-service");

const app = express();
app.use(cors());
app.use(express.json());
app.use(metricsMiddleware);

const PORT = Number(process.env.PORT || 8013);
const DATABASE_URL = process.env.DATABASE_URL;
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-in-production-please";

if (!DATABASE_URL) {
  log.error("DATABASE_URL missing");
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });

// ── Run migrations ──────────────────────────────────────────────────────────
async function migrate() {
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

// ── Auth middleware ─────────────────────────────────────────────────────────
function authMiddleware(req, res, next) {
  try {
    const token = (req.headers.authorization || "").replace("Bearer ", "");
    if (!token) return res.status(401).json({ error: "Missing token" });
    const decoded = jwt.verify(token, JWT_SECRET);
    req.auth = decoded;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  PREFERENCES
// ═══════════════════════════════════════════════════════════════════════════

// GET /users/preferences
app.get("/users/preferences", authMiddleware, async (req, res) => {
  try {
    const userId = req.auth.userId || req.auth.sub;
    const r = await pool.query("SELECT * FROM user_preferences WHERE user_id=$1", [userId]);
    if (r.rowCount === 0) {
      // Return defaults
      return res.json({ user_id: userId, language: "vi", currency: "VND", notifications_enabled: true, default_vehicle_type: "CAR_4" });
    }
    res.json(r.rows[0]);
  } catch (err) {
    log.error("get preferences failed", { error: err.message });
    res.status(500).json({ error: "Internal error" });
  }
});

// PUT /users/preferences
app.put("/users/preferences", authMiddleware, async (req, res) => {
  try {
    const userId = req.auth.userId || req.auth.sub;
    const { language, currency, notifications_enabled, default_vehicle_type } = req.body;

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
    res.json(r.rows[0]);
  } catch (err) {
    log.error("update preferences failed", { error: err.message });
    res.status(500).json({ error: "Internal error" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
//  SAVED LOCATIONS
// ═══════════════════════════════════════════════════════════════════════════

// GET /users/locations
app.get("/users/locations", authMiddleware, async (req, res) => {
  try {
    const userId = req.auth.userId || req.auth.sub;
    const r = await pool.query("SELECT * FROM saved_locations WHERE user_id=$1 ORDER BY created_at DESC", [userId]);
    res.json({ locations: r.rows });
  } catch (err) {
    log.error("get locations failed", { error: err.message });
    res.status(500).json({ error: "Internal error" });
  }
});

// POST /users/locations
app.post("/users/locations", authMiddleware, async (req, res) => {
  try {
    const userId = req.auth.userId || req.auth.sub;
    const { label, address, lat, lng } = req.body;
    if (!label || !address || lat == null || lng == null) {
      return res.status(400).json({ error: "label, address, lat, lng required" });
    }
    const r = await pool.query(
      "INSERT INTO saved_locations (user_id, label, address, lat, lng) VALUES ($1,$2,$3,$4,$5) RETURNING *",
      [userId, label, address, lat, lng]
    );
    res.status(201).json(r.rows[0]);
  } catch (err) {
    log.error("create location failed", { error: err.message });
    res.status(500).json({ error: "Internal error" });
  }
});

// DELETE /users/locations/:id
app.delete("/users/locations/:id", authMiddleware, async (req, res) => {
  try {
    const userId = req.auth.userId || req.auth.sub;
    const r = await pool.query("DELETE FROM saved_locations WHERE id=$1 AND user_id=$2", [req.params.id, userId]);
    if (r.rowCount === 0) return res.status(404).json({ error: "Location not found" });
    res.json({ deleted: true });
  } catch (err) {
    log.error("delete location failed", { error: err.message });
    res.status(500).json({ error: "Internal error" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
//  HEALTH & METRICS
// ═══════════════════════════════════════════════════════════════════════════

app.get("/health", (_req, res) => res.json({ ok: true, service: "user-service" }));
app.get("/users/health", (_req, res) => res.json({ ok: true, service: "user-service" }));

app.get("/metrics", metricsEndpoint);

// ── Start ───────────────────────────────────────────────────────────────────
migrate()
  .then(() => {
    app.listen(PORT, () => log.info("started", { port: PORT }));
  })
  .catch((err) => {
    log.error("migration failed", { error: err.message });
    process.exit(1);
  });
