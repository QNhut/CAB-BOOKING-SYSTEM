import { createClient } from "redis";

const REDIS_URL     = process.env.REDIS_URL      || "redis://redis:6379";
export const HB_TTL_SEC    = Number(process.env.HB_TTL_SEC    || 1800);
export const STATE_TTL_SEC = Number(process.env.STATE_TTL_SEC || 1800);

export const redis = createClient({ url: REDIS_URL });
redis.on("error", (e) => console.error("Redis error:", e.message));

export const hbKey      = (driverId) => `driver:hb:${driverId}`;
export const stateKey   = (driverId) => `driver:state:${driverId}`;
export const vehicleKey = (driverId) => `driver:vehicle:${driverId}`;
export const geoKey     = (vehicleType) => {
  if (!vehicleType) throw new Error("vehicleType required");
  return `geo:drivers:${vehicleType}`;
};
