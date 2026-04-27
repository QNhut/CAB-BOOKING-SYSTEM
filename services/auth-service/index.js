import express from "express";
import { Pool } from "pg";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import cors from "cors";
import fs from "fs";
import path from "path";
import { createLogger } from "../../shared/logger.js";
import { createHttpMetrics } from "../../shared/http-metrics.js";

const log = createLogger("auth-service");
const { metricsMiddleware, metricsEndpoint } = createHttpMetrics("auth-service");

/**
 * ENV required:
 * - DATABASE_URL=postgres://taxi:taxi_pass@postgres:5432/auth_db
 * - JWT_SECRET=your-secret-key-change-in-production
 * - JWT_ACCESS_TTL=900 (15 minutes in seconds)
 * - JWT_REFRESH_TTL=2592000 (30 days in seconds)
 * - BCRYPT_ROUNDS=10
 * - PORT=8002
 */

const PORT = Number(process.env.PORT || 8002);
const DATABASE_URL = process.env.DATABASE_URL;
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const JWT_ACCESS_TTL = Number(process.env.JWT_ACCESS_TTL || 900); // 15 min
const JWT_REFRESH_TTL = Number(process.env.JWT_REFRESH_TTL || 2592000); // 30 days
const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS || 10);
const JWT_ISSUER = "taxi-auth-service";
const JWT_AUDIENCE = "taxi-platform";

if (!DATABASE_URL) {
  log.error("auth_database_url_missing");
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });

// Run migrations
async function runMigrations() {
  const dir = path.join(process.cwd(), "migrations");
  if (!fs.existsSync(dir)) {
    log.warn("auth_migrations_missing");
    return;
  }
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  for (const f of files) {
    try {
      const sql = fs.readFileSync(path.join(dir, f), "utf8");
      await pool.query(sql);
    } catch (err) {
      // Ignore "already exists" errors (42P07 = duplicate object)
      if (err.code !== '42P07') {
        throw err;
      }
      log.info("auth_migration_skipped", { migration: f, reason: "already_applied" });
    }
  }
  log.info("auth_migrations_applied", { migrations: files });
}

// Utilities
function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function generateRefreshToken() {
  return crypto.randomBytes(64).toString("hex");
}

function containsSuspiciousSqlInput(value) {
  if (typeof value !== "string") return false;
  return /('|%27)\s*or\s+1=1|--|;\s*drop\s+table|union\s+select/i.test(value);
}

function containsScriptTag(value) {
  if (typeof value !== "string") return false;
  return /<\s*script\b/i.test(value);
}

function signAccessToken(account, userId, driverId) {
  const payload = {
    iss: JWT_ISSUER,
    aud: JWT_AUDIENCE,
    sub: account.id,
    role: account.role,
  };

  // Use provided userId/driverId, then stored in DB, then fallback to account.id
  if (account.role === "USER") {
    payload.userId = userId || account.user_id || account.id;
  }
  if (account.role === "DRIVER") {
    payload.driverId = driverId || account.driver_id || account.id;
  }

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_ACCESS_TTL,
  });
}

async function createRefreshToken(accountId, deviceId, ip, userAgent) {
  const token = generateRefreshToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + JWT_REFRESH_TTL * 1000);

  await pool.query(
    `INSERT INTO refresh_tokens(account_id, token_hash, expires_at, device_id, ip, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [accountId, tokenHash, expiresAt, deviceId || null, ip || null, userAgent || null]
  );

  return { token, expiresAt };
}

async function logLoginAttempt(accountId, identifier, success, ip, userAgent, failureReason) {
  await pool.query(
    `INSERT INTO login_audit(account_id, identifier, success, ip, user_agent, failure_reason)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [accountId || null, identifier, success, ip || null, userAgent || null, failureReason || null]
  );
}

// Middleware to verify JWT
function authMiddleware(req, res, next) {
  try {
    // Support both header and query (for SSE)
    const authHeader = req.headers.authorization;
    const queryToken = req.query.token;

    let token = null;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.substring(7);
    } else if (queryToken) {
      token = queryToken;
    }

    if (!token) {
      return res.status(401).json({ error: "No token provided" });
    }

    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });

    req.auth = {
      accountId: decoded.sub,
      role: decoded.role,
      userId: decoded.userId || null,
      driverId: decoded.driverId || null,
    };

    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Token expired" });
    }
    return res.status(401).json({ error: "Invalid token" });
  }
}

// Express app
const app = express();
app.use(cors());
app.use(express.json());
app.use(metricsMiddleware);

// Health check
app.get("/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true, service: "auth-service" });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});
app.get("/auth/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true, service: "auth-service" });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});
app.get("/metrics", metricsEndpoint);

// POST /auth/register
app.post("/auth/register", async (req, res) => {
  const client = await pool.connect();
  try {
    const { identifier, password, role, userId, driverId } = req.body;

    // Validate
    if (!identifier || !password || !role) {
      return res.status(400).json({ error: "identifier, password, role required" });
    }

    if (containsSuspiciousSqlInput(identifier)) {
      return res.status(400).json({ error: "identifier contains invalid characters" });
    }

    if (containsScriptTag(identifier)) {
      return res.status(400).json({ error: "identifier contains unsafe markup" });
    }

    if (!["USER", "DRIVER", "ADMIN"].includes(role)) {
      return res.status(400).json({ error: "role must be USER, DRIVER, or ADMIN" });
    }

    // Password policy (minimum)
    if (password.length < 6) {
      return res.status(400).json({ error: "password must be at least 6 characters" });
    }

    await client.query("BEGIN");

    // Check existing
    const existing = await client.query(
      "SELECT id FROM accounts WHERE identifier = $1",
      [identifier]
    );
    if (existing.rowCount > 0) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "identifier already exists" });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    // Create account (with optional user_id / driver_id for consistent JWT claims)
    const result = await client.query(
      `INSERT INTO accounts(identifier, password_hash, role, status, user_id, driver_id)
       VALUES ($1, $2, $3, 'ACTIVE', $4, $5)
       RETURNING id, identifier, role, status, created_at, user_id, driver_id`,
      [identifier, passwordHash, role, userId || null, driverId || null]
    );

    const account = result.rows[0];

    await client.query("COMMIT");

    // Auto-login: issue tokens
    const accessToken = signAccessToken(account, userId, driverId);
    const refreshTokenData = await createRefreshToken(
      account.id,
      req.body.deviceId,
      req.ip,
      req.headers["user-agent"]
    );

    res.status(201).json({
      account: {
        id: account.id,
        identifier: account.identifier,
        role: account.role,
        status: account.status,
      },
      accessToken,
      refreshToken: refreshTokenData.token,
      expiresIn: JWT_ACCESS_TTL,
    });
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {}
    log.error("auth_register_error", { error: err.message });
    res.status(500).json({ error: "Internal server error" });
  } finally {
    client.release();
  }
});

// POST /auth/login
app.post("/auth/login", async (req, res) => {
  try {
    const { identifier, password, userId, driverId } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({ error: "identifier and password required" });
    }

    if (containsSuspiciousSqlInput(identifier)) {
      return res.status(400).json({ error: "identifier contains invalid characters" });
    }

    if (containsScriptTag(identifier)) {
      return res.status(400).json({ error: "identifier contains unsafe markup" });
    }

    // Get account (include stored user_id/driver_id for JWT)
    const result = await pool.query(
      "SELECT *, user_id, driver_id FROM accounts WHERE identifier = $1",
      [identifier]
    );

    if (result.rowCount === 0) {
      await logLoginAttempt(
        null,
        identifier,
        false,
        req.ip,
        req.headers["user-agent"],
        "Account not found"
      );
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const account = result.rows[0];

    // Check status
    if (account.status !== "ACTIVE") {
      await logLoginAttempt(
        account.id,
        identifier,
        false,
        req.ip,
        req.headers["user-agent"],
        "Account disabled"
      );
      return res.status(403).json({ error: "Account is disabled" });
    }

    // Verify password
    const valid = await bcrypt.compare(password, account.password_hash);
    if (!valid) {
      await logLoginAttempt(
        account.id,
        identifier,
        false,
        req.ip,
        req.headers["user-agent"],
        "Invalid password"
      );
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Success
    await logLoginAttempt(
      account.id,
      identifier,
      true,
      req.ip,
      req.headers["user-agent"],
      null
    );

    // Issue tokens
    const accessToken = signAccessToken(account, userId, driverId);
    const refreshTokenData = await createRefreshToken(
      account.id,
      req.body.deviceId,
      req.ip,
      req.headers["user-agent"]
    );

    res.json({
      account: {
        id: account.id,
        identifier: account.identifier,
        role: account.role,
        status: account.status,
      },
      accessToken,
      refreshToken: refreshTokenData.token,
      expiresIn: JWT_ACCESS_TTL,
    });
  } catch (err) {
    log.error("auth_login_error", { error: err.message });
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /auth/refresh
app.post("/auth/refresh", async (req, res) => {
  const client = await pool.connect();
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: "refreshToken required" });
    }

    const tokenHash = hashToken(refreshToken);

    await client.query("BEGIN");

    // Check token
    const tokenResult = await client.query(
      `SELECT rt.*, a.id as account_id, a.identifier, a.role, a.status, a.user_id, a.driver_id
       FROM refresh_tokens rt
       JOIN accounts a ON rt.account_id = a.id
       WHERE rt.token_hash = $1
       FOR UPDATE`,
      [tokenHash]
    );

    if (tokenResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(401).json({ error: "Invalid refresh token" });
    }

    const tokenRecord = tokenResult.rows[0];

    // Check revoked
    if (tokenRecord.revoked_at) {
      await client.query("ROLLBACK");
      return res.status(401).json({ error: "Token revoked" });
    }

    // Check expired
    if (new Date(tokenRecord.expires_at) < new Date()) {
      await client.query("ROLLBACK");
      return res.status(401).json({ error: "Token expired" });
    }

    // Check account status
    if (tokenRecord.status !== "ACTIVE") {
      await client.query("ROLLBACK");
      return res.status(403).json({ error: "Account disabled" });
    }

    // Rotate: revoke old token
    await client.query(
      "UPDATE refresh_tokens SET revoked_at = now() WHERE id = $1",
      [tokenRecord.id]
    );

    // Create new refresh token
    const newRefreshToken = generateRefreshToken();
    const newTokenHash = hashToken(newRefreshToken);
    const expiresAt = new Date(Date.now() + JWT_REFRESH_TTL * 1000);

    await client.query(
      `INSERT INTO refresh_tokens(account_id, token_hash, expires_at, device_id, ip, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        tokenRecord.account_id,
        newTokenHash,
        expiresAt,
        tokenRecord.device_id,
        req.ip,
        req.headers["user-agent"],
      ]
    );

    await client.query("COMMIT");

    // Issue new access token – use stored user_id/driver_id from joined accounts row
    const account = {
      id: tokenRecord.account_id,
      role: tokenRecord.role,
      user_id: tokenRecord.user_id || null,
      driver_id: tokenRecord.driver_id || null,
    };
    const accessToken = signAccessToken(account, req.body.userId, req.body.driverId);

    res.json({
      accessToken,
      refreshToken: newRefreshToken,
      expiresIn: JWT_ACCESS_TTL,
    });
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {}
    log.error("auth_refresh_error", { error: err.message });
    res.status(500).json({ error: "Internal server error" });
  } finally {
    client.release();
  }
});

// POST /auth/logout
app.post("/auth/logout", async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: "refreshToken required" });
    }

    const tokenHash = hashToken(refreshToken);

    await pool.query(
      "UPDATE refresh_tokens SET revoked_at = now() WHERE token_hash = $1",
      [tokenHash]
    );

    res.json({ ok: true, message: "Logged out successfully" });
  } catch (err) {
    log.error("auth_logout_error", { error: err.message });
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /auth/me (protected)
app.get("/auth/me", authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, identifier, role, status, created_at FROM accounts WHERE id = $1",
      [req.auth.accountId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Account not found" });
    }

    const account = result.rows[0];

    res.json({
      account: {
        id: account.id,
        identifier: account.identifier,
        role: account.role,
        status: account.status,
        createdAt: account.created_at,
      },
      auth: {
        userId: req.auth.userId,
        driverId: req.auth.driverId,
      },
    });
  } catch (err) {
    log.error("auth_me_error", { error: err.message });
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /auth/profile — returns the profile for the current account
app.get("/auth/profile", authMiddleware, async (req, res) => {
  try {
    const { accountId, role } = req.auth;

    if (role === "USER") {
      const r = await pool.query(
        "SELECT full_name, phone, updated_at FROM user_profiles WHERE account_id = $1",
        [accountId]
      );
      return res.json({ role, profile: r.rows[0] || null });
    }

    if (role === "DRIVER") {
      const r = await pool.query(
        "SELECT full_name, phone, vehicle_type, license_plate, driver_license, updated_at FROM driver_profiles WHERE account_id = $1",
        [accountId]
      );
      return res.json({ role, profile: r.rows[0] || null });
    }

    return res.json({ role, profile: null });
  } catch (err) {
    log.error("auth_profile_get_error", { error: err.message });
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /auth/profile — upsert profile for the current account
app.put("/auth/profile", authMiddleware, async (req, res) => {
  try {
    const { accountId, role } = req.auth;
    const { fullName, phone, vehicleType, licensePlate, driverLicense } = req.body || {};

    if (role === "USER") {
      await pool.query(
        `INSERT INTO user_profiles(account_id, full_name, phone, updated_at)
         VALUES ($1, $2, $3, now())
         ON CONFLICT (account_id) DO UPDATE
           SET full_name  = EXCLUDED.full_name,
               phone      = EXCLUDED.phone,
               updated_at = now()`,
        [accountId, fullName || null, phone || null]
      );
      const r = await pool.query(
        "SELECT full_name, phone, updated_at FROM user_profiles WHERE account_id = $1",
        [accountId]
      );
      return res.json({ ok: true, profile: r.rows[0] });
    }

    if (role === "DRIVER") {
      if (vehicleType && !["CAR_4", "CAR_7"].includes(vehicleType)) {
        return res.status(400).json({ error: "vehicleType must be CAR_4 or CAR_7" });
      }
      await pool.query(
        `INSERT INTO driver_profiles(account_id, full_name, phone, vehicle_type, license_plate, driver_license, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, now())
         ON CONFLICT (account_id) DO UPDATE
           SET full_name      = EXCLUDED.full_name,
               phone          = EXCLUDED.phone,
               vehicle_type   = COALESCE(EXCLUDED.vehicle_type,   driver_profiles.vehicle_type),
               license_plate  = COALESCE(EXCLUDED.license_plate,  driver_profiles.license_plate),
               driver_license = COALESCE(EXCLUDED.driver_license, driver_profiles.driver_license),
               updated_at     = now()`,
        [accountId, fullName || null, phone || null,
         vehicleType || null, licensePlate || null, driverLicense || null]
      );
      const r = await pool.query(
        "SELECT full_name, phone, vehicle_type, license_plate, driver_license, updated_at FROM driver_profiles WHERE account_id = $1",
        [accountId]
      );
      return res.json({ ok: true, profile: r.rows[0] });
    }

    return res.status(400).json({ error: "Unsupported role" });
  } catch (err) {
    log.error("auth_profile_put_error", { error: err.message });
    res.status(500).json({ error: "Internal server error" });
  }
});

// Internal endpoint: look up a user profile by accountId (used by ride-service, booking-service, etc.)
app.get("/internal/profile/user/:accountId", async (req, res) => {
  try {
    const { accountId } = req.params;
    const r = await pool.query(
      "SELECT full_name, phone FROM user_profiles WHERE account_id = $1",
      [accountId]
    );
    res.json(r.rows[0] || null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Internal endpoint: look up a driver profile by accountId
app.get("/internal/profile/driver/:accountId", async (req, res) => {
  try {
    const { accountId } = req.params;
    const r = await pool.query(
      "SELECT full_name, phone, vehicle_type, license_plate, driver_license FROM driver_profiles WHERE account_id = $1",
      [accountId]
    );
    res.json(r.rows[0] || null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Internal endpoint: verify token (optional, services can verify themselves)
app.post("/internal/verify", async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: "token required" });
    }

    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });

    res.json({
      valid: true,
      accountId: decoded.sub,
      role: decoded.role,
      userId: decoded.userId || null,
      driverId: decoded.driverId || null,
    });
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.json({ valid: false, error: "Token expired" });
    }
    return res.json({ valid: false, error: "Invalid token" });
  }
});

// ── Admin Endpoints ─────────────────────────────────────────────────────────
function adminAuth(req, res, next) {
  try {
    const authHeader = req.header("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing token" });
    }
    const decoded = jwt.verify(authHeader.substring(7), JWT_SECRET);
    if (decoded.role !== "ADMIN") {
      return res.status(403).json({ error: "Access denied" });
    }
    req.auth = decoded;
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") return res.status(401).json({ error: "Token expired" });
    return res.status(401).json({ error: "Invalid token" });
  }
}

// GET /auth/admin/users — list all users (admin only)
app.get("/auth/admin/users", adminAuth, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT a.id, a.identifier, a.role, a.created_at, a.status, a.driver_id,
              COALESCE(up.full_name, dp.full_name) AS full_name,
              COALESCE(up.phone, dp.phone) AS phone
       FROM accounts a
       LEFT JOIN user_profiles   up ON up.account_id = a.id
       LEFT JOIN driver_profiles dp ON dp.account_id = a.id
       ORDER BY a.created_at DESC LIMIT 200`
    );
    res.json({ users: r.rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /auth/admin/users/:userId — update user (admin only)
app.put("/auth/admin/users/:userId", adminAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    const { full_name, phone, status } = req.body;

    const updates = [];
    const params = [];
    let paramIdx = 1;

    if (status !== undefined) {
      updates.push(`status = $${paramIdx++}`);
      params.push(status);
    }

    if (full_name !== undefined || phone !== undefined) {
      // Get account to find if user or driver profile
      const accountRes = await pool.query("SELECT role FROM accounts WHERE id = $1", [userId]);
      if (!accountRes.rowCount) return res.status(404).json({ error: "User not found" });

      const role = accountRes.rows[0].role;
      const profileTable = role === "DRIVER" ? "driver_profiles" : "user_profiles";

      if (full_name !== undefined) {
        await pool.query(
          `INSERT INTO ${profileTable}(account_id, full_name) VALUES ($1, $2)
           ON CONFLICT (account_id) DO UPDATE SET full_name = $2`,
          [userId, full_name]
        );
      }
      if (phone !== undefined) {
        await pool.query(
          `INSERT INTO ${profileTable}(account_id, phone) VALUES ($1, $2)
           ON CONFLICT (account_id) DO UPDATE SET phone = $2`,
          [userId, phone]
        );
      }
    }

    if (updates.length > 0) {
      params.push(userId);
      const query = `UPDATE accounts SET ${updates.join(", ")} WHERE id = $${paramIdx} RETURNING *`;
      const result = await pool.query(query, params);
      return res.json({ account: result.rows[0] });
    }

    res.json({ message: "Updated" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /auth/admin/users/:userId — delete user (admin only)
app.delete("/auth/admin/users/:userId", adminAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const { userId } = req.params;

    // Prevent deleting self
    if (userId === req.auth.sub) {
      return res.status(400).json({ error: "Cannot delete your own account" });
    }

    await client.query("BEGIN");

    // Delete account and cascade
    const result = await client.query("DELETE FROM accounts WHERE id = $1 RETURNING id", [userId]);

    if (result.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "User not found" });
    }

    await client.query("COMMIT");
    res.json({ message: "User deleted", id: userId });
  } catch (e) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

// Main
async function main() {
  await runMigrations();

  // ── Seed default ADMIN account if none exists ──
  try {
    const { rows } = await pool.query(`SELECT id FROM accounts WHERE identifier = 'admin@taxi.com' LIMIT 1`);
    if (rows.length === 0) {
      const hash = await bcrypt.hash("admin123", BCRYPT_ROUNDS);
      await pool.query(
        `INSERT INTO accounts (identifier, password_hash, role, status)
         VALUES ('admin@taxi.com', $1, 'ADMIN', 'ACTIVE')
         ON CONFLICT (identifier) DO NOTHING`,
        [hash]
      );
      log.info("auth_default_admin_seeded", { identifier: "admin@taxi.com" });
    }
  } catch (e) {
    log.warn("auth_default_admin_seed_failed", { error: e.message });
  }

  app.listen(PORT, () => {
    log.info("auth_service_started", {
      port: PORT,
      jwt_access_ttl_seconds: JWT_ACCESS_TTL,
      jwt_refresh_ttl_seconds: JWT_REFRESH_TTL,
    });
  });
}

main().catch((err) => {
  log.error("auth_service_fatal", { error: err.message, stack: err.stack });
  process.exit(1);
});

export { authMiddleware };
