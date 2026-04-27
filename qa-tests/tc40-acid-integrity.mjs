const BASE_URL = process.argv[2] || "http://127.0.0.1:8000";

async function createUserToken() {
  const runId = Date.now();
  const res = await fetch(`${BASE_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      identifier: `tc40-user-${runId}@test.com`,
      password: "Test@123456",
      role: "USER",
      userId: `USR_TC40_${runId}`,
    }),
  });
  const body = await res.json();
  return body.accessToken;
}

async function main() {
  const token = await createUserToken();
  const forcedId = crypto.randomUUID();
  const failRes = await fetch(`${BASE_URL}/bookings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "X-Test-Simulate-Failure": "after_booking_insert",
      "X-Test-Booking-Id": forcedId,
    },
    body: JSON.stringify({
      pickup: { lat: 10.76, lng: 106.66, address: "A" },
      dropoff: { lat: 10.77, lng: 106.70, address: "B" },
      vehicleType: "CAR_4",
      paymentMethod: "CASH",
      pricingSnapshot: { fare: 25000, distanceM: 5000, durationS: 600, currency: "VND" },
    }),
  });
  const failBody = await failRes.json();
  const lookupRes = await fetch(`${BASE_URL}/bookings/${forcedId}`);

  console.log(`fail_status=${failRes.status}`);
  console.log(`lookup_status=${lookupRes.status}`);
  console.log(`error=${failBody.error || ""}`);

  if (failRes.status !== 500) throw new Error(`Expected 500, got ${failRes.status}`);
  if (lookupRes.status !== 404) throw new Error(`Expected 404 after rollback, got ${lookupRes.status}`);
}

import crypto from "node:crypto";
main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
