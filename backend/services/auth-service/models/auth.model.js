import { pool } from "../config/database.js";

export async function findAccountByIdentifier(identifier) {
  return pool.query(
    "SELECT *, user_id, driver_id FROM accounts WHERE identifier = $1",
    [identifier]
  );
}

export async function checkIdentifierExists(identifier, client) {
  return client.query(
    "SELECT id, identifier, role, status, password_hash, user_id, driver_id FROM accounts WHERE identifier = $1",
    [identifier]
  );
}

export async function createAccount(client, identifier, passwordHash, role, userId, driverId) {
  return client.query(
    `INSERT INTO accounts(identifier, password_hash, role, status, user_id, driver_id)
     VALUES ($1, $2, $3, 'ACTIVE', $4, $5)
     RETURNING id, identifier, role, status, created_at, user_id, driver_id`,
    [identifier, passwordHash, role, userId || null, driverId || null]
  );
}

export async function getAccountById(id) {
  return pool.query(
    "SELECT id, identifier, role, status, created_at FROM accounts WHERE id = $1",
    [id]
  );
}

export async function insertRefreshToken(client, accountId, tokenHash, expiresAt, deviceId, ip, userAgent) {
  return (client || pool).query(
    `INSERT INTO refresh_tokens(account_id, token_hash, expires_at, device_id, ip, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [accountId, tokenHash, expiresAt, deviceId || null, ip || null, userAgent || null]
  );
}

export async function findRefreshToken(client, tokenHash) {
  return (client || pool).query(
    `SELECT rt.*, a.id as account_id, a.identifier, a.role, a.status, a.user_id, a.driver_id
     FROM refresh_tokens rt
     JOIN accounts a ON rt.account_id = a.id
     WHERE rt.token_hash = $1
     FOR UPDATE`,
    [tokenHash]
  );
}

export async function revokeRefreshTokenById(client, id) {
  return (client || pool).query(
    "UPDATE refresh_tokens SET revoked_at = now() WHERE id = $1",
    [id]
  );
}

export async function revokeRefreshTokenByHash(tokenHash) {
  return pool.query(
    "UPDATE refresh_tokens SET revoked_at = now() WHERE token_hash = $1",
    [tokenHash]
  );
}

export async function logLoginAttempt(accountId, identifier, success, ip, userAgent, failureReason) {
  await pool.query(
    `INSERT INTO login_audit(account_id, identifier, success, ip, user_agent, failure_reason)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [accountId || null, identifier, success, ip || null, userAgent || null, failureReason || null]
  );
}

export async function getUserProfile(accountId) {
  return pool.query(
    "SELECT full_name, phone, updated_at FROM user_profiles WHERE account_id = $1",
    [accountId]
  );
}

export async function getDriverProfile(accountId) {
  return pool.query(
    "SELECT full_name, phone, vehicle_type, license_plate, driver_license, updated_at FROM driver_profiles WHERE account_id = $1",
    [accountId]
  );
}

export async function upsertUserProfile(accountId, fullName, phone) {
  await pool.query(
    `INSERT INTO user_profiles(account_id, full_name, phone, updated_at)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (account_id) DO UPDATE
       SET full_name = EXCLUDED.full_name,
           phone     = EXCLUDED.phone,
           updated_at = now()`,
    [accountId, fullName || null, phone || null]
  );
  return pool.query(
    "SELECT full_name, phone, updated_at FROM user_profiles WHERE account_id = $1",
    [accountId]
  );
}

export async function upsertDriverProfile(accountId, fullName, phone, vehicleType, licensePlate, driverLicense) {
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
    [accountId, fullName || null, phone || null, vehicleType || null, licensePlate || null, driverLicense || null]
  );
  return pool.query(
    "SELECT full_name, phone, vehicle_type, license_plate, driver_license, updated_at FROM driver_profiles WHERE account_id = $1",
    [accountId]
  );
}

export async function getUserProfileInternal(accountId) {
  const r = await pool.query(
    "SELECT full_name, phone FROM user_profiles WHERE account_id = $1",
    [accountId]
  );
  return r.rows[0] || null;
}

export async function getDriverProfileInternal(accountId) {
  const r = await pool.query(
    "SELECT full_name, phone, vehicle_type, license_plate, driver_license FROM driver_profiles WHERE account_id = $1",
    [accountId]
  );
  return r.rows[0] || null;
}

export async function listAccounts() {
  return pool.query(
    `SELECT a.id, a.identifier, a.role, a.created_at, a.status, a.driver_id,
            COALESCE(up.full_name, dp.full_name) AS full_name,
            COALESCE(up.phone, dp.phone) AS phone
     FROM accounts a
     LEFT JOIN user_profiles   up ON up.account_id = a.id
     LEFT JOIN driver_profiles dp ON dp.account_id = a.id
     ORDER BY a.created_at DESC LIMIT 200`
  );
}

export async function getAccountRole(id) {
  return pool.query("SELECT role FROM accounts WHERE id = $1", [id]);
}

export async function updateAccountField(table, accountId, field, value) {
  return pool.query(
    `INSERT INTO ${table}(account_id, ${field}) VALUES ($1, $2)
     ON CONFLICT (account_id) DO UPDATE SET ${field} = $2`,
    [accountId, value]
  );
}

export async function updateAccountStatus(id, status) {
  return pool.query(
    "UPDATE accounts SET status = $1 WHERE id = $2 RETURNING *",
    [status, id]
  );
}

export async function deleteAccount(client, id) {
  return client.query("DELETE FROM accounts WHERE id = $1 RETURNING id", [id]);
}

export async function updateAccountCredentials(id, identifier, passwordHash) {
  if (passwordHash) {
    return pool.query(
      "UPDATE accounts SET identifier = $1, password_hash = $2 WHERE id = $3 RETURNING id, identifier, role",
      [identifier, passwordHash, id]
    );
  } else {
    return pool.query(
      "UPDATE accounts SET identifier = $1 WHERE id = $2 RETURNING id, identifier, role",
      [identifier, id]
    );
  }
}
