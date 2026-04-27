const BASE_URL = process.argv[2] || "http://127.0.0.1:8012";

async function main() {
  const payload = {
    pickup: { lat: 10.76, lng: 106.66 },
    dropoff: { lat: 10.77, lng: 106.70 },
    available_drivers: [
      { id: "D1", distance: 1200, rating: 4.8, status: "ONLINE" },
      { id: "D2", distance: 900, rating: 4.7, status: "ONLINE" },
      { id: "D3", distance: 1600, rating: 4.9, status: "ONLINE" },
    ],
    force_rule_based: true,
    skip_context_tools: true,
  };

  const startedAt = Date.now();
  const response = await fetch(`${BASE_URL}/agent/select-driver`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const durationMs = Date.now() - startedAt;
  const body = await response.json();

  console.log(`status=${response.status}`);
  console.log(`duration_ms=${durationMs}`);
  console.log(`selection_method=${body.selection_method || ""}`);
  console.log(`selected_driver=${body.selected_driver?.driver_id || ""}`);

  if (response.status !== 200) throw new Error(`Expected 200, got ${response.status}`);
  if (durationMs >= 200) throw new Error(`Expected latency < 200ms, got ${durationMs}ms`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
