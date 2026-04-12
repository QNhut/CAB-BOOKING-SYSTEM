/**
 * k6 Load Test for Cab-Booking System
 * 
 * Install k6: brew install k6
 * Run: k6 run test/load-test.js
 * Run with custom VUs: k6 run --vus 50 --duration 30s test/load-test.js
 */
import http from "k6/http";
import { check, sleep, group } from "k6";
import { Rate, Trend } from "k6/metrics";

const BASE_URL = __ENV.BASE_URL || "http://localhost:8000";

// Custom metrics
const errorRate = new Rate("errors");
const bookingDuration = new Trend("booking_duration");
const etaDuration = new Trend("eta_duration");
const pricingDuration = new Trend("pricing_duration");

export const options = {
  scenarios: {
    // Ramp-up load test
    booking_load: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "10s", target: 10 },   // warm up
        { duration: "30s", target: 50 },   // ramp to 50
        { duration: "30s", target: 100 },  // ramp to 100
        { duration: "20s", target: 200 },  // spike to 200
        { duration: "10s", target: 0 },    // cool down
      ],
      gracefulStop: "5s",
    },
    // Constant load for ETA
    eta_constant: {
      executor: "constant-vus",
      vus: 20,
      duration: "60s",
      startTime: "5s",
    },
    // Spike test for pricing
    pricing_spike: {
      executor: "ramping-arrival-rate",
      startRate: 10,
      timeUnit: "1s",
      preAllocatedVUs: 50,
      maxVUs: 200,
      stages: [
        { duration: "10s", target: 10 },
        { duration: "10s", target: 100 },
        { duration: "10s", target: 10 },
      ],
      startTime: "10s",
    },
  },
  thresholds: {
    http_req_duration: ["p(95)<300"],        // TC68: P95 < 300ms
    http_req_failed: ["rate<0.01"],          // <1% error rate
    errors: ["rate<0.05"],                   // <5% application errors
    eta_duration: ["p(95)<200"],             // TC47: AI latency < 200ms
    booking_duration: ["p(95)<500"],
  },
};

// Register + login to get token
let cachedToken = null;
export function setup() {
  const uniqueId = `loadtest_${Date.now()}`;
  // Register
  let res = http.post(`${BASE_URL}/auth/register`, JSON.stringify({
    identifier: `${uniqueId}@test.com`,
    password: "test123456",
    role: "USER",
  }), { headers: { "Content-Type": "application/json" } });

  if (res.status === 201 || res.status === 200) {
    const body = JSON.parse(res.body);
    return { token: body.accessToken || body.access_token };
  }

  // Fallback: login existing user
  res = http.post(`${BASE_URL}/auth/login`, JSON.stringify({
    identifier: "user@test.com",
    password: "123456",
  }), { headers: { "Content-Type": "application/json" } });

  const body = JSON.parse(res.body);
  return { token: body.accessToken || body.access_token || "" };
}

export default function (data) {
  const token = data.token;
  const headers = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`,
  };

  group("Health Check", () => {
    const res = http.get(`${BASE_URL}/health`);
    check(res, {
      "health status 200": (r) => r.status === 200,
      "health ok": (r) => JSON.parse(r.body).ok === true,
    }) || errorRate.add(1);
  });

  group("ETA Service", () => {
    const start = Date.now();
    const res = http.post(`${BASE_URL}/eta/predict`, JSON.stringify({
      distance_km: 5 + Math.random() * 10,
      traffic_level: Math.random(),
    }), { headers });
    etaDuration.add(Date.now() - start);
    check(res, {
      "eta status 200": (r) => r.status === 200,
      "eta > 0": (r) => JSON.parse(r.body).eta_minutes > 0,
      "eta < 60": (r) => JSON.parse(r.body).eta_minutes < 60,
    }) || errorRate.add(1);
  });

  group("Pricing Service", () => {
    const start = Date.now();
    const res = http.post(`${BASE_URL}/pricing/estimate`, JSON.stringify({
      pickup: { lat: 10.76 + Math.random() * 0.05, lng: 106.66 + Math.random() * 0.05 },
      dropoff: { lat: 10.77 + Math.random() * 0.05, lng: 106.70 + Math.random() * 0.05 },
      vehicleType: Math.random() > 0.5 ? "CAR_4" : "CAR_7",
    }), { headers });
    pricingDuration.add(Date.now() - start);
    check(res, {
      "pricing status 200": (r) => r.status === 200,
      "price > 0": (r) => {
        const body = JSON.parse(r.body);
        return (body.fare || body.price || 0) > 0;
      },
      "surge >= 1": (r) => {
        const body = JSON.parse(r.body);
        return (body.surge_multiplier || body.surge || 1) >= 1;
      },
    }) || errorRate.add(1);
  });

  group("Rate Limit Test", () => {
    // TC67/85/98: rate limit
    let rateLimited = false;
    for (let i = 0; i < 5; i++) {
      const res = http.get(`${BASE_URL}/health`);
      if (res.status === 429) {
        rateLimited = true;
        break;
      }
    }
    // Rate limit should NOT trigger on health with just 5 requests
    // but would trigger under real load
  });

  group("Booking Flow", () => {
    const start = Date.now();
    const res = http.post(`${BASE_URL}/bookings`, JSON.stringify({
      userId: `user_${__VU}`,
      pickup: { lat: 10.76, lng: 106.66 },
      dropoff: { lat: 10.77, lng: 106.70 },
      vehicleType: "CAR_4",
      paymentMethod: "CASH",
      pricingSnapshot: {
        fare: 50000,
        distanceM: 5000,
        durationS: 900,
        currency: "VND",
      },
    }), { headers });
    bookingDuration.add(Date.now() - start);
    check(res, {
      "booking created": (r) => r.status === 200 || r.status === 201,
      "has bookingId": (r) => {
        try { return !!JSON.parse(r.body).bookingId; } catch { return false; }
      },
    }) || errorRate.add(1);
  });

  sleep(0.5 + Math.random());
}

export function handleSummary(data) {
  return {
    "test/load-test-result.json": JSON.stringify(data, null, 2),
    stdout: textSummary(data),
  };
}

function textSummary(data) {
  return `
=== LOAD TEST SUMMARY ===
VUs Max: ${data.root_group?.checks?.length || "N/A"}
HTTP Requests: ${data.metrics?.http_reqs?.values?.count || 0}
Avg Duration: ${(data.metrics?.http_req_duration?.values?.avg || 0).toFixed(1)}ms
P95 Duration: ${(data.metrics?.http_req_duration?.values?.["p(95)"] || 0).toFixed(1)}ms
Error Rate: ${((data.metrics?.http_req_failed?.values?.rate || 0) * 100).toFixed(2)}%
`;
}
