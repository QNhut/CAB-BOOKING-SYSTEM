import assert from "node:assert/strict";
import crypto from "node:crypto";

const PRICING_URL = "http://127.0.0.1:8002/pricing/estimate";
const PAYMENT_URL = "http://127.0.0.1:8888/payments";
const BOOKING_URL = "http://127.0.0.1:8003/bookings";
const BOOKING_HEALTH_URL = "http://127.0.0.1:8003/health";
const JWT_SECRET = "dev-secret-change-in-production-please";

function base64url(input) {
  return Buffer.from(JSON.stringify(input))
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function signJwt(payload) {
  const header = { alg: "HS256", typ: "JWT" };
  const encodedHeader = base64url(header);
  const encodedPayload = base64url(payload);
  const data = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto
    .createHmac("sha256", JWT_SECRET)
    .update(data)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  return `${data}.${signature}`;
}

async function postJson(url, body, extra = {}) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(extra.headers || {}),
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { status: res.status, body: json };
}

async function getJson(url, extra = {}) {
  const res = await fetch(url, { headers: extra.headers || {} });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { status: res.status, body: json };
}

async function waitFor(fn, { timeoutMs = 12000, intervalMs = 500 } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const result = await fn();
    if (result) return result;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return null;
}

const results = [];

async function runCase(name, fn) {
  try {
    await fn();
    results.push({ name, status: "PASS" });
  } catch (error) {
    results.push({ name, status: "FAIL", error: error.message });
  }
}

await runCase("pricing: valid distance_km request returns positive price and sane surge", async () => {
  const res = await postJson(PRICING_URL, {
    distance_km: 5,
    demand_index: 1.0,
    supply_index: 1.0,
  });
  assert.equal(res.status, 200);
  assert.equal(typeof res.body.price, "number");
  assert.ok(res.body.price > 0);
  assert.ok(res.body.base_fare > 0);
  assert.ok(res.body.price > res.body.base_fare);
  assert.ok(res.body.surge_multiplier >= 1);
});

await runCase("pricing: demand_index = 0 still keeps price > 0 and surge >= 1", async () => {
  const res = await postJson(PRICING_URL, {
    distance_km: 5,
    demand_index: 0,
    supply_index: 1,
  });
  assert.equal(res.status, 200);
  assert.ok(res.body.price > 0);
  assert.ok(res.body.surge_multiplier >= 1);
});

await runCase("pricing: supply_index = 0 does not divide by zero and high demand increases surge", async () => {
  const res = await postJson(PRICING_URL, {
    distance_km: 5,
    demand_index: 3,
    supply_index: 0,
  });
  assert.equal(res.status, 200);
  assert.ok(res.body.price > 0);
  assert.ok(res.body.surge_multiplier > 1);
});

await runCase("pricing: invalid distance_km type is rejected", async () => {
  const res = await postJson(PRICING_URL, {
    distance_km: "5",
    demand_index: 1,
    supply_index: 1,
  });
  assert.ok([400, 422].includes(res.status));
});

await runCase("pricing: distance_km = 0 and very large distance do not crash", async () => {
  const zeroRes = await postJson(PRICING_URL, {
    distance_km: 0,
    demand_index: 1,
    supply_index: 1,
  });
  assert.equal(zeroRes.status, 200);
  assert.ok(zeroRes.body.price > 0);

  const largeRes = await postJson(PRICING_URL, {
    distance_km: 100000,
    demand_index: 1,
    supply_index: 1,
  });
  assert.equal(largeRes.status, 200);
  assert.ok(largeRes.body.price > 0);
});

await runCase("payment: valid card payment succeeds without leaking card number", async () => {
  const res = await postJson(PAYMENT_URL, {
    user_id: "USR123",
    booking_id: "BK123",
    amount: 50000,
    payment_method: "card",
    card_number: "4111111111111234",
  });
  assert.ok([200, 201].includes(res.status));
  assert.match(res.body.payment_status, /SUCCESS|PENDING/);
  assert.equal(res.body.booking_id, "BK123");
  assert.equal(res.body.user_id, "USR123");
  assert.equal(res.body.card_number, undefined);
  assert.equal(JSON.stringify(res.body).includes("4111111111111234"), false);
});

await runCase("payment: invalid payment method is rejected clearly", async () => {
  const res = await postJson(PAYMENT_URL, {
    user_id: "USR123",
    booking_id: "BK124",
    amount: 50000,
    payment_method: "bitcoin",
  });
  assert.equal(res.status, 400);
  assert.match(String(res.body.error), /invalid payment method/i);
});

await runCase("payment: missing required fields and non-positive amount are rejected", async () => {
  const missing = await postJson(PAYMENT_URL, {
    booking_id: "BK125",
    amount: 50000,
    payment_method: "card",
  });
  assert.equal(missing.status, 400);

  const invalidAmount = await postJson(PAYMENT_URL, {
    user_id: "USR123",
    booking_id: "BK126",
    amount: 0,
    payment_method: "card",
  });
  assert.equal(invalidAmount.status, 400);
});

await runCase("payment: duplicate idempotency key replays old response without double charge", async () => {
  const headers = { "X-Idempotency-Key": "qa-payment-idem-1" };
  const first = await postJson(PAYMENT_URL, {
    user_id: "USR123",
    booking_id: "BK127",
    amount: 50000,
    payment_method: "card",
  }, { headers });
  const second = await postJson(PAYMENT_URL, {
    user_id: "USR123",
    booking_id: "BK127",
    amount: 50000,
    payment_method: "card",
  }, { headers });
  assert.ok([200, 201].includes(first.status));
  assert.equal(second.body.transaction_id, first.body.transaction_id);
  assert.equal(second.body.booking_id, first.body.booking_id);
  assert.equal(second.body.idempotent_replay, true);
});

await runCase("booking flow: payment failure cancels VNPAY booking", async () => {
  const health = await waitFor(async () => {
    const current = await getJson(BOOKING_HEALTH_URL);
    return current.status === 200 ? current : null;
  }, { timeoutMs: 15000 });
  assert.ok(health, "booking service should be healthy");

  const pricing = await postJson(PRICING_URL, {
    distance_km: 5,
    demand_index: 1,
    supply_index: 1,
  });
  assert.equal(pricing.status, 200);

  const token = signJwt({
    sub: "USR123",
    role: "USER",
    userId: "USR123",
    exp: Math.floor(Date.now() / 1000) + 3600,
  });

  const booking = await postJson(BOOKING_URL, {
    pickup: { lat: 10.7769, lng: 106.7009, address: "A" },
    dropoff: { lat: 10.7801, lng: 106.705, address: "B" },
    vehicleType: "CAR_4",
    paymentMethod: "VNPAY",
    pricingSnapshot: {
      fare: pricing.body.fare,
      distanceM: pricing.body.distanceM,
      durationS: pricing.body.durationS,
      currency: pricing.body.currency,
    },
  }, {
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Idempotency-Key": `qa-booking-${Date.now()}`,
    },
  });
  assert.equal(booking.status, 200);
  assert.ok(booking.body.bookingId);

  const paymentFail = await postJson(PAYMENT_URL, {
    user_id: "USR123",
    booking_id: booking.body.bookingId,
    amount: pricing.body.fare,
    payment_method: "vnpay",
  }, {
    headers: {
      "X-Idempotency-Key": `qa-payment-fail-${Date.now()}`,
      "X-Test-Payment-Status": "FAILED",
    },
  });
  assert.equal(paymentFail.status, 402);
  assert.equal(paymentFail.body.payment_status, "FAILED");

  const cancelled = await waitFor(async () => {
    const current = await getJson(`${BOOKING_URL}/${booking.body.bookingId}`);
    if (current.status === 200 && current.body.status === "CANCELLED") {
      return current;
    }
    return null;
  });
  assert.ok(cancelled, "booking should become CANCELLED after payment failure");
});

for (const result of results) {
  if (result.status === "PASS") {
    console.log(`PASS ${result.name}`);
  } else {
    console.log(`FAIL ${result.name}: ${result.error}`);
  }
}

const failed = results.filter((result) => result.status === "FAIL");
if (failed.length > 0) {
  process.exitCode = 1;
}
