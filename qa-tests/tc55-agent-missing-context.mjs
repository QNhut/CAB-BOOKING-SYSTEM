const BASE_URL = process.argv[2] || "http://127.0.0.1:8000";

async function main() {
  const res = await fetch(`${BASE_URL}/agent/context`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      pickup: { lat: 10.76, lng: 106.66 },
      dropoff: { lat: 10.77, lng: 106.70 },
    }),
  });
  const body = await res.json();
  console.log(`status=${res.status}`);
  console.log(`has_context=${Boolean(body.pickup && body.dropoff)}`);
  if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
  if (!body.pickup || !body.dropoff) throw new Error("Expected fallback/default context");
}

main().catch((err) => { console.error(err.message || err); process.exit(1); });
