const BASE_URL = process.argv[2] || "http://127.0.0.1:8012";

async function main() {
  const payload = {
    pickup: { lat: 10.76, lng: 106.66 },
    dropoff: { lat: 10.77, lng: 106.70 },
    available_drivers: [
      { id: "D1", distance: 1100, rating: 4.6, status: "ONLINE" },
      { id: "D2", distance: 900, rating: 4.7, status: "ONLINE" },
    ],
    skip_context_tools: true,
  };

  const requests = Array.from({ length: 10 }, () =>
    fetch(`${BASE_URL}/agent/select-driver`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then(async (res) => ({ status: res.status, body: await res.json() }))
  );

  const results = await Promise.all(requests);
  const ok = results.filter((r) => r.status === 200).length;
  console.log(`ok=${ok}`);
  if (ok !== 10) throw new Error(`Expected 10/10 successful responses, got ${ok}`);
}

main().catch((err) => { console.error(err.message || err); process.exit(1); });
