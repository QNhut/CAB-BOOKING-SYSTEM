const targetUrl = process.argv[2] || "http://localhost:8000/health";
const concurrency = Number(process.argv[3] || 1000);

async function main() {
  const startedAt = Date.now();
  const results = await Promise.all(
    Array.from({ length: concurrency }, async () => {
      try {
        const res = await fetch(targetUrl);
        return res.status;
      } catch {
        return 0;
      }
    }),
  );

  const durationMs = Date.now() - startedAt;
  const counts = results.reduce((acc, code) => {
    acc[code] = (acc[code] || 0) + 1;
    return acc;
  }, {});

  console.log(`target=${targetUrl}`);
  console.log(`requests=${concurrency}`);
  console.log(`duration_ms=${durationMs}`);
  for (const code of Object.keys(counts).sort((a, b) => Number(a) - Number(b))) {
    console.log(`${code}:${counts[code]}`);
  }
}

main();
