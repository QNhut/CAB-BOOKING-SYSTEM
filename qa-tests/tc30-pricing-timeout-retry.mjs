const BASE_URL = process.argv[2] || "http://127.0.0.1:8000";
const failOnceKey = `tc30-${Date.now()}`;

async function main() {
  const startedAt = Date.now();
  const res = await fetch(`${BASE_URL}/agent/context`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ride_id: "BK_TC30",
      pickup: { lat: 10.76, lng: 106.66 },
      dropoff: { lat: 10.77, lng: 106.7 },
      vehicleType: "CAR_4",
      pricing_timeout_ms: 3500,
      pricing_fail_once_key: failOnceKey,
    }),
  });

  const body = await res.json();
  const durationMs = Date.now() - startedAt;
  const pricingTool = (body.tools_called || []).find((tool) => tool.tool === "pricing_service");

  console.log(`status=${res.status}`);
  console.log(`duration_ms=${durationMs}`);
  console.log(`request_id=${body.request_id || ""}`);
  console.log(`pricing_present=${Boolean(body.pricing)}`);
  console.log(`pricing_tool_success=${pricingTool?.success ?? false}`);
  console.log(`pricing_tool_attempt=${pricingTool?.attempt ?? -1}`);

  if (!res.ok) {
    process.exitCode = 1;
    return;
  }
  if (!body.pricing || !pricingTool?.success || pricingTool.attempt < 1) {
    process.exitCode = 2;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
