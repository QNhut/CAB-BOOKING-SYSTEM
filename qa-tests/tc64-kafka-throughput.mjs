import { runLoad } from "./lib/load-test.mjs";

const PAYMENT_URL = process.argv[2] || "http://127.0.0.1:8888";
const TOTAL = Number(process.argv[3] || 200);
const CONCURRENCY = Number(process.argv[4] || 50);

await runLoad({
  name: "TC64 kafka throughput via payment events",
  total: TOTAL,
  concurrency: CONCURRENCY,
  requestFactory: (i) =>
    fetch(`${PAYMENT_URL}/payments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Idempotency-Key": `tc64-${Date.now()}-${i}`,
      },
      body: JSON.stringify({
        user_id: `USR_TC64_${i}`,
        booking_id: `BK_TC64_${i}`,
        amount: 50000,
        payment_method: "card",
        card_number: "4111111111111234",
      }),
    }),
});
