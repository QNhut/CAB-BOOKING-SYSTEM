import crypto from "crypto";

const ZIPKIN_URL = process.env.JAEGER_ZIPKIN_URL || "";

function generateTraceId() {
  return crypto.randomBytes(16).toString("hex");
}

function generateSpanId() {
  return crypto.randomBytes(8).toString("hex");
}

function nowMicros() {
  return Date.now() * 1000;
}

async function sendSpan(span) {
  if (!ZIPKIN_URL) return;
  try {
    await fetch(ZIPKIN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([span]),
    });
  } catch {}
}

function buildTraceHeaders(traceContext, parentSpanId = traceContext.spanId) {
  return {
    "x-trace-id": traceContext.traceId,
    "x-request-id": traceContext.requestId,
    "x-parent-span-id": parentSpanId,
  };
}

function getTraceContext(req) {
  return {
    traceId: req.traceId || req.headers["x-trace-id"] || generateTraceId(),
    requestId: req.requestId || req.headers["x-request-id"] || `req_${generateSpanId()}`,
    spanId: req.spanId || req.headers["x-parent-span-id"] || generateSpanId(),
    parentSpanId: req.parentSpanId || req.headers["x-parent-span-id"] || null,
  };
}

function createTracingMiddleware(serviceName) {
  return (req, res, next) => {
    const traceId = req.headers["x-trace-id"] || generateTraceId();
    const requestId = req.headers["x-request-id"] || `req_${generateSpanId()}`;
    const parentSpanId = req.headers["x-parent-span-id"] || null;
    const spanId = generateSpanId();
    const startedAtMicros = nowMicros();

    req.traceId = traceId;
    req.requestId = requestId;
    req.spanId = spanId;
    req.parentSpanId = parentSpanId;

    req.headers["x-trace-id"] = traceId;
    req.headers["x-request-id"] = requestId;
    req.headers["x-parent-span-id"] = parentSpanId || "";

    res.setHeader("X-Trace-Id", traceId);
    res.setHeader("X-Request-Id", requestId);
    res.setHeader("X-Span-Id", spanId);

    res.on("finish", () => {
      sendSpan({
        traceId,
        id: spanId,
        parentId: parentSpanId || undefined,
        name: `${req.method} ${req.route?.path || req.path || req.url}`,
        kind: "SERVER",
        timestamp: startedAtMicros,
        duration: Math.max(nowMicros() - startedAtMicros, 1),
        localEndpoint: { serviceName },
        tags: {
          "http.method": req.method,
          "http.path": req.originalUrl || req.url,
          "http.status_code": String(res.statusCode),
          request_id: requestId,
          trace_id: traceId,
        },
      });
    });

    next();
  };
}

async function withChildSpan({ serviceName, traceContext, name, tags = {} }, fn) {
  const spanId = generateSpanId();
  const startedAtMicros = nowMicros();

  try {
    const result = await fn(buildTraceHeaders(traceContext, spanId), spanId);
    await sendSpan({
      traceId: traceContext.traceId,
      id: spanId,
      parentId: traceContext.spanId || traceContext.parentSpanId || undefined,
      name,
      kind: "CLIENT",
      timestamp: startedAtMicros,
      duration: Math.max(nowMicros() - startedAtMicros, 1),
      localEndpoint: { serviceName },
      tags: {
        ...tags,
        request_id: traceContext.requestId,
        trace_id: traceContext.traceId,
      },
    });
    return result;
  } catch (error) {
    await sendSpan({
      traceId: traceContext.traceId,
      id: spanId,
      parentId: traceContext.spanId || traceContext.parentSpanId || undefined,
      name,
      kind: "CLIENT",
      timestamp: startedAtMicros,
      duration: Math.max(nowMicros() - startedAtMicros, 1),
      localEndpoint: { serviceName },
      tags: {
        ...tags,
        error: error.message,
        request_id: traceContext.requestId,
        trace_id: traceContext.traceId,
      },
    });
    throw error;
  }
}

export {
  buildTraceHeaders,
  createTracingMiddleware,
  generateSpanId,
  generateTraceId,
  getTraceContext,
  withChildSpan,
};
