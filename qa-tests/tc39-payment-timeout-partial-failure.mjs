const BASE_URL = process.argv[2] || "http://127.0.0.1:8000";

async function main() {
  const payload = {
    booking_id: `BK_TC39_${Date.now()}`,
    user_id: "USR_TC39",
    pickup: { lat: 10.76, lng: 106.66 },
    dropoff: { lat: 10.77, lng: 106.70 },
    vehicleType: "CAR_4",
    payment_method: "card",
    amount: 50000,
    card_number: "4111111111111234",
    payment_timeout_ms: 4000,
  };

  const startedAt = Date.now();
  const response = await fetch(`${BASE_URL}/agent/booking-flow-trace`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const durationMs = Date.now() - startedAt;
  const body = await response.json().catch(() => ({}));

  console.log(`status=${response.status}`);
  console.log(`duration_ms=${durationMs}`);
  console.log(`error=${body.error || ""}`);
  console.log(`message=${body.message || ""}`);
  console.log(`trace_id=${body.trace_id || ""}`);

  if (response.status !== 500) {
    throw new Error(`Expected 500 controlled timeout response, got ${response.status}`);
  }
  if (!/timeout|aborted|failed/i.test(`${body.message || ""} ${body.error || ""}`)) {
    throw new Error("Expected timeout-style error message");
  }
  if (!body.trace_id) {
    throw new Error("Expected trace_id in controlled failure response");
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
