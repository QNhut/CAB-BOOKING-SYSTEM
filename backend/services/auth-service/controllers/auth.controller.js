import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { pool } from "../config/database.js";
import {
  checkIdentifierExists, createAccount, findAccountByIdentifier,
  getAccountById, findRefreshToken, revokeRefreshTokenById,
  revokeRefreshTokenByHash, insertRefreshToken, logLoginAttempt,
  getUserProfile, getDriverProfile, upsertUserProfile, upsertDriverProfile,
  getUserProfileInternal, getDriverProfileInternal,
  listAccounts, getAccountRole, updateAccountField, updateAccountStatus, deleteAccount,
  updateAccountCredentials,
} from "../models/auth.model.js";
import {
  hashToken, generateRefreshToken, signAccessToken, createRefreshToken, JWT_ACCESS_TTL,
} from "../services/auth.service.js";

const BCRYPT_ROUNDS  = Number(process.env.BCRYPT_ROUNDS  || 10);
const JWT_SECRET     = process.env.JWT_SECRET     || "dev-secret-change-me";
const JWT_REFRESH_TTL = Number(process.env.JWT_REFRESH_TTL || 2592000);
const JWT_ISSUER     = "taxi-auth-service";
const JWT_AUDIENCE   = "taxi-platform";

// ── Health ──────────────────────────────────────────────────────────────────
export async function healthCheck(req, res) {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true, service: "auth-service" });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

// ── Register ─────────────────────────────────────────────────────────────────
export async function register(req, res) {
  const client = await pool.connect();
  try {
    // Accept both {identifier, role} and simplified {email, name} (role defaults to USER)
    let { identifier, password, role, userId, driverId, email, name } = req.body;
    if (!identifier && email) identifier = email;
    if (!role) role = "USER";

    if (!identifier || !password || !role) {
      return res.status(400).json({ error: "identifier, password, role required" });
    }
    if (!["USER", "DRIVER", "ADMIN"].includes(role)) {
      return res.status(400).json({ error: "role must be USER, DRIVER, or ADMIN" });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "password must be at least 6 characters" });
    }

    await client.query("BEGIN");

    const existing = await checkIdentifierExists(identifier, client);
    if (existing.rowCount > 0) {
      // Idempotent registration: if same password matches, return existing user token
      const existingAccount = existing.rows[0];
      const passwordMatch = await bcrypt.compare(password, existingAccount.password_hash);
      if (passwordMatch) {
        await client.query("ROLLBACK");
        const accessToken = signAccessToken(existingAccount, userId, driverId);
        const refreshTokenData = await createRefreshToken(existingAccount.id, req.body.deviceId, req.ip, req.headers["user-agent"]);
        return res.status(201).json({
          user_id: existingAccount.id,
          account: { id: existingAccount.id, identifier: existingAccount.identifier, role: existingAccount.role, status: existingAccount.status },
          access_token: accessToken,
          accessToken,
          refreshToken: refreshTokenData.token,
          expiresIn: JWT_ACCESS_TTL,
        });
      }
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "identifier already exists" });
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const result = await createAccount(client, identifier, passwordHash, role, userId, driverId);
    const account = result.rows[0];

    await client.query("COMMIT");

    const accessToken      = signAccessToken(account, userId, driverId);
    const refreshTokenData = await createRefreshToken(account.id, req.body.deviceId, req.ip, req.headers["user-agent"]);

    res.status(201).json({
      user_id: account.id,
      account: { id: account.id, identifier: account.identifier, role: account.role, status: account.status },
      access_token: accessToken,
      accessToken,
      refreshToken: refreshTokenData.token,
      expiresIn: JWT_ACCESS_TTL,
    });
  } catch (err) {
    try { await client.query("ROLLBACK"); } catch {}
    console.error("[AUTH] register error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    client.release();
  }
}

// ── Login ─────────────────────────────────────────────────────────────────────
export async function login(req, res) {
  try {
    let { identifier, password, userId, driverId, email } = req.body;
    if (!identifier && email) identifier = email;

    if (!identifier || !password) {
      return res.status(400).json({ error: "identifier and password required" });
    }

    const result = await findAccountByIdentifier(identifier);
    if (result.rowCount === 0) {
      await logLoginAttempt(null, identifier, false, req.ip, req.headers["user-agent"], "Account not found");
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const account = result.rows[0];

    if (account.status !== "ACTIVE") {
      await logLoginAttempt(account.id, identifier, false, req.ip, req.headers["user-agent"], "Account disabled");
      return res.status(403).json({ error: "Account is disabled" });
    }

    const valid = await bcrypt.compare(password, account.password_hash);
    if (!valid) {
      await logLoginAttempt(account.id, identifier, false, req.ip, req.headers["user-agent"], "Invalid password");
      return res.status(401).json({ error: "Invalid credentials" });
    }

    await logLoginAttempt(account.id, identifier, true, req.ip, req.headers["user-agent"], null);

    const accessToken      = signAccessToken(account, userId, driverId);
    const refreshTokenData = await createRefreshToken(account.id, req.body.deviceId, req.ip, req.headers["user-agent"]);

    res.json({
      account: { id: account.id, identifier: account.identifier, role: account.role, status: account.status },
      access_token: accessToken,
      accessToken,
      refreshToken: refreshTokenData.token,
      expiresIn: JWT_ACCESS_TTL,
    });
  } catch (err) {
    console.error("[AUTH] login error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
}

// ── Refresh ───────────────────────────────────────────────────────────────────
export async function refresh(req, res) {
  const client = await pool.connect();
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ error: "refreshToken required" });

    const tokenHash = hashToken(refreshToken);

    await client.query("BEGIN");

    const tokenResult = await findRefreshToken(client, tokenHash);
    if (tokenResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(401).json({ error: "Invalid refresh token" });
    }

    const tokenRecord = tokenResult.rows[0];

    if (tokenRecord.revoked_at) {
      await client.query("ROLLBACK");
      return res.status(401).json({ error: "Token revoked" });
    }
    if (new Date(tokenRecord.expires_at) < new Date()) {
      await client.query("ROLLBACK");
      return res.status(401).json({ error: "Token expired" });
    }
    if (tokenRecord.status !== "ACTIVE") {
      await client.query("ROLLBACK");
      return res.status(403).json({ error: "Account disabled" });
    }

    await revokeRefreshTokenById(client, tokenRecord.id);

    const newRefreshToken = generateRefreshToken();
    const newTokenHash    = hashToken(newRefreshToken);
    const expiresAt       = new Date(Date.now() + JWT_REFRESH_TTL * 1000);

    await insertRefreshToken(client, tokenRecord.account_id, newTokenHash, expiresAt, tokenRecord.device_id, req.ip, req.headers["user-agent"]);

    await client.query("COMMIT");

    const account    = { id: tokenRecord.account_id, role: tokenRecord.role, user_id: tokenRecord.user_id || null, driver_id: tokenRecord.driver_id || null };
    const accessToken = signAccessToken(account, req.body.userId, req.body.driverId);

    res.json({ accessToken, refreshToken: newRefreshToken, expiresIn: JWT_ACCESS_TTL });
  } catch (err) {
    try { await client.query("ROLLBACK"); } catch {}
    console.error("[AUTH] refresh error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    client.release();
  }
}

// ── Logout ────────────────────────────────────────────────────────────────────
export async function logout(req, res) {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await revokeRefreshTokenByHash(hashToken(refreshToken));
    }
    res.json({ ok: true, message: "logged out successfully" });
  } catch (err) {
    console.error("[AUTH] logout error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
}

// ── Me ────────────────────────────────────────────────────────────────────────
export async function getMe(req, res) {
  try {
    const result = await getAccountById(req.auth.accountId);
    if (result.rowCount === 0) return res.status(404).json({ error: "Account not found" });

    const account = result.rows[0];
    res.json({
      account: { id: account.id, identifier: account.identifier, role: account.role, status: account.status, createdAt: account.created_at },
      auth: { userId: req.auth.userId, driverId: req.auth.driverId },
    });
  } catch (err) {
    console.error("[AUTH] me error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
}

// ── Profile GET ───────────────────────────────────────────────────────────────
export async function getProfile(req, res) {
  try {
    const { accountId, role } = req.auth;

    if (role === "USER") {
      const r = await getUserProfile(accountId);
      return res.json({ role, profile: r.rows[0] || null });
    }
    if (role === "DRIVER") {
      const r = await getDriverProfile(accountId);
      return res.json({ role, profile: r.rows[0] || null });
    }
    return res.json({ role, profile: null });
  } catch (err) {
    console.error("[AUTH] profile GET error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
}

// ── Profile PUT ───────────────────────────────────────────────────────────────
export async function updateProfile(req, res) {
  try {
    const { accountId, role } = req.auth;
    const { fullName, phone, vehicleType, licensePlate, driverLicense } = req.body || {};

    if (role === "USER") {
      const r = await upsertUserProfile(accountId, fullName, phone);
      return res.json({ ok: true, profile: r.rows[0] });
    }
    if (role === "DRIVER") {
      if (vehicleType && !["CAR_4", "CAR_7"].includes(vehicleType)) {
        return res.status(400).json({ error: "vehicleType must be CAR_4 or CAR_7" });
      }
      const r = await upsertDriverProfile(accountId, fullName, phone, vehicleType, licensePlate, driverLicense);
      return res.json({ ok: true, profile: r.rows[0] });
    }
    return res.status(400).json({ error: "Unsupported role" });
  } catch (err) {
    console.error("[AUTH] profile PUT error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
}

// ── Account PUT ───────────────────────────────────────────────────────────────
export async function updateAccount(req, res) {
  try {
    const { accountId } = req.auth;
    const { identifier, password } = req.body || {};

    if (!identifier) {
      return res.status(400).json({ error: "Tên tài khoản không được để trống" });
    }

    // Check if new identifier is taken by another account
    const existing = await checkIdentifierExists(identifier, pool);
    if (existing.rows.length > 0 && existing.rows[0].id !== accountId) {
      return res.status(409).json({ error: "Tên tài khoản đã tồn tại" });
    }

    let passwordHash = null;
    if (password) {
      passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    }

    const r = await updateAccountCredentials(accountId, identifier, passwordHash);
    if (r.rows.length === 0) {
      return res.status(404).json({ error: "Account not found" });
    }

    return res.json({ ok: true, account: { id: r.rows[0].id, identifier: r.rows[0].identifier, role: r.rows[0].role } });
  } catch (err) {
    console.error("[AUTH] account PUT error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
}

// ── Internal endpoints ────────────────────────────────────────────────────────
export async function internalGetUserProfile(req, res) {
  try {
    const data = await getUserProfileInternal(req.params.accountId);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function internalGetDriverProfile(req, res) {
  try {
    const data = await getDriverProfileInternal(req.params.accountId);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function internalVerifyToken(req, res) {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: "token required" });

    const decoded = jwt.verify(token, JWT_SECRET, { issuer: JWT_ISSUER, audience: JWT_AUDIENCE });
    res.json({ valid: true, accountId: decoded.sub, role: decoded.role, userId: decoded.userId || null, driverId: decoded.driverId || null });
  } catch (err) {
    if (err.name === "TokenExpiredError") return res.json({ valid: false, error: "Token expired" });
    return res.json({ valid: false, error: "Invalid token" });
  }
}

// ── Admin endpoints ───────────────────────────────────────────────────────────
export async function adminListUsers(req, res) {
  try {
    const r = await listAccounts();
    res.json({ users: r.rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

export async function adminUpdateUser(req, res) {
  try {
    const { userId } = req.params;
    const { full_name, phone, status } = req.body;

    const updates = [];
    const params  = [];
    let paramIdx  = 1;

    if (status !== undefined) {
      updates.push(`status = $${paramIdx++}`);
      params.push(status);
    }

    if (full_name !== undefined || phone !== undefined) {
      const accountRes = await getAccountRole(userId);
      if (!accountRes.rowCount) return res.status(404).json({ error: "User not found" });

      const role         = accountRes.rows[0].role;
      const profileTable = role === "DRIVER" ? "driver_profiles" : "user_profiles";

      if (full_name !== undefined) await updateAccountField(profileTable, userId, "full_name", full_name);
      if (phone !== undefined)     await updateAccountField(profileTable, userId, "phone", phone);
    }

    if (updates.length > 0) {
      params.push(userId);
      const result = await pool.query(
        `UPDATE accounts SET ${updates.join(", ")} WHERE id = $${paramIdx} RETURNING *`,
        params
      );
      return res.json({ account: result.rows[0] });
    }

    res.json({ message: "Updated" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

export async function adminDeleteUser(req, res) {
  const client = await pool.connect();
  try {
    const { userId } = req.params;

    if (userId === req.auth.sub) {
      return res.status(400).json({ error: "Cannot delete your own account" });
    }

    await client.query("BEGIN");
    const result = await deleteAccount(client, userId);
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
}
