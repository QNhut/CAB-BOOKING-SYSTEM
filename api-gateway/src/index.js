import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { createProxyMiddleware } from "http-proxy-middleware";
import { metricsEndpoint, metricsMiddleware } from "./metrics.js";
import { createLogger } from "../../shared/logger.js";
import { createTracingMiddleware } from "../../shared/jaeger-tracing.js";

const app = express();
const PORT = Number(process.env.PORT || 8000);
const log = createLogger("api-gateway");

// ── Upstream service URLs ───────────────────────────────────────────────────
const AUTH_URL    = process.env.AUTH_URL    || "http://auth-service:8001";
const BOOKING_URL = process.env.BOOKING_URL || "http://booking-service:8003";
const PRICING_URL = process.env.PRICING_URL || "http://pricing-service:8002";
const DRIVER_URL  = process.env.DRIVER_URL  || "http://driver-service:8004";
const RIDE_URL    = process.env.RIDE_URL    || "http://ride-service:8005";
const NOTIF_URL   = process.env.NOTIF_URL   || "http://notification-service:8006";
const GEO_URL     = process.env.GEO_URL     || "http://geo-service:8007";
const PAYMENT_URL = process.env.PAYMENT_URL || "http://payment-service:8888";
const ETA_URL     = process.env.ETA_URL     || "http://eta-service:8009";
const FRAUD_URL   = process.env.FRAUD_URL   || "http://fraud-service:8010";
const REVIEW_URL  = process.env.REVIEW_URL  || "http://review-service:8011";
const AGENT_URL   = process.env.AGENT_URL   || "http://agent-service:8012";
const USER_URL    = process.env.USER_URL    || "http://user-service:8013";
const PROXY_TIMEOUT_MS = Number(process.env.GATEWAY_PROXY_TIMEOUT_MS || 15000);

// ── Security: Helmet (XSS protection, HSTS, etc.) ──────────────────────────
app.use(helmet({
  contentSecurityPolicy: false, // disable for dev — proxied content varies
  crossOriginEmbedderPolicy: false,
}));

// ── Distributed Tracing ────────────────────────────────────────────────────
app.use(createTracingMiddleware("api-gateway"));

// ── Security: Body size limit (reject >1 MB payloads) ───────────────────────
// NOTE: Do NOT use express.json() here — it consumes the request body stream
//       and prevents http-proxy-middleware from forwarding POST/PUT/PATCH bodies.
//       Each upstream service parses its own JSON body.
app.use((req, res, next) => {
  const len = parseInt(req.headers["content-length"] || "0", 10);
  if (len > 1_048_576) {           // 1 MB
    return res.status(413).json({ error: "Payload Too Large" });
  }
  next();
});

// ── Security: Burst rate limit (100 req / sec / IP) ────────────────────────
const burstLimiter = rateLimit({
  windowMs: 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many requests, please try again later",
    limiter: "burst_per_second",
  },
});
app.use(burstLimiter);

// ── Security: Global rate limit (200 req / min / IP) ───────────────────────
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many requests, please try again later",
    limiter: "global_per_minute",
  },
});
app.use(globalLimiter);

// ── Security: Strict rate limit for auth endpoints (10 req / min / IP) ─────
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts, please try again later" },
});

// ── CORS ────────────────────────────────────────────────────────────────────
app.use(cors({
  origin: "*",
  allowedHeaders: ["Content-Type", "Authorization", "X-Idempotency-Key", "X-Trace-Id", "X-Request-Id", "X-Parent-Span-Id"],
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
}));

// ── Health check ────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "api-gateway",
    upstreams: { AUTH_URL, BOOKING_URL, PRICING_URL, DRIVER_URL, RIDE_URL, NOTIF_URL, GEO_URL, ETA_URL, FRAUD_URL },
  });
});

// ── Prometheus Metrics ──────────────────────────────────────────────────────
app.use(metricsMiddleware);
app.get("/metrics", metricsEndpoint);

// ── Proxy factory ────────────────────────────────────────────────────────────
function proxy(target) {
  return createProxyMiddleware({
    target,
    changeOrigin: true,
    logLevel: "warn",
    proxyTimeout: PROXY_TIMEOUT_MS,
    timeout: PROXY_TIMEOUT_MS,
    on: {
      proxyReq(proxyReq, req) {
        if (req.traceId) proxyReq.setHeader("x-trace-id", req.traceId);
        if (req.requestId) proxyReq.setHeader("x-request-id", req.requestId);
        if (req.spanId) proxyReq.setHeader("x-parent-span-id", req.spanId);
      },
      error(err, _req, res) {
        log.error("proxy_error", { upstream: target, error: err.message });
        if (res && !res.headersSent) {
          const isTimeout = err?.code === "ETIMEDOUT" || err?.code === "ECONNRESET";
          res.statusCode = isTimeout ? 504 : 502;
          res.end(JSON.stringify({
            error: isTimeout ? "upstream timeout" : "upstream unavailable",
            upstream: target,
          }));
        }
      },
    },
  });
}

// ── SSE proxy (notification-service) ─────────────────────────────────────────
// Must NOT buffer — flush headers immediately so EventSource works
const sseProxy = createProxyMiddleware({
  target: NOTIF_URL,
  changeOrigin: true,
  logLevel: "warn",
  selfHandleResponse: false,
  proxyTimeout: 0,      // disable timeout for long-lived SSE connections
  timeout: 0,
  on: {
    proxyReq(proxyReq, req) {
      const ip = req.socket?.remoteAddress || "";
      proxyReq.setHeader("x-forwarded-for", ip);
      if (req.traceId) proxyReq.setHeader("x-trace-id", req.traceId);
      if (req.requestId) proxyReq.setHeader("x-request-id", req.requestId);
      if (req.spanId) proxyReq.setHeader("x-parent-span-id", req.spanId);
    },
    error(err, _req, res) {
      log.error("sse_proxy_error", { upstream: NOTIF_URL, error: err.message });
      if (res && !res.headersSent) {
        res.statusCode = 502;
        res.end("data: {\"error\":\"upstream unavailable\"}\n\n");
      }
    },
  },
});

// ── Route table ──────────────────────────────────────────────────────────────
// auth + internal profile lookups (rate limited)
app.use("/auth/login",  authLimiter);
app.use("/auth/register", authLimiter);
app.use("/auth",     proxy(AUTH_URL));
app.use("/internal", proxy(AUTH_URL));

// bookings
app.use("/bookings", proxy(BOOKING_URL));

// pricing
app.use("/pricing",  proxy(PRICING_URL));

// driver ride views (must come BEFORE generic /drivers — ride-service handles these)
app.use("/drivers/me/rides", proxy(RIDE_URL));

// driver management
app.use("/drivers",  proxy(DRIVER_URL));

// rides + user ride views
app.use("/rides",    proxy(RIDE_URL));
app.use("/users/me/rides", proxy(RIDE_URL));

// SSE notifications (must come before generic catch-all)
app.use("/notifications", sseProxy);

// geo / autocomplete
app.use("/geo",      proxy(GEO_URL));

// ETA prediction service
app.use("/eta",      proxy(ETA_URL));

// Fraud detection service
app.use("/fraud",    proxy(FRAUD_URL));

// Review service
app.use("/reviews",  proxy(REVIEW_URL));
app.use("/agent",    proxy(AGENT_URL));

// User service (preferences, saved locations)
app.use("/users",    proxy(USER_URL));

// payment (VNPay etc) — strip /payment prefix before forwarding
app.use("/payment", createProxyMiddleware({
  target: PAYMENT_URL,
  changeOrigin: true,
  pathRewrite: { "^/payment": "" },
  proxyTimeout: PROXY_TIMEOUT_MS,
  timeout: PROXY_TIMEOUT_MS,
  on: {
    proxyReq(proxyReq, req) {
      if (req.traceId) proxyReq.setHeader("x-trace-id", req.traceId);
      if (req.requestId) proxyReq.setHeader("x-request-id", req.requestId);
      if (req.spanId) proxyReq.setHeader("x-parent-span-id", req.spanId);
    },
    error(err, _req, res) {
      log.error("proxy_error", { upstream: PAYMENT_URL, error: err.message });
      if (res && !res.headersSent) {
        const isTimeout = err?.code === "ETIMEDOUT" || err?.code === "ECONNRESET";
        res.statusCode = isTimeout ? 504 : 502;
        res.end(JSON.stringify({
          error: isTimeout ? "upstream timeout" : "upstream unavailable",
          upstream: PAYMENT_URL,
        }));
      }
    },
  },
}));

// ── 404 fallback ─────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `No route for ${req.method} ${req.path}` });
});

app.listen(PORT, () => {
  log.info("gateway_started", {
    port: PORT,
    routes: {
      auth: AUTH_URL,
      internal: AUTH_URL,
      bookings: BOOKING_URL,
      pricing: PRICING_URL,
      drivers: DRIVER_URL,
      rides: RIDE_URL,
      notifications: NOTIF_URL,
      eta: ETA_URL,
      fraud: FRAUD_URL,
      geo: GEO_URL,
      payment: PAYMENT_URL,
      agent: AGENT_URL,
      users: USER_URL,
    },
  });
});
