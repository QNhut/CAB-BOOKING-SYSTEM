const BASE_URL = process.argv[2] || "http://127.0.0.1:8000";

async function main() {
  const res = await fetch(`${BASE_URL}/agent/context`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      pickup: { lat: 10.76, lng: 106.66 },
      dropoff: { lat: 10.77, lng: 106.70 },
      available_drivers: [
        { id: "D1", distance: 1000, rating: 4.6, status: "ONLINE" },
      ],
      __test_force_fail_tool: "pricing_service",
      skip_context_tools: false,
    }),
  });
  const body = await res.json();
  console.log(`status=${res.status}`);
  console.log(`has_drivers=${(body.available_drivers || []).length}`);
  console.log(`pricing_present=${Boolean(body.pricing)}`);
  if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
  if (!(body.available_drivers || []).length) throw new Error("Expected degraded but valid response");
}

main().catch((err) => { console.error(err.message || err); process.exit(1); });
