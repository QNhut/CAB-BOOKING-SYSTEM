const BASE_URL = process.argv[2] || "http://127.0.0.1:8888";
const PROM_URL = process.argv[3] || "http://127.0.0.1:9090";

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function createSlowPayments() {
  const tasks = [];
  for (let i = 0; i < 18; i += 1) {
    tasks.push(fetch(`${BASE_URL}/payments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Test-Delay-Ms": "900",
        "X-Idempotency-Key": `latency-${Date.now()}-${i}`,
      },
      body: JSON.stringify({
        user_id: "USR_LATENCY",
        booking_id: `BK_LATENCY_${Date.now()}_${i}`,
        amount: 50000,
        payment_method: "card",
        card_number: "4111111111111234",
      }),
    }).catch(() => null));
  }
  await Promise.all(tasks);
}

async function getRuleState() {
  const res = await fetch(`${PROM_URL}/api/v1/rules`);
  const json = await res.json();
  const groups = json?.data?.groups || [];
  for (const group of groups) {
    for (const rule of group.rules || []) {
      if (rule.name === "HighLatency") {
        return {
          state: rule.state,
          alerts: rule.alerts || [],
        };
      }
    }
  }
  return null;
}

async function main() {
  console.log("triggering slow payment traffic for HighLatency...");
  await createSlowPayments();
  await sleep(35000);
  await createSlowPayments();
  await sleep(20000);

  const rule = await getRuleState();
  const match = rule?.alerts?.[0];

  console.log(`rule_state=${rule?.state || ""}`);
  console.log(`high_latency_alert_state=${match?.state || ""}`);
  console.log(`high_latency_service=${match?.labels?.service_name || ""}`);

  if (!rule || !["pending", "firing"].includes(rule.state)) {
    throw new Error("HighLatency rule did not enter pending/firing state");
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
