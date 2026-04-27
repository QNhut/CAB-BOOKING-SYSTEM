const BASE_URL = process.argv[2] || "http://127.0.0.1:8000";

async function seed(distanceKm, count) {
  for (let i = 0; i < count; i += 1) {
    await fetch(`${BASE_URL}/eta/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ distance_km: distanceKm, traffic_level: 0.35 }),
    });
  }
}

async function main() {
  await seed(1, 90);
  await seed(250, 10);

  const res = await fetch(`${BASE_URL}/eta/drift`);
  const body = await res.json();

  console.log(`status=${res.status}`);
  console.log(`drifted=${body.drifted}`);
  console.log(`alert=${body.alert || ""}`);
  console.log(`samples=${body.samples || 0}`);

  if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
  if (!body.drifted) throw new Error("Expected drift to be detected");
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
