import { createClient } from "redis";

const REDIS_URL = process.env.REDIS_URL || "redis://redis:6379";

export const redis = createClient({ url: REDIS_URL });
redis.on("error", (e) => console.error("Redis error:", e.message));

const lockKey = (driverId) => `lock:driver:${driverId}`;

export async function tryLockDriver(driverId, ttlSec) {
  const ok = await redis.set(lockKey(driverId), "1", { NX: true, EX: ttlSec });
  return ok === "OK";
}

export async function unlockDriver(driverId) {
  await redis.del(lockKey(driverId));
}
