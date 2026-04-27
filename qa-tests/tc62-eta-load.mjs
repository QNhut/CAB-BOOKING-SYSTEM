import { runLoad } from "./lib/load-test.mjs";

const ETA_URL = process.argv[2] || "http://127.0.0.1:8009";
const TOTAL = Number(process.argv[3] || 300);
const CONCURRENCY = Number(process.argv[4] || 60);

await runLoad({
  name: "TC62 eta load",
  total: TOTAL,
  concurrency: CONCURRENCY,
  requestFactory: () =>
    fetch(`${ETA_URL}/eta/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        distance_km: 5,
        traffic_level: 0.5,
      }),
    }),
});
