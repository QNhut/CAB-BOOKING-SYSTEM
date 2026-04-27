import { runLoad } from "./lib/load-test.mjs";

const PRICING_URL = process.argv[2] || "http://127.0.0.1:8002";
const TOTAL = Number(process.argv[3] || 300);
const CONCURRENCY = Number(process.argv[4] || 80);

console.log("phase=warmup");
await runLoad({
  name: "TC63 pricing warmup",
  total: 20,
  concurrency: 5,
  requestFactory: () =>
    fetch(`${PRICING_URL}/pricing/estimate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        distance_km: 5,
        vehicleType: "CAR_4",
        demand_index: 1.2,
        supply_index: 1.0,
      }),
    }),
});

console.log("phase=spike");
await runLoad({
  name: "TC63 pricing spike",
  total: TOTAL,
  concurrency: CONCURRENCY,
  requestFactory: () =>
    fetch(`${PRICING_URL}/pricing/estimate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        distance_km: 5,
        vehicleType: "CAR_4",
        demand_index: 2.0,
        supply_index: 1.0,
      }),
    }),
});
