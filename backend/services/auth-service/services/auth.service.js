import crypto from "crypto";
import jwt from "jsonwebtoken";
import { pool } from "../config/database.js";
import { insertRefreshToken } from "../models/auth.model.js";

const JWT_SECRET       = process.env.JWT_SECRET       || "dev-secret-change-me";
const JWT_ACCESS_TTL   = Number(process.env.JWT_ACCESS_TTL  || 900);
const JWT_REFRESH_TTL  = Number(process.env.JWT_REFRESH_TTL || 2592000);
const JWT_ISSUER       = "taxi-auth-service";
const JWT_AUDIENCE     = "taxi-platform";

export function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function generateRefreshToken() {
  return crypto.randomBytes(64).toString("hex");
}

export function signAccessToken(account, userId, driverId) {
  const payload = {
    iss: JWT_ISSUER,
    aud: JWT_AUDIENCE,
    sub: account.id,
    role: account.role,
  };

  if (account.role === "USER") {
    payload.userId = userId || account.user_id || account.id;
  }
  if (account.role === "DRIVER") {
    payload.driverId = driverId || account.driver_id || account.id;
  }

  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_ACCESS_TTL });
}

export async function createRefreshToken(accountId, deviceId, ip, userAgent) {
  const token     = generateRefreshToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + JWT_REFRESH_TTL * 1000);

  await insertRefreshToken(null, accountId, tokenHash, expiresAt, deviceId, ip, userAgent);

  return { token, expiresAt };
}

export { JWT_ACCESS_TTL };
