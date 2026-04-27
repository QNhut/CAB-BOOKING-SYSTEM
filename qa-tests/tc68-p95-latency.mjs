import { runLoad } from "./lib/load-test.mjs";

const TARGET_URL = process.argv[2] || "http://127.0.0.1:8009";
const TOTAL = Number(process.argv[3] || 200);
const CONCURRENCY = Number(process.argv[4] || 40);
const MAX_P95_MS = Number(process.argv[5] || 300);

const summary = await runLoad({
  name: "TC68 p95 latency threshold",
  total: TOTAL,
  concurrency: CONCURRENCY,
  requestFactory: () =>
    fetch(`${TARGET_URL}/eta/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        distance_km: 5,
        traffic_level: 0.5,
      }),
    }),
});

console.log(`max_p95_ms=${MAX_P95_MS}`);
if (summary.p95Ms >= MAX_P95_MS) {
  throw new Error(`Expected p95 < ${MAX_P95_MS}ms, got ${summary.p95Ms}ms`);
}
