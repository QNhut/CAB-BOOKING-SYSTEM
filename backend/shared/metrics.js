/**
 * Shared Prometheus metrics helper for all microservices.
 * Usage:
 *   const { metricsMiddleware, metricsEndpoint } = require('../shared/metrics');
 *   app.use(metricsMiddleware);
 *   app.get('/metrics', metricsEndpoint);
 */
const client = require("prom-client");

// Collect default Node.js metrics (CPU, memory, event loop, etc.)
const register = new client.Registry();
client.collectDefaultMetrics({ register });

// HTTP request duration histogram
const httpDuration = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "Duration of HTTP requests in seconds",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
  registers: [register],
});

// HTTP request counter
const httpRequests = new client.Counter({
  name: "http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "route", "status_code"],
  registers: [register],
});

// Alias counter for test compatibility (TC113)
const requestCount = new client.Counter({
  name: "request_count",
  help: "Total number of HTTP requests (alias for http_requests_total)",
  labelNames: ["method", "route", "status_code"],
  registers: [register],
});

// HTTP request latency histogram (TC113 checks for 'latency' in /metrics output)
const httpLatency = new client.Histogram({
  name: "http_request_latency_ms",
  help: "HTTP request latency in milliseconds",
  labelNames: ["method", "route", "status_code"],
  buckets: [1, 5, 10, 25, 50, 100, 200, 500, 1000, 2000],
  registers: [register],
});

/**
 * Express middleware – records request duration + count.
 */
function metricsMiddleware(req, res, next) {
  if (req.path === "/metrics" || req.path === "/health") return next();
  const end = httpDuration.startTimer();
  const startMs = Date.now();
  res.on("finish", () => {
    const route = req.route?.path || req.path;
    const labels = { method: req.method, route, status_code: res.statusCode };
    end(labels);
    httpRequests.inc(labels);
    requestCount.inc(labels);
    httpLatency.observe(labels, Date.now() - startMs);
  });
  next();
}

/**
 * /metrics endpoint handler
 */
async function metricsEndpoint(_req, res) {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
}

module.exports = { metricsMiddleware, metricsEndpoint, register, client };
