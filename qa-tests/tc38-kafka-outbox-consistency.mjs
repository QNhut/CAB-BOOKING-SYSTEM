const BASE_URL = process.argv[2] || "http://127.0.0.1:8000";
const BOOKING_DIRECT_URL = process.argv[3] || "http://127.0.0.1:8003";

async function createUserToken() {
  const runId = Date.now();
  const res = await fetch(`${BASE_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      identifier: `tc38-user-${runId}@test.com`,
      password: "Test@123456",
      role: "USER",
      userId: `USR_TC38_${runId}`,
    }),
  });
  const body = await res.json();
  return body.accessToken;
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function findOutboxEvent(bookingId, timeoutMs = 12000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    for (const status of ["SENT", "NEW", "SENDING", "FAILED"]) {
      const res = await fetch(`${BOOKING_DIRECT_URL}/outbox?status=${status}`);
      const body = await res.json();
      const matched = (body.items || []).filter((x) => x.aggregate_id === bookingId);
      if (matched.length > 0) {
        return { status, items: matched };
      }
    }
    await sleep(1000);
  }
  return { status: null, items: [] };
}

async function main() {
  const token = await createUserToken();
  const bookingRes = await fetch(`${BASE_URL}/bookings`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      pickup: { lat: 10.76, lng: 106.66, address: "A" },
      dropoff: { lat: 10.77, lng: 106.70, address: "B" },
      vehicleType: "CAR_4",
      paymentMethod: "CASH",
      pricingSnapshot: { fare: 25000, distanceM: 5000, durationS: 600, currency: "VND" },
    }),
  });
  const booking = await bookingRes.json();
  await sleep(1500);

  const bookingLookup = await fetch(`${BASE_URL}/bookings/${booking.bookingId}`);
  const bookingBody = await bookingLookup.json();

  const outbox = await findOutboxEvent(booking.bookingId);

  console.log(`booking_exists=${Boolean(bookingBody.id)}`);
  console.log(`outbox_status=${outbox.status || ""}`);
  console.log(`outbox_events=${outbox.items.length}`);

  if (!bookingBody.id) throw new Error("Booking record not found");
  if (outbox.items.length === 0) throw new Error("Expected outbox event for created booking");
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
