const BASE_URL = process.argv[2] || "http://127.0.0.1:8000";

async function createUser() {
  const runId = Date.now();
  const res = await fetch(`${BASE_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      identifier: `tc36-user-${runId}@test.com`,
      password: "Test@123456",
      role: "USER",
      userId: `USR_TC36_${runId}`,
    }),
  });
  const body = await res.json();
  return { token: body.accessToken, userId: `USR_TC36_${runId}` };
}

async function waitForPaymentEvent(token, timeoutMs = 12000) {
  const res = await fetch(`${BASE_URL}/notifications/stream?token=${encodeURIComponent(token)}`, {
    headers: { Accept: "text/event-stream" },
  });
  const reader = res.body.getReader();
  const deadline = Date.now() + timeoutMs;
  let buffer = "";
  while (Date.now() < deadline) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += Buffer.from(value).toString("utf8");
    if (buffer.includes("event: payment")) {
      await reader.cancel().catch(() => {});
      return true;
    }
  }
  await reader.cancel().catch(() => {});
  return false;
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

  const ssePromise = waitForPaymentEvent(token);
  const paymentRes = await fetch(`${BASE_URL}/payment/payments`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Idempotency-Key": `tc36-${Date.now()}` },
    body: JSON.stringify({
      user_id: userId,
      booking_id: booking.bookingId,
      amount: 50000,
      payment_method: "card",
      card_number: "4111111111111234",
    }),
  });
  const payment = await paymentRes.json();
  const gotEvent = await ssePromise;

  console.log(`booking_status=${booking.status}`);
  console.log(`payment_status=${payment.payment_status}`);
  console.log(`notification_event=${gotEvent}`);

  if (bookingRes.status !== 200) throw new Error("Booking creation failed");
  if (![200, 201].includes(paymentRes.status) || payment.payment_status !== "SUCCESS") {
    throw new Error("Payment success flow failed");
  }
  if (!gotEvent) throw new Error("Did not receive payment notification event");
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
