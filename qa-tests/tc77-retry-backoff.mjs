const BASE_URL = process.argv[2] || "http://127.0.0.1:8000";

async function main() {
  const payload = {
    pickup: { lat: 10.76, lng: 106.66 },
    dropoff: { lat: 10.77, lng: 106.70 },
    vehicleType: "CAR_4",
    __test_force_fail_tool: "pricing_service",
  };

  const response = await fetch(`${BASE_URL}/agent/context`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await response.json();
  const pricingTool = (body.tools_called || []).find((t) => t.tool === "pricing_service");

  console.log(`status=${response.status}`);
  console.log(`pricing_success=${pricingTool?.success}`);
  console.log(`retry_delays_ms=${JSON.stringify(pricingTool?.retry_delays_ms || [])}`);

  if (response.status !== 200) throw new Error(`Expected 200, got ${response.status}`);
  const delays = pricingTool?.retry_delays_ms || [];
  if (delays.length < 2 || delays[0] !== 100 || delays[1] !== 200) {
    throw new Error(`Expected exponential backoff [100,200], got ${JSON.stringify(delays)}`);
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
