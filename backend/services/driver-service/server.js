import { app, redis } from "./app.js";

const PORT = Number(process.env.PORT || 8004);

async function main() {
  await redis.connect();
  console.log("✅ driver-service redis connected");
  app.listen(PORT, () => console.log(`Driver service on http://localhost:${PORT}`));
}

main().catch((e) => {
  console.error("❌ driver-service fatal:", e);
  process.exit(1);
});
