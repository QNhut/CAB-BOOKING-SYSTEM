import Redis from "ioredis";

const REDIS_URL = process.env.REDIS_URL || "redis://redis:6379";

let redis;
try {
  redis = new Redis(REDIS_URL);
} catch {
  console.warn("[PRICING] Redis not available, surge pricing disabled");
}

export default redis;
