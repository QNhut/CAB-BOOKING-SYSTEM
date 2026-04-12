import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { createProxyMiddleware } from "http-proxy-middleware";
import promClient from "prom-client";

const app = express();
const PORT = Number(process.env.PORT || 8000);

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

import crypto from "crypto";

// ── Security: Helmet (XSS protection, HSTS, etc.) ──────────────────────────
app.use(helmet({
  contentSecurityPolicy: false, // disable for dev — proxied content varies
  crossOriginEmbedderPolicy: false,
}));

// ── Distributed Tracing ────────────────────────────────────────────────────
app.use((req, res, next) => {
  const traceId = req.headers["x-trace-id"] || crypto.randomBytes(16).toString("hex");
  const requestId = req.headers["x-request-id"] || `req_${crypto.randomBytes(8).toString("hex")}`;
  req.headers["x-trace-id"] = traceId;
  req.headers["x-request-id"] = requestId;
  res.setHeader("X-Trace-Id", traceId);
  res.setHeader("X-Request-Id", requestId);
  next();
});

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

// ── Security: Global rate limit (100 req / min / IP) ───────────────────────
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later" },
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
  allowedHeaders: ["Content-Type", "Authorization", "X-Idempotency-Key"],
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
const metricsRegister = new promClient.Registry();
promClient.collectDefaultMetrics({ register: metricsRegister });
const httpDuration = new promClient.Histogram({
  name: "http_request_duration_seconds",
  help: "Duration of HTTP requests in seconds",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
  registers: [metricsRegister],
});
app.use((req, res, next) => {
  if (req.path === "/metrics" || req.path === "/health") return next();
  const end = httpDuration.startTimer();
  res.on("finish", () => end({ method: req.method, route: req.route?.path || req.path, status_code: res.statusCode }));
  next();
});
app.get("/metrics", async (_req, res) => {
  res.set("Content-Type", metricsRegister.contentType);
  res.end(await metricsRegister.metrics());
});

// ── Proxy factory ────────────────────────────────────────────────────────────
function proxy(target) {
  return createProxyMiddleware({
    target,
    changeOrigin: true,
    logLevel: "warn",
    on: {
      error(err, _req, res) {
        console.error(`[GW] proxy error → ${target}:`, err.message);
        if (res && !res.headersSent) {
          res.statusCode = 502;
          res.end(JSON.stringify({ error: "upstream unavailable", upstream: target }));
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
      // Forward real IP
      const ip = req.socket?.remoteAddress || "";
      proxyReq.setHeader("x-forwarded-for", ip);
    },
    error(err, _req, res) {
      console.error("[GW] SSE proxy error:", err.message);
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

// rides + user ride views (ride-service handles both /rides and /users paths)
app.use("/rides",    proxy(RIDE_URL));
app.use("/users",    proxy(RIDE_URL));

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
  on: {
    error(err, _req, res) {
      console.error(`[GW] proxy error → ${PAYMENT_URL}:`, err.message);
      if (res && !res.headersSent) {
        res.statusCode = 502;
        res.end(JSON.stringify({ error: "upstream unavailable", upstream: PAYMENT_URL }));
      }
    },
  },
}));

// ── 404 fallback ─────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `No route for ${req.method} ${req.path}` });
});

app.listen(PORT, () => {
  console.log(`✅ API Gateway listening on http://0.0.0.0:${PORT}`);
  console.log("  Routes:");
  console.log(`    /auth, /internal  → ${AUTH_URL}`);
  console.log(`    /bookings         → ${BOOKING_URL}`);
  console.log(`    /pricing          → ${PRICING_URL}`);
  console.log(`    /drivers          → ${DRIVER_URL}`);
  console.log(`    /rides, /users    → ${RIDE_URL}`);
  console.log(`    /notifications    → ${NOTIF_URL}  (SSE)`);
  console.log(`    /eta              → ${ETA_URL}`);
  console.log(`    /fraud            → ${FRAUD_URL}`);
  console.log(`    /geo              → ${GEO_URL}`);
  console.log(`    /payment          → ${PAYMENT_URL}`);
});
