const BASE_URL = process.env.BASE_URL || "http://localhost:8000";

function randomId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function request(path, { method = "GET", headers = {}, body } = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: res.status, headers: res.headers, text, json };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const results = [];
async function runCase(id, fn) {
  try {
    await fn();
    results.push({ id, status: "PASS" });
  } catch (error) {
    results.push({ id, status: "FAIL", error: error.message });
  }
}

const runId = randomId();
const state = {
  customerIdentifier: `pdf-user-${runId}@test.com`,
  customerPassword: "Test@123456",
  customerUserId: `USR_${runId}`,
  driverIdentifier: `pdf-driver-${runId}@test.com`,
  driverPassword: "Test@123456",
  driverId: `DRV_${runId}`,
  vehicleType: "CAR_4",
};

await runCase("TC01 register user", async () => {
  const res = await request("/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: {
      identifier: state.customerIdentifier,
      password: state.customerPassword,
      role: "USER",
      userId: state.customerUserId,
    },
  });
  assert(res.status === 201, `expected 201, got ${res.status}`);
  assert(res.json?.account?.role === "USER", "missing USER account");
  assert(typeof res.json?.accessToken === "string", "missing accessToken");
  state.customerToken = res.json.accessToken;
  state.customerRefreshToken = res.json.refreshToken;
});

await runCase("TC02 login jwt", async () => {
  const res = await request("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: {
      identifier: state.customerIdentifier,
      password: state.customerPassword,
    },
  });
  assert(res.status === 200, `expected 200, got ${res.status}`);
  const token = res.json?.accessToken;
  assert(typeof token === "string" && token.split(".").length === 3, "invalid jwt format");
  const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
  assert(payload.sub, "jwt missing sub");
  assert(typeof payload.exp === "number", "jwt missing exp");
  state.customerToken = token;
  state.customerRefreshToken = res.json.refreshToken;
});

await runCase("Register driver", async () => {
  const res = await request("/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: {
      identifier: state.driverIdentifier,
      password: state.driverPassword,
      role: "DRIVER",
      driverId: state.driverId,
    },
  });
  assert(res.status === 201, `expected 201, got ${res.status}`);
  state.driverToken = res.json.accessToken;
});

await runCase("Driver login", async () => {
  const res = await request("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: {
      identifier: state.driverIdentifier,
      password: state.driverPassword,
    },
  });
  assert(res.status === 200, `expected 200, got ${res.status}`);
  state.driverToken = res.json.accessToken;
});

await runCase("TC05 driver online", async () => {
  const res = await request("/drivers/me/status", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${state.driverToken}`,
    },
    body: {
      status: "ONLINE",
      vehicleType: state.vehicleType,
      lat: 10.76,
      lng: 106.66,
    },
  });
  assert(res.status === 200, `expected 200, got ${res.status}`);
  assert(res.json?.status === "ONLINE", "driver not ONLINE");
});

await runCase("TC07 eta > 0", async () => {
  const res = await request("/eta/predict", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: { distance_km: 5, traffic_level: 0.5 },
  });
  assert(res.status === 200, `expected 200, got ${res.status}`);
  assert(res.json?.eta > 0, "eta <= 0");
  assert(res.json?.eta < 60, "eta unreasonable");
});

await runCase("TC08 pricing valid", async () => {
  const res = await request("/pricing/estimate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: { distance_km: 5, demand_index: 1, supply_index: 1, vehicleType: state.vehicleType },
  });
  assert(res.status === 200, `expected 200, got ${res.status}`);
  assert(res.json?.price > res.json?.base_fare, "price not above base_fare");
  assert(res.json?.surge_multiplier >= 1, "surge < 1");
  state.pricingFare = res.json.fare;
  state.pricingDistanceM = res.json.distanceM;
  state.pricingDurationS = res.json.durationS;
});

await runCase("TC03 create booking", async () => {
  const res = await request("/bookings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${state.customerToken}`,
    },
    body: {
      userId: state.customerUserId,
      pickup: { lat: 10.76, lng: 106.66, address: "Ben Thanh" },
      dropoff: { lat: 10.77, lng: 106.7, address: "District 1" },
      vehicleType: state.vehicleType,
      paymentMethod: "CASH",
      pricingSnapshot: {
        fare: state.pricingFare,
        distanceM: state.pricingDistanceM,
        durationS: state.pricingDurationS,
        currency: "VND",
      },
    },
  });
  assert([200, 201].includes(res.status), `expected 200/201, got ${res.status}`);
  assert(typeof res.json?.bookingId === "string", "missing bookingId");
  assert(["REQUESTED", "CONFIRMED"].includes(res.json?.status), "unexpected booking status");
  state.bookingId = res.json.bookingId;
});

await runCase("TC06 booking initial status", async () => {
  const res = await request(`/bookings/${state.bookingId}`);
  assert(res.status === 200, `expected 200, got ${res.status}`);
  assert(res.json?.status === "REQUESTED", `expected REQUESTED, got ${res.json?.status}`);
  assert(res.json?.created_at, "missing created_at");
});

await runCase("TC04 current user booking view", async () => {
  const res = await request("/bookings/me/active", {
    headers: { Authorization: `Bearer ${state.customerToken}` },
  });
  assert(res.status === 200, `expected 200, got ${res.status}`);
  assert(res.json?.booking?.id === state.bookingId, "active booking mismatch");
});

await runCase("TC11 missing pickup", async () => {
  const res = await request("/bookings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${state.customerToken}`,
    },
    body: {
      userId: state.customerUserId,
      dropoff: { lat: 10.77, lng: 106.7 },
      vehicleType: state.vehicleType,
      paymentMethod: "CASH",
      pricingSnapshot: { fare: 25000, distanceM: 5000, durationS: 600, currency: "VND" },
    },
  });
  assert(res.status === 400, `expected 400, got ${res.status}`);
});

await runCase("TC12 invalid lat/lng", async () => {
  const res = await request("/bookings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${state.customerToken}`,
    },
    body: {
      userId: state.customerUserId,
      pickup: { lat: "abc", lng: 106.66 },
      dropoff: { lat: 10.77, lng: 106.7 },
      vehicleType: state.vehicleType,
      paymentMethod: "CASH",
      pricingSnapshot: { fare: 25000, distanceM: 5000, durationS: 600, currency: "VND" },
    },
  });
  assert(res.status === 422, `expected 422, got ${res.status}`);
});

await runCase("TC14 invalid payment method on booking", async () => {
  const res = await request("/bookings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${state.customerToken}`,
    },
    body: {
      userId: state.customerUserId,
      pickup: { lat: 10.76, lng: 106.66 },
      dropoff: { lat: 10.77, lng: 106.7 },
      vehicleType: state.vehicleType,
      paymentMethod: "invalid_card",
      pricingSnapshot: { fare: 25000, distanceM: 5000, durationS: 600, currency: "VND" },
    },
  });
  assert(res.status === 400, `expected 400, got ${res.status}`);
});

await runCase("TC14b invalid payment method on payment api", async () => {
  const res = await request("/payment/payments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: {
      user_id: state.customerUserId,
      booking_id: `BK_INVALID_${runId}`,
      amount: 50000,
      payment_method: "invalid_card",
    },
  });
  assert(res.status === 400, `expected 400, got ${res.status}`);
});

await runCase("TC15 eta zero distance", async () => {
  const res = await request("/eta/predict", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: { distance_km: 0 },
  });
  assert(res.status === 200, `expected 200, got ${res.status}`);
  assert(res.json?.eta >= 0, "eta negative");
});

await runCase("TC16 pricing demand zero", async () => {
  const res = await request("/pricing/estimate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: { distance_km: 5, demand_index: 0, supply_index: 1, vehicleType: state.vehicleType },
  });
  assert(res.status === 200, `expected 200, got ${res.status}`);
  assert(res.json?.surge_multiplier >= 1, "surge < 1");
  assert(res.json?.price > 0, "price <= 0");
});

await runCase("TC17 fraud missing field", async () => {
  const res = await request("/fraud/check", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: { user_id: state.customerUserId },
  });
  assert(res.status === 400, `expected 400, got ${res.status}`);
  assert(res.json?.error === "missing required fields", "unexpected error");
});

await runCase("TC18 unauthorized request", async () => {
  const res = await request("/bookings/me/active");
  assert(res.status === 401, `expected 401, got ${res.status}`);
});

await runCase("TC19 duplicate booking idempotency", async () => {
  const idemKey = `dup-${runId}`;
  const payload = {
    userId: state.customerUserId,
    pickup: { lat: 10.761, lng: 106.661 },
    dropoff: { lat: 10.772, lng: 106.702 },
    vehicleType: state.vehicleType,
    paymentMethod: "CASH",
    pricingSnapshot: { fare: 26000, distanceM: 5200, durationS: 620, currency: "VND" },
  };
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${state.customerToken}`,
    "X-Idempotency-Key": idemKey,
  };
  const first = await request("/bookings", { method: "POST", headers, body: payload });
  assert([200, 201].includes(first.status), `first request failed ${first.status}`);
  const second = await request("/bookings", { method: "POST", headers, body: payload });
  assert([200, 201].includes(second.status), `second request failed ${second.status}`);
  assert(second.json?.bookingId === first.json?.bookingId, "bookingId mismatch");
  assert(second.json?.deduplicated === true, "deduplicated flag missing");
});

await runCase("TC20 payload too large", async () => {
  const large = {
    identifier: `too-large-${runId}@test.com`,
    password: "Test@123456",
    role: "USER",
    blob: "x".repeat(1_100_000),
  };
  const res = await fetch(`${BASE_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(large),
  });
  assert(res.status === 413, `expected 413, got ${res.status}`);
});

await runCase("TC42 surge high demand", async () => {
  const res = await request("/pricing/estimate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: { distance_km: 5, demand_index: 2, supply_index: 1, vehicleType: state.vehicleType },
  });
  assert(res.status === 200, `expected 200, got ${res.status}`);
  assert(res.json?.surge_multiplier > 1, "surge not above 1");
  assert(res.json?.surge_multiplier <= 5, "surge above cap");
});

await runCase("TC43 fraud flagged", async () => {
  const res = await request("/fraud/check", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: {
      user_id: state.customerUserId,
      driver_id: state.driverId,
      booking_id: `BK_FRAUD_${runId}`,
      amount: 9_000_000,
      location: { lat: 35.0, lng: 139.0 },
      device_fingerprint: "device-demo",
    },
  });
  assert(res.status === 200, `expected 200, got ${res.status}`);
  assert(res.json?.flagged === true, "not flagged");
});

await runCase("TC45 forecast schema", async () => {
  const res = await request("/eta/forecast?zone=default&hour=8");
  assert(res.status === 200, `expected 200, got ${res.status}`);
  assert("zone" in res.json && "hour" in res.json && "demand_index" in res.json && "supply_index" in res.json, "forecast schema mismatch");
});

await runCase("TC46 model version", async () => {
  const res = await request("/eta/model-info");
  assert(res.status === 200, `expected 200, got ${res.status}`);
  assert(typeof res.json?.model_version === "string", "missing model_version");
});

await runCase("TC50 outlier does not crash eta", async () => {
  const res = await request("/eta/predict", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: { distance_km: 1000, traffic_level: 0.5 },
  });
  assert([200, 400, 422].includes(res.status), `unexpected status ${res.status}`);
});

await runCase("TC83/92 tampered jwt", async () => {
  const res = await request("/bookings/me/active", {
    headers: {
      Authorization: "Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhZG1pbl8wMDEiLCJyb2xlIjoiQURNSU4iLCJleHAiOjQ3MzM5ODQwMDB9.invalidsignature",
    },
  });
  assert(res.status === 401, `expected 401, got ${res.status}`);
});

await runCase("TC84/89/95 rbac forbidden", async () => {
  const res = await request("/auth/admin/users", {
    headers: { Authorization: `Bearer ${state.driverToken}` },
  });
  assert(res.status === 403, `expected 403, got ${res.status}`);
});

await runCase("TC10 logout", async () => {
  const res = await request("/auth/logout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: { refreshToken: state.customerRefreshToken },
  });
  assert(res.status === 200, `expected 200, got ${res.status}`);
});

await runCase("TC10 refresh revoked token", async () => {
  const res = await request("/auth/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: { refreshToken: state.customerRefreshToken },
  });
  assert(res.status === 401, `expected 401, got ${res.status}`);
});

const passCount = results.filter((r) => r.status === "PASS").length;
const failCount = results.length - passCount;
console.log(JSON.stringify({ baseUrl: BASE_URL, passCount, failCount, results }, null, 2));

if (failCount > 0) {
  process.exitCode = 1;
}
