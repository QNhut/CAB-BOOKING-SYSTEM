function escapeLabelValue(value) {
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n");
}

function createHttpMetrics(serviceName) {
  let requestCount = 0;
  let latencySumSeconds = 0;
  const routeStats = new Map();
  const histogramBuckets = [0.005, 0.01, 0.025, 0.05, 0.1, 0.3, 0.5, 1, 2, 5];
  const histogramCounts = new Array(histogramBuckets.length).fill(0);

  function metricsMiddleware(req, res, next) {
    if (req.path === "/metrics") return next();
    const start = process.hrtime.bigint();
    res.on("finish", () => {
      const durationSeconds = Number(process.hrtime.bigint() - start) / 1e9;
      const route = req.route?.path || req.path || "unknown";
      const key = `${req.method}|${route}|${res.statusCode}`;
      const stat = routeStats.get(key) || {
        method: req.method,
        route,
        statusCode: res.statusCode,
        count: 0,
        latencySumSeconds: 0,
      };

      stat.count += 1;
      stat.latencySumSeconds += durationSeconds;
      routeStats.set(key, stat);

      requestCount += 1;
      latencySumSeconds += durationSeconds;
      for (let i = 0; i < histogramBuckets.length; i += 1) {
        if (durationSeconds <= histogramBuckets[i]) {
          histogramCounts[i] += 1;
        }
      }
    });
    next();
  }

  async function metricsEndpoint(_req, res) {
    const avgLatency = requestCount > 0 ? latencySumSeconds / requestCount : 0;
    const lines = [
      "# HELP request_count_total Total HTTP requests handled by the service",
      "# TYPE request_count_total counter",
      `request_count_total{service_name="${escapeLabelValue(serviceName)}"} ${requestCount}`,
      "# HELP request_latency_seconds_sum Sum of HTTP request latencies in seconds",
      "# TYPE request_latency_seconds_sum counter",
      `request_latency_seconds_sum{service_name="${escapeLabelValue(serviceName)}"} ${latencySumSeconds.toFixed(6)}`,
      "# HELP request_latency_seconds_count Count of HTTP latency samples",
      "# TYPE request_latency_seconds_count counter",
      `request_latency_seconds_count{service_name="${escapeLabelValue(serviceName)}"} ${requestCount}`,
      "# HELP request_latency_seconds_bucket HTTP request latency histogram buckets",
      "# TYPE request_latency_seconds_bucket histogram",
      "# HELP request_latency_seconds_avg Average HTTP request latency in seconds",
      "# TYPE request_latency_seconds_avg gauge",
      `request_latency_seconds_avg{service_name="${escapeLabelValue(serviceName)}"} ${avgLatency.toFixed(6)}`,
      "# HELP http_request_count_total Total HTTP requests by method, route, and status",
      "# TYPE http_request_count_total counter",
    ];

    for (let i = 0; i < histogramBuckets.length; i += 1) {
      lines.push(
        `request_latency_seconds_bucket{service_name="${escapeLabelValue(serviceName)}",le="${histogramBuckets[i]}"} ${histogramCounts[i]}`
      );
    }
    lines.push(
      `request_latency_seconds_bucket{service_name="${escapeLabelValue(serviceName)}",le="+Inf"} ${requestCount}`
    );

    for (const stat of routeStats.values()) {
      lines.push(
        `http_request_count_total{service_name="${escapeLabelValue(serviceName)}",method="${escapeLabelValue(stat.method)}",route="${escapeLabelValue(stat.route)}",status_code="${escapeLabelValue(stat.statusCode)}"} ${stat.count}`
      );
    }

    lines.push(
      "# HELP http_request_latency_seconds_sum Sum of HTTP request latencies by method, route, and status",
      "# TYPE http_request_latency_seconds_sum counter"
    );
    for (const stat of routeStats.values()) {
      lines.push(
        `http_request_latency_seconds_sum{service_name="${escapeLabelValue(serviceName)}",method="${escapeLabelValue(stat.method)}",route="${escapeLabelValue(stat.route)}",status_code="${escapeLabelValue(stat.statusCode)}"} ${stat.latencySumSeconds.toFixed(6)}`
      );
    }

    lines.push(
      "# HELP http_request_latency_seconds_count Count of HTTP latency samples by method, route, and status",
      "# TYPE http_request_latency_seconds_count counter"
    );
    for (const stat of routeStats.values()) {
      lines.push(
        `http_request_latency_seconds_count{service_name="${escapeLabelValue(serviceName)}",method="${escapeLabelValue(stat.method)}",route="${escapeLabelValue(stat.route)}",status_code="${escapeLabelValue(stat.statusCode)}"} ${stat.count}`
      );
    }

    res.set("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
    res.status(200).send(`${lines.join("\n")}\n`);
  }

  return { metricsMiddleware, metricsEndpoint };
}

export { createHttpMetrics };
try { module.exports = { createHttpMetrics }; } catch {}
