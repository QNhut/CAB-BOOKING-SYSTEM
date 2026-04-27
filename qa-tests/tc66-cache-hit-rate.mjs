const ETA_URL = process.argv[2] || "http://127.0.0.1:8009";
const PRICING_URL = process.argv[3] || "http://127.0.0.1:8002";

async function hitEta(times) {
  for (let i = 0; i < times; i++) {
    await fetch(`${ETA_URL}/eta/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pickup: { lat: 10.76, lng: 106.66 },
        dropoff: { lat: 10.77, lng: 106.70 },
        traffic_level: 0.5,
      }),
    });
  }
}

async function hitPricing(times) {
  for (let i = 0; i < times; i++) {
    await fetch(`${PRICING_URL}/pricing/estimate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pickup: { lat: 10.76, lng: 106.66 },
        dropoff: { lat: 10.77, lng: 106.70 },
        vehicleType: "CAR_4",
        demand_index: 1.0,
        supply_index: 1.0,
      }),
    });
  }
}

function extractMetric(text, name) {
  const line = text.split("\n").find((x) => x.startsWith(`${name} `));
  return line ? Number(line.split(" ").at(-1)) : 0;
}

async function getEtaStats() {
  const etaMetrics = await fetch(`${ETA_URL}/eta/metrics`).then((r) => r.text());
  return {
    hits: extractMetric(etaMetrics, "eta_cache_hits_total"),
    misses: extractMetric(etaMetrics, "eta_cache_misses_total"),
  };
}

async function getPricingStats() {
  return fetch(`${PRICING_URL}/pricing/cache-stats`).then((r) => r.json());
}

const etaBefore = await getEtaStats();
const pricingBefore = await getPricingStats();

await hitEta(100);
await hitPricing(100);

const etaAfter = await getEtaStats();
const pricingAfter = await getPricingStats();

const etaHits = etaAfter.hits - etaBefore.hits;
const etaMisses = etaAfter.misses - etaBefore.misses;
const etaHitRate = etaHits + etaMisses > 0 ? etaHits / (etaHits + etaMisses) : 0;
const pricingHits = pricingAfter.hits - pricingBefore.hits;
const pricingMisses = pricingAfter.misses - pricingBefore.misses;
const pricingHitRate = pricingHits + pricingMisses > 0 ? pricingHits / (pricingHits + pricingMisses) : 0;

console.log(`eta_hits=${etaHits}`);
console.log(`eta_misses=${etaMisses}`);
console.log(`eta_hit_rate=${etaHitRate}`);
console.log(`pricing_hits=${pricingHits}`);
console.log(`pricing_misses=${pricingMisses}`);
console.log(`pricing_hit_rate=${pricingHitRate}`);

if (etaHitRate < 0.9) throw new Error(`Expected ETA cache hit rate >= 0.9, got ${etaHitRate}`);
if (pricingHitRate < 0.9) throw new Error(`Expected Pricing cache hit rate >= 0.9, got ${pricingHitRate}`);
