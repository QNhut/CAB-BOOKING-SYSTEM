const BASE_URL = process.argv[2] || "http://127.0.0.1:8000";

async function main() {
  const res = await fetch(`${BASE_URL}/agent/context`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      pickup: { lat: 10.76, lng: 106.66 },
      dropoff: { lat: 10.77, lng: 106.70 },
      vehicleType: "CAR_4",
    }),
  });
  const body = await res.json();
  const tools = Object.fromEntries((body.tools_called || []).map((t) => [t.tool, t]));
  console.log(`status=${res.status}`);
  console.log(`driver_tool=${tools.driver_service?.success}`);
  console.log(`eta_tool=${tools.eta_service?.success}`);
  console.log(`pricing_tool=${tools.pricing_service?.success}`);
  if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
  if (!("driver_service" in tools && "eta_service" in tools && "pricing_service" in tools)) {
    throw new Error("Expected driver, eta, pricing tool calls");
  }
}

main().catch((err) => { console.error(err.message || err); process.exit(1); });
