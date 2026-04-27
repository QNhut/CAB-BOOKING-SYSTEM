import { runLoad } from "./lib/load-test.mjs";

const TARGET_URL = process.argv[2] || "http://127.0.0.1:8002";
const TOTAL = Number(process.argv[3] || 300);
const CONCURRENCY = Number(process.argv[4] || 80);

const summary = await runLoad({
  name: "TC69 peak hour load",
  total: TOTAL,
  concurrency: CONCURRENCY,
  requestFactory: () =>
    fetch(`${TARGET_URL}/pricing/estimate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        distance_km: 6,
        vehicleType: "CAR_4",
        demand_index: 2.0,
        supply_index: 0.8,
        traffic_level: 1.0,
        hour: 18,
      }),
    }),
});

if ((summary.statuses["200"] || 0) === 0) {
  throw new Error("Expected successful responses during peak-hour load test");
}
