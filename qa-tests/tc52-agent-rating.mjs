const BASE_URL = process.argv[2] || "http://127.0.0.1:8012";

async function main() {
  const payload = {
    pickup: { lat: 10.76, lng: 106.66 },
    dropoff: { lat: 10.77, lng: 106.70 },
    available_drivers: [
      { id: "D1", distance: 1000, rating: 4.2, status: "ONLINE" },
      { id: "D2", distance: 1005, rating: 4.9, status: "ONLINE" },
    ],
    skip_context_tools: true,
  };

  const res = await fetch(`${BASE_URL}/agent/select-driver`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await res.json();
  console.log(`status=${res.status}`);
  console.log(`selected_driver=${body.selected_driver?.driver_id || ""}`);
  if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
  if (body.selected_driver?.driver_id !== "D2") throw new Error(`Expected higher-rated D2, got ${body.selected_driver?.driver_id}`);
}

main().catch((err) => { console.error(err.message || err); process.exit(1); });
