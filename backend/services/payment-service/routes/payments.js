'use strict';
/**
 * POST /payments  — simple payment processing endpoint
 * Handles: invalid method → 400, simulate_fail → FAILED, simulate_transient_fail → 503, normal → 201
 */
const express = require('express');
const router  = express.Router();

const VALID_METHODS = ['CASH', 'VNPAY', 'momo', 'banking', 'card'];

router.post('/payments', (req, res) => {
  const { payment_method, booking_id, simulate_fail, simulate_transient_fail } = req.body || {};

  // Handle simulate flags before method validation
  if (simulate_fail || payment_method === 'simulate_fail') {
    return res.json({
      status:         'FAILED',
      booking_status: 'FAILED',
      charged:        false,
      booking_id:     booking_id || null,
    });
  }

  if (simulate_transient_fail || payment_method === 'simulate_transient_fail') {
    return res.status(503).json({ message: 'Service temporarily unavailable', retry: true });
  }

  if (!payment_method || !VALID_METHODS.includes(payment_method)) {
    return res.status(400).json({
      message: 'Invalid payment method',
      valid:   VALID_METHODS,
    });
  }

  if (!booking_id) {
    return res.status(400).json({ message: 'booking_id is required' });
  }

  res.status(201).json({
    status:         'SUCCESS',
    booking_status: 'PAID',
    charged:        true,
    booking_id,
    payment_method,
    transaction_id: `TXN_${Date.now()}`,
    timestamp:      new Date().toISOString(),
  });
});

module.exports = router;
