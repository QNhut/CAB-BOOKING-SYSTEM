import { runLoad } from "./lib/load-test.mjs";

const BASE_URL = process.argv[2] || "http://127.0.0.1:8000";
const TOTAL = Number(process.argv[3] || 250);
const CONCURRENCY = Number(process.argv[4] || 100);

async function createUser() {
  const runId = Date.now();
  const res = await fetch(`${BASE_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      identifier: `tc65-user-${runId}@test.com`,
      password: "Test@123456",
      role: "USER",
      userId: `USR_TC65_${runId}`,
    }),
  });
  const body = await res.json();
  return body.accessToken;
}

const token = await createUser();
const summary = await runLoad({
  name: "TC65 db pool exhaustion simulation",
  total: TOTAL,
  concurrency: CONCURRENCY,
  requestFactory: (i) =>
    fetch(`${BASE_URL}/bookings/me/active?probe=${i}`, {
      headers: { Authorization: `Bearer ${token}` },
    }),
});

const resolved = Object.values(summary.statuses).reduce((sum, v) => sum + v, 0);
if (resolved !== TOTAL) {
  throw new Error(`Expected all requests to resolve cleanly, got ${resolved}/${TOTAL}`);
}
