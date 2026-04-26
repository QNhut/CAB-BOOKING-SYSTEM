import client from "prom-client";

const register = new client.Registry();
client.collectDefaultMetrics({ register });

const httpDuration = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "Duration of HTTP requests in seconds",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
  registers: [register],
});

const httpRequests = new client.Counter({
  name: "http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "route", "status_code"],
  registers: [register],
});

const requestCount = new client.Counter({
  name: "request_count_total",
  help: "Total HTTP requests handled by the gateway",
  labelNames: ["service_name"],
  registers: [register],
});

const requestLatency = new client.Histogram({
  name: "request_latency_seconds",
  help: "HTTP request latency in seconds",
  labelNames: ["service_name", "method", "route", "status_code"],
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
  registers: [register],
});

export function metricsMiddleware(req, res, next) {
  if (req.path === "/metrics" || req.path === "/health") return next();
  const end = httpDuration.startTimer();
  res.on("finish", () => {
    const route = req.route?.path || req.path;
    const labels = { method: req.method, route, status_code: res.statusCode };
    end(labels);
    httpRequests.inc(labels);
    requestCount.inc({ service_name: "api-gateway" });
    requestLatency.observe({ service_name: "api-gateway", ...labels }, Number(res.getHeader("X-Response-Time")) || 0);
  });
  next();
}

export async function metricsEndpoint(_req, res) {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
}
