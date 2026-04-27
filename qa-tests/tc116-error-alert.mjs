import crypto from "node:crypto";

const BASE_URL = process.argv[2] || "http://127.0.0.1:8000";
const PROM_URL = process.argv[3] || "http://127.0.0.1:9090";

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomUuid() {
  return crypto.randomUUID();
}

async function ensureUserToken() {
  const runId = Date.now();
  const identifier = `alert-user-${runId}@test.com`;
  const password = "Test@123456";
  const registerRes = await fetch(`${BASE_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      identifier,
      password,
      role: "USER",
      userId: `USR_ALERT_${runId}`,
    }),
  });
  const registerBody = await registerRes.json().catch(() => ({}));
  if (registerRes.ok && registerBody.accessToken) {
    return registerBody.accessToken;
  }

  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier, password }),
  });
  const loginBody = await loginRes.json().catch(() => ({}));
  if (!loginRes.ok || !loginBody.accessToken) {
    throw new Error("Could not obtain user token for alert test");
  }
  return loginBody.accessToken;
}

async function createErrors(token) {
  const tasks = [];
  for (let i = 0; i < 24; i += 1) {
    tasks.push(fetch(`${BASE_URL}/bookings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
        "X-Test-Simulate-Failure": "after_booking_insert",
        "X-Test-Booking-Id": randomUuid(),
      },
      body: JSON.stringify({
        pickup: { lat: 10.76, lng: 106.66, address: "A" },
        dropoff: { lat: 10.77, lng: 106.70, address: "B" },
        vehicleType: "CAR_4",
        paymentMethod: "CASH",
        pricingSnapshot: { fare: 25000, distanceM: 5000, durationS: 600, currency: "VND" },
      }),
    }).catch(() => null));
  }
  await Promise.all(tasks);
}

async function getRuleState() {
  const res = await fetch(`${PROM_URL}/api/v1/rules`);
  const json = await res.json();
  const groups = json?.data?.groups || [];
  for (const group of groups) {
    for (const rule of group.rules || []) {
      if (rule.name === "HighErrorRate") {
        return {
          state: rule.state,
          alerts: rule.alerts || [],
        };
      }
    }
  }
  return null;
}

async function main() {
  const token = await ensureUserToken();
  console.log("triggering 5xx traffic for HighErrorRate...");
  await createErrors(token);
  await sleep(35000);
  await createErrors(token);
  await sleep(20000);

  const rule = await getRuleState();
  const match = rule?.alerts?.[0];

  console.log(`rule_state=${rule?.state || ""}`);
  console.log(`high_error_rate_alert_state=${match?.state || ""}`);
  console.log(`high_error_rate_service=${match?.labels?.service_name || ""}`);

  if (!rule || !["pending", "firing"].includes(rule.state)) {
    throw new Error("HighErrorRate rule did not enter pending/firing state");
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
