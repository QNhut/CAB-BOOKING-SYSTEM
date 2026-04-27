export async function runLoad({
  name,
  total = 100,
  concurrency = 10,
  requestFactory,
}) {
  const latencies = [];
  const statusCounts = new Map();
  let completed = 0;
  let index = 0;
  const startedAt = Date.now();

  async function worker() {
    while (true) {
      const current = index++;
      if (current >= total) return;
      const stepStart = Date.now();
      try {
        const response = await requestFactory(current);
        const latency = Date.now() - stepStart;
        latencies.push(latency);
        const code = String(response.status);
        statusCounts.set(code, (statusCounts.get(code) || 0) + 1);
      } catch {
        const latency = Date.now() - stepStart;
        latencies.push(latency);
        statusCounts.set("ERROR", (statusCounts.get("ERROR") || 0) + 1);
      }
      completed += 1;
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  const durationMs = Date.now() - startedAt;
  latencies.sort((a, b) => a - b);
  const percentile = (p) => {
    if (latencies.length === 0) return 0;
    const idx = Math.min(latencies.length - 1, Math.floor((p / 100) * latencies.length));
    return latencies[idx];
  };

  const statusObject = Object.fromEntries([...statusCounts.entries()].sort((a, b) => a[0].localeCompare(b[0])));
  const rps = durationMs > 0 ? completed / (durationMs / 1000) : 0;

  console.log(`test_name=${name}`);
  console.log(`total=${total}`);
  console.log(`concurrency=${concurrency}`);
  console.log(`completed=${completed}`);
  console.log(`duration_ms=${durationMs}`);
  console.log(`achieved_rps=${rps.toFixed(2)}`);
  console.log(`p95_ms=${percentile(95)}`);
  console.log(`p99_ms=${percentile(99)}`);
  console.log(`statuses=${JSON.stringify(statusObject)}`);

  return {
    total,
    concurrency,
    completed,
    durationMs,
    achievedRps: rps,
    p95Ms: percentile(95),
    p99Ms: percentile(99),
    statuses: statusObject,
  };
}
