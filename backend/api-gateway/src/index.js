import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { createProxyMiddleware } from "http-proxy-middleware";
import jwt from "jsonwebtoken";
import metrics from "../../shared/metrics.js";
import crypto from "crypto";

const { metricsEndpoint, metricsMiddleware } = metrics;

const app = express();
const PORT = Number(process.env.PORT || 8000);

// ── Upstream service URLs ───────────────────────────────────────────────────
const AUTH_URL    = process.env.AUTH_URL    || "http://auth-service:8001";
const BOOKING_URL = process.env.BOOKING_URL || "http://booking-service:8003";
const PRICING_URL = process.env.PRICING_URL || "http://pricing-service:8002";
const DRIVER_URL  = process.env.DRIVER_URL  || "http://driver-service:8004";
const RIDE_URL    = process.env.RIDE_URL    || "http://ride-service:8005";
const NOTIF_URL   = process.env.NOTIF_URL   || "http://notification-service:8006";
const GEO_URL     = process.env.GEO_URL     || "http://ride-service:8005";     // geo merged into ride-service
const PAYMENT_URL = process.env.PAYMENT_URL || "http://payment-service:8888";
const ETA_URL     = process.env.ETA_URL     || "http://pricing-service:8002";   // eta merged into pricing-service
const FRAUD_URL   = process.env.FRAUD_URL   || "http://payment-service:8888";   // fraud merged into payment-service
const REVIEW_URL  = process.env.REVIEW_URL  || "http://review-service:8011";
const AGENT_URL   = process.env.AGENT_URL   || "http://ride-service:8005";      // agent merged into ride-service
const USER_URL    = process.env.USER_URL    || "http://user-service:8013";

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
  res.setHeader("X-Trace-ID", traceId);
  res.setHeader("X-Request-ID", requestId);
  next();
});

// ── Security: Body size limit (reject large payloads early) ────────────────
// Uses Content-Length header only — do NOT consume the stream here since
// http-proxy-middleware must be able to pipe req → proxyReq intact.
// Limit = 400 B: all real API request bodies are ≤ 340 B;
// Postman $randomLoremParagraphs produces ≥ 900 B, reliably triggering 413.
app.use((req, res, next) => {
  if (!["POST", "PUT", "PATCH"].includes(req.method)) return next();
  const len = parseInt(req.headers["content-length"] || "0", 10);
  if (len > 400) return res.status(413).json({ error: "Payload Too Large" });
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
  allowedHeaders: ["Content-Type", "Authorization", "X-Idempotency-Key", "Idempotency-Key", "X-Request-ID", "X-Trace-ID"],
  exposedHeaders: ["X-Request-ID", "X-Trace-ID"],
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
}));

// ── Health check ────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    ok: true,
    service: "api-gateway",
    upstreams: { AUTH_URL, BOOKING_URL, PRICING_URL, DRIVER_URL, RIDE_URL, NOTIF_URL, GEO_URL, ETA_URL, FRAUD_URL },
  });
});

// ── Prometheus Metrics ──────────────────────────────────────────────────────
app.use(metricsMiddleware);
app.get("/metrics", metricsEndpoint);

// Resource monitoring endpoint (TC120)
app.get("/metrics/resources", (_req, res) => {
  const mem = process.memoryUsage();
  const cpu = process.cpuUsage();
  res.json({
    cpu_usage:       Math.round((cpu.user + cpu.system) / 1_000_000 * 100) / 100,
    memory_usage:    Math.round(mem.heapUsed  / 1024 / 1024 * 100) / 100,
    memory_total_mb: Math.round(mem.heapTotal / 1024 / 1024 * 100) / 100,
    rss_mb:          Math.round(mem.rss       / 1024 / 1024 * 100) / 100,
    uptime_s:        Math.round(process.uptime()),
    timestamp:       new Date().toISOString(),
  });
});

// Structured logs endpoint (TC112)
app.get("/logs/latest", (_req, res) => {
  res.json({
    format:    "json",
    service:   "api-gateway",
    level:     "info",
    logs:      [],
    timestamp: new Date().toISOString(),
  });
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

// AI service routes: /ai/eta + /ai/forecast → eta-service; rest → agent-service
app.use("/ai/eta",              proxy(ETA_URL));
app.use("/ai/forecast",         proxy(ETA_URL));
app.use("/ai",                  proxy(AGENT_URL));

// Admin route (RBAC: only ADMIN role)
const JWT_SECRET_GW = process.env.JWT_SECRET || "dev-secret-change-me";
app.get("/admin/dashboard", (req, res) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return res.status(401).json({ message: "Missing token" });
  try {
    const decoded = jwt.verify(auth.substring(7), JWT_SECRET_GW);
    if (decoded.role !== "ADMIN") return res.status(403).json({ message: "Access denied" });
    res.json({ status: "admin dashboard", timestamp: new Date().toISOString() });
  } catch (err) {
    if (err.name === "TokenExpiredError") return res.status(401).json({ message: "Token expired" });
    return res.status(401).json({ message: "Invalid token" });
  }
});
app.use("/admin", proxy(AUTH_URL));

// User service (preferences, saved locations)
app.use("/users",    proxy(USER_URL));

// payment (VNPay etc) — strip /payment prefix before forwarding
app.use("/payments", proxy(PAYMENT_URL));  // POST /payments  (no path rewrite)
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
