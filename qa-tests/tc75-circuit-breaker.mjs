const BASE_URL = process.argv[2] || "http://127.0.0.1:8000";

async function failOnce() {
  await fetch(`${BASE_URL}/agent/context`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      pickup: { lat: 10.76, lng: 106.66 },
      dropoff: { lat: 10.77, lng: 106.70 },
      vehicleType: "CAR_4",
      __test_force_fail_tool: "pricing_service",
    }),
  });
}

async function main() {
  await failOnce();
  await failOnce();
  await failOnce();

  const res = await fetch(`${BASE_URL}/agent/circuit-breakers`);
  const body = await res.json();
  console.log(`status=${res.status}`);
  console.log(`pricing_state=${body.pricing?.state || ""}`);
  console.log(`pricing_failures=${body.pricing?.failures || 0}`);
  if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
  if (body.pricing?.state !== "OPEN") throw new Error(`Expected pricing breaker OPEN, got ${body.pricing?.state}`);
}

main().catch((err) => { console.error(err.message || err); process.exit(1); });
