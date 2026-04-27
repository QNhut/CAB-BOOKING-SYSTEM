import { runLoad } from "./lib/load-test.mjs";

const BASE_URL = process.argv[2] || "http://127.0.0.1:8000";
const TOTAL = Number(process.argv[3] || 200);
const CONCURRENCY = Number(process.argv[4] || 50);

async function createUser() {
  const runId = Date.now();
  const res = await fetch(`${BASE_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      identifier: `tc61-user-${runId}@test.com`,
      password: "Test@123456",
      role: "USER",
      userId: `USR_TC61_${runId}`,
    }),
  });
  const body = await res.json();
  return body.accessToken;
}

const token = await createUser();
const summary = await runLoad({
  name: "TC61 booking load",
  total: TOTAL,
  concurrency: CONCURRENCY,
  requestFactory: (i) =>
    fetch(`${BASE_URL}/bookings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "X-Idempotency-Key": `tc61-${Date.now()}-${i}`,
      },
      body: JSON.stringify({
        pickup: { lat: 10.76, lng: 106.66, address: `Pickup ${i}` },
        dropoff: { lat: 10.77, lng: 106.70, address: `Drop ${i}` },
        vehicleType: "CAR_4",
        paymentMethod: "CASH",
        pricingSnapshot: { fare: 25000, distanceM: 5000, durationS: 600, currency: "VND" },
      }),
    }),
});

if ((summary.statuses["200"] || 0) + (summary.statuses["201"] || 0) === 0) {
  throw new Error("No successful booking responses observed under load");
}
