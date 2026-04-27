const BASE_URL = process.argv[2] || "http://127.0.0.1:8000";

async function main() {
  const payload = {
    pickup: { lat: 10.76, lng: 106.66 },
    dropoff: { lat: 10.77, lng: 106.70 },
    available_drivers: [
      { id: "D1", distance: 1800, rating: 4.9, status: "ONLINE" },
      { id: "D2", distance: 700, rating: 4.1, status: "ONLINE" },
    ],
    __test_force_fail_tool: "agent_ai",
    force_rule_based: true,
    skip_context_tools: true,
  };

  const response = await fetch(`${BASE_URL}/agent/select-driver`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await response.json();

  console.log(`status=${response.status}`);
  console.log(`selection_method=${body.selection_method || ""}`);
  console.log(`selected_driver=${body.selected_driver?.driver_id || ""}`);

  if (response.status !== 200) throw new Error(`Expected 200, got ${response.status}`);
  if (body.selection_method !== "rule_based_fallback") {
    throw new Error(`Expected rule_based_fallback, got ${body.selection_method}`);
  }
  if (body.selected_driver?.driver_id !== "D2") {
    throw new Error(`Expected nearest driver D2, got ${body.selected_driver?.driver_id}`);
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
