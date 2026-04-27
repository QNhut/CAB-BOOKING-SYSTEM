const BASE_URL = process.argv[2] || "http://127.0.0.1:8000";
const ETA_BASE = process.argv[3] || "http://127.0.0.1:8009";

async function main() {
  await fetch(`${BASE_URL}/eta/predict`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ distance_km: 5, traffic_level: 0.35 }),
  });

  const [modelRes, driftRes, metricsRes] = await Promise.all([
    fetch(`${BASE_URL}/eta/model-info`),
    fetch(`${BASE_URL}/eta/drift`),
    fetch(`${ETA_BASE}/eta/metrics`),
  ]);

  const model = await modelRes.json();
  const drift = await driftRes.json();
  const metrics = await metricsRes.text();

  console.log(`model_version=${model.model_version || ""}`);
  console.log(`drift_samples=${drift.samples || 0}`);
  console.log(`has_eta_predictions_total=${metrics.includes('eta_predictions_total')}`);
  console.log(`has_eta_model_version=${metrics.includes('eta_model_version')}`);
  console.log(`has_eta_drift_detected=${metrics.includes('eta_drift_detected')}`);

  if (!model.model_version) throw new Error("Missing model_version");
  if (!metrics.includes("eta_predictions_total")) throw new Error("Missing eta_predictions_total metric");
  if (!metrics.includes("eta_model_version")) throw new Error("Missing eta_model_version metric");
  if (!metrics.includes("eta_drift_detected")) throw new Error("Missing eta_drift_detected metric");
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
