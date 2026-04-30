/**
 * Distributed Tracing Middleware – shared utility
 * Generates or propagates X-Trace-Id and X-Request-Id headers across services.
 * 
 * Usage (ESM):
 *   import { tracingMiddleware } from '../shared/tracing.js';
 *   app.use(tracingMiddleware);
 *
 * Usage (CommonJS):
 *   const { tracingMiddleware } = require('../shared/tracing');
 */
const crypto = require("crypto");

function generateTraceId() {
  return crypto.randomBytes(16).toString("hex");
}

function generateSpanId() {
  return crypto.randomBytes(8).toString("hex");
}

/**
 * Express middleware — propagates or creates trace_id + request_id.
 * Adds them to response headers and req object.
 */
function tracingMiddleware(req, res, next) {
  const traceId = req.headers["x-trace-id"] || generateTraceId();
  const requestId = req.headers["x-request-id"] || `req_${generateSpanId()}`;
  const spanId = generateSpanId();

  req.traceId = traceId;
  req.requestId = requestId;
  req.spanId = spanId;

  res.setHeader("X-Trace-Id", traceId);
  res.setHeader("X-Request-Id", requestId);
  res.setHeader("X-Span-Id", spanId);

  next();
}

module.exports = { tracingMiddleware, generateTraceId, generateSpanId };
