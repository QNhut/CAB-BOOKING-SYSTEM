const crypto = require("crypto");
const { publishPaymentEvent } = require("./kafka");
const { createLogger } = require("../../shared/logger.cjs");

const VALID_PAYMENT_METHODS = new Set(["card", "cash", "vnpay"]);
const idempotencyStore = new Map();
const log = createLogger("payment-service");

function jsonError(res, status, message, extra = {}) {
  return res.status(status).json({ error: message, ...extra });
}

function normalizePaymentMethod(value) {
  if (typeof value !== "string") return null;
  return value.trim().toLowerCase();
}

function maskCardNumber(value) {
  if (!value) return null;
  const digits = String(value).replace(/\D/g, "");
  if (digits.length < 4) return "****";
  return `****${digits.slice(-4)}`;
}

function buildReplayResponse(entry) {
  return {
    ...entry.body,
    idempotent_replay: true,
  };
}

async function handlePayment(req, res) {
  const idempotencyKey = req.header("X-Idempotency-Key");
  if (idempotencyKey && idempotencyStore.has(idempotencyKey)) {
    const cached = idempotencyStore.get(idempotencyKey);
    return res.status(cached.status).json(buildReplayResponse(cached));
  }

  const { user_id, booking_id, amount, payment_method, card_number } = req.body || {};
  const testDelayMs = Number(req.header("X-Test-Delay-Ms") || req.body?.__test_delay_ms || 0);
  if (!user_id || !booking_id || amount === undefined || !payment_method) {
    return jsonError(res, 400, "user_id, booking_id, amount, payment_method are required");
  }
  if (typeof amount !== "number" || Number.isNaN(amount) || amount <= 0) {
    return jsonError(res, 400, "amount must be a positive number");
  }

  const normalizedMethod = normalizePaymentMethod(payment_method);
  if (!normalizedMethod || !VALID_PAYMENT_METHODS.has(normalizedMethod)) {
    return jsonError(res, 400, "Invalid payment method", { valid_payment_methods: [...VALID_PAYMENT_METHODS] });
  }

  const forcedStatus = String(req.header("X-Test-Payment-Status") || "").toUpperCase();
  const shouldFail = forcedStatus === "FAILED";
  const paymentStatus = shouldFail
    ? "FAILED"
    : normalizedMethod === "vnpay"
      ? "PENDING"
      : "SUCCESS";

  const transactionId = crypto.randomUUID();
  const responseBody = {
    transaction_id: transactionId,
    booking_id,
    user_id,
    amount,
    payment_method: normalizedMethod,
    payment_status: paymentStatus,
  };

  if (idempotencyKey) {
    idempotencyStore.set(idempotencyKey, { status: shouldFail ? 402 : 201, body: responseBody });
  }

  const maskedCard = maskCardNumber(card_number);
  if (maskedCard) {
    log.info("payment_request_received", { booking_id, payment_method: normalizedMethod, masked_card: maskedCard, amount, user_id, trace_id: req.traceId || null, request_id: req.requestId || null });
  } else {
    log.info("payment_request_received", { booking_id, payment_method: normalizedMethod, amount, user_id, trace_id: req.traceId || null, request_id: req.requestId || null });
  }

  if (testDelayMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, testDelayMs));
  }

  if (shouldFail) {
    await publishPaymentEvent("PAYMENT_FAILED", {
      orderId: booking_id,
      bookingId: booking_id,
      userId: user_id,
      amount,
      currency: "VND",
      rspCode: "TEST_FAILED",
      transactionNo: transactionId,
      bankCode: "",
      paidAt: new Date().toISOString(),
    }).catch((err) => {
      log.error("payment_failed_event_publish_error", { error: err.message, booking_id });
    });

    return res.status(402).json(responseBody);
  }

  if (paymentStatus === "SUCCESS") {
    await publishPaymentEvent("PAYMENT_COMPLETED", {
      orderId: booking_id,
      bookingId: booking_id,
      userId: user_id,
      amount,
      currency: "VND",
      rspCode: "00",
      transactionNo: transactionId,
      bankCode: "",
      paidAt: new Date().toISOString(),
    }).catch((err) => {
      log.error("payment_completed_event_publish_error", { error: err.message, booking_id });
    });
  }

  return res.status(201).json(responseBody);
}

module.exports = {
  handlePayment,
};
