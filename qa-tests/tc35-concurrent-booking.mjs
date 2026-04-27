const BASE_URL = process.argv[2] || "http://127.0.0.1:8000";

async function createUserToken() {
  const runId = Date.now();
  const res = await fetch(`${BASE_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      identifier: `tc35-user-${runId}@test.com`,
      password: "Test@123456",
      role: "USER",
      userId: `USR_TC35_${runId}`,
    }),
  });
  const body = await res.json();
  if (!body.accessToken) throw new Error("Could not obtain access token");
  return body.accessToken;
}

async function main() {
  const token = await createUserToken();
  const idemKey = `tc35-${Date.now()}`;
  const payload = {
    pickup: { lat: 10.76, lng: 106.66, address: "A" },
    dropoff: { lat: 10.77, lng: 106.70, address: "B" },
    vehicleType: "CAR_4",
    paymentMethod: "CASH",
    pricingSnapshot: { fare: 25000, distanceM: 5000, durationS: 600, currency: "VND" },
  };

  const [r1, r2] = await Promise.all([
    fetch(`${BASE_URL}/bookings`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, "X-Idempotency-Key": idemKey },
      body: JSON.stringify(payload),
    }),
    fetch(`${BASE_URL}/bookings`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, "X-Idempotency-Key": idemKey },
      body: JSON.stringify(payload),
    }),
  ]);

  const b1 = await r1.json();
  const b2 = await r2.json();
  console.log(`statuses=${r1.status},${r2.status}`);
  console.log(`booking_ids=${b1.bookingId},${b2.bookingId}`);
  console.log(`dedup_flags=${Boolean(b1.deduplicated)},${Boolean(b2.deduplicated)}`);

  if (r1.status !== 200 || r2.status !== 200) throw new Error("Expected both requests to return 200");
  if (b1.bookingId !== b2.bookingId) throw new Error("Expected same bookingId for concurrent duplicate request");
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
