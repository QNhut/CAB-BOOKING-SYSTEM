import { runLoad } from "./lib/load-test.mjs";

const BASE_URL = process.argv[2] || "http://127.0.0.1:8000";
const TOTAL = Number(process.argv[3] || 300);
const CONCURRENCY = Number(process.argv[4] || 300);

const summary = await runLoad({
  name: "TC67 api gateway rate limit",
  total: TOTAL,
  concurrency: CONCURRENCY,
  requestFactory: () => fetch(`${BASE_URL}/health`),
});

if ((summary.statuses["429"] || 0) === 0) {
  throw new Error("Expected some 429 responses from gateway rate limit");
}
