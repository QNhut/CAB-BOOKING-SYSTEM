const BASE_URL = process.argv[2] || "http://127.0.0.1:8000";

async function main() {
  const res = await fetch(`${BASE_URL}/agent/context`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      pickup: { lat: 10.76, lng: 106.66 },
      dropoff: { lat: 10.77, lng: 106.70 },
      vehicleType: "CAR_4",
      __test_force_fail_tool: "pricing_service",
    }),
  });
  const body = await res.json();
  const pricingTool = (body.tools_called || []).find((t) => t.tool === "pricing_service");
  console.log(`status=${res.status}`);
  console.log(`attempt=${pricingTool?.attempt}`);
  if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
  if ((pricingTool?.attempt ?? 0) < 2) throw new Error(`Expected retries, got attempt=${pricingTool?.attempt}`);
}

main().catch((err) => { console.error(err.message || err); process.exit(1); });
