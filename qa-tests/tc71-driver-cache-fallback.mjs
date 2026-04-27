const BASE_URL = process.argv[2] || "http://127.0.0.1:8000";

async function main() {
  const warmPayload = {
    pickup: { lat: 10.76, lng: 106.66 },
    dropoff: { lat: 10.77, lng: 106.70 },
    vehicleType: "CAR_4",
    available_drivers: [
      { id: "D1", distance: 800, rating: 4.7, status: "ONLINE" },
      { id: "D2", distance: 1200, rating: 4.8, status: "ONLINE" },
    ],
    skip_context_tools: true,
  };

  const warmRes = await fetch(`${BASE_URL}/agent/context`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(warmPayload),
  });
  const warmBody = await warmRes.json();
  console.log(`warm_status=${warmRes.status}`);
  console.log(`warm_driver_count=${warmBody.available_drivers?.length || 0}`);

  const failPayload = {
    pickup: warmPayload.pickup,
    dropoff: warmPayload.dropoff,
    vehicleType: warmPayload.vehicleType,
    __test_force_fail_tool: "driver_service",
    skip_context_tools: true,
  };

  const fallbackRes = await fetch(`${BASE_URL}/agent/context`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(failPayload),
  });
  const fallbackBody = await fallbackRes.json();
  const driverTool = (fallbackBody.tools_called || []).find((t) => t.tool === "driver_service");

  console.log(`fallback_status=${fallbackRes.status}`);
  console.log(`driver_tool_success=${driverTool?.success}`);
  console.log(`driver_tool_cached=${driverTool?.cached}`);
  console.log(`driver_tool_fallback=${driverTool?.fallback}`);

  if (fallbackRes.status !== 200) throw new Error(`Expected 200, got ${fallbackRes.status}`);
  if (!driverTool?.success || !driverTool?.cached) {
    throw new Error("Expected cached driver fallback success");
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
