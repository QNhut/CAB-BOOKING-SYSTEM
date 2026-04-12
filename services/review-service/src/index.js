import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import pg from "pg";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8011;
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

// ── Init DB tables ──────────────────────────────────────────────────────────
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS reviews (
      id SERIAL PRIMARY KEY,
      ride_id TEXT NOT NULL,
      reviewer_id TEXT NOT NULL,
      reviewer_role TEXT NOT NULL CHECK (reviewer_role IN ('USER', 'DRIVER')),
      reviewee_id TEXT NOT NULL,
      rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
      comment TEXT,
      tip_amount INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(ride_id, reviewer_id)
    )
  `);
  console.log("[REVIEW] Database initialized");
}

// ── POST /reviews — Submit a review ─────────────────────────────────────────
app.post("/reviews", async (req, res) => {
  try {
    const { ride_id, reviewer_id, reviewer_role, reviewee_id, rating, comment, tip_amount } = req.body || {};

    if (!ride_id || !reviewer_id || !reviewer_role || !reviewee_id) {
      return res.status(400).json({ error: "ride_id, reviewer_id, reviewer_role, reviewee_id are required" });
    }
    if (!rating || typeof rating !== "number" || rating < 1 || rating > 5) {
      return res.status(400).json({ error: "rating must be a number between 1 and 5" });
    }
    if (!["USER", "DRIVER"].includes(reviewer_role)) {
      return res.status(400).json({ error: "reviewer_role must be USER or DRIVER" });
    }

    const result = await pool.query(
      `INSERT INTO reviews (ride_id, reviewer_id, reviewer_role, reviewee_id, rating, comment, tip_amount)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (ride_id, reviewer_id) DO UPDATE SET rating = $5, comment = $6, tip_amount = $7
       RETURNING *`,
      [ride_id, reviewer_id, reviewer_role, reviewee_id, rating, comment || null, tip_amount || 0]
    );

    res.status(201).json({ review: result.rows[0] });
  } catch (e) {
    console.error("[REVIEW] Error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── GET /reviews/user/:userId — Get reviews for a user ──────────────────────
app.get("/reviews/user/:userId", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM reviews WHERE reviewee_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [req.params.userId]
    );
    const avg = rows.length > 0
      ? Math.round((rows.reduce((s, r) => s + r.rating, 0) / rows.length) * 10) / 10
      : null;
    res.json({ reviews: rows, average_rating: avg, total: rows.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /reviews/ride/:rideId — Get reviews for a specific ride ─────────────
app.get("/reviews/ride/:rideId", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM reviews WHERE ride_id = $1`,
      [req.params.rideId]
    );
    res.json({ reviews: rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /reviews/driver/:driverId/average — Get driver average rating ───────
app.get("/reviews/driver/:driverId/average", async (req, res) => {
  try {
    // Support aliases: ?aliases=d1,d_123 to match multiple IDs for the same driver
    const ids = [req.params.driverId];
    const aliasParam = req.query.aliases;
    if (aliasParam) {
      const extras = String(aliasParam).split(",").map(s => s.trim()).filter(Boolean);
      for (const e of extras) if (!ids.includes(e)) ids.push(e);
    }

    const placeholders = ids.map((_, i) => `$${i + 1}`).join(", ");
    const { rows } = await pool.query(
      `SELECT COUNT(*) as count, ROUND(AVG(rating)::numeric, 1) as average
       FROM reviews WHERE reviewee_id IN (${placeholders}) AND reviewer_role = 'USER'`,
      ids
    );
    res.json({
      driver_id: req.params.driverId,
      average_rating: rows[0].average ? parseFloat(rows[0].average) : null,
      total_reviews: parseInt(rows[0].count),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Health ──────────────────────────────────────────────────────────────────
app.get("/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true, service: "review-service" });
  } catch {
    res.status(500).json({ ok: false, service: "review-service" });
  }
});
app.get("/reviews/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true, service: "review-service" });
  } catch {
    res.status(500).json({ ok: false, service: "review-service" });
  }
});

// ── Start ───────────────────────────────────────────────────────────────────
initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`[REVIEW] Review service running on http://localhost:${PORT}`);
  });
}).catch((e) => {
  console.error("[REVIEW] Failed to init DB:", e.message);
  process.exit(1);
});