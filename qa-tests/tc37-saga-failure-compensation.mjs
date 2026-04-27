const BASE_URL = process.argv[2] || "http://127.0.0.1:8000";

async function createUser() {
  const runId = Date.now();
  const res = await fetch(`${BASE_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      identifier: `tc37-user-${runId}@test.com`,
      password: "Test@123456",
      role: "USER",
      userId: `USR_TC37_${runId}`,
    }),
  });
  const body = await res.json();
  return { token: body.accessToken, userId: `USR_TC37_${runId}` };
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForCancelled(bookingId, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await fetch(`${BASE_URL}/bookings/${bookingId}`);
    const body = await res.json();
    if (body.status === "CANCELLED") return body;
    await sleep(1000);
  }
  const res = await fetch(`${BASE_URL}/bookings/${bookingId}`);
  return res.json();
}

async function main() {
  const { token, userId } = await createUser();
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

  const failRes = await fetch(`${BASE_URL}/payment/payments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Test-Payment-Status": "FAILED",
      "X-Idempotency-Key": `tc37-${Date.now()}`,
    },
    body: JSON.stringify({
      user_id: userId,
      booking_id: booking.bookingId,
      amount: 50000,
      payment_method: "card",
      card_number: "4111111111111234",
    }),
  });
  await failRes.json();
  const after = await waitForCancelled(booking.bookingId);
  console.log(`status_after_failure=${after.status}`);

  if (after.status !== "CANCELLED") throw new Error(`Expected CANCELLED, got ${after.status}`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
