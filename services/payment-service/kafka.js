const { Kafka } = require('kafkajs');
const crypto = require('crypto');
const { createLogger } = require('../../shared/logger.cjs');

const brokers = (process.env.KAFKA_BROKERS || 'kafka:9092').split(',');
const topic   = process.env.KAFKA_PAYMENT_TOPIC || 'taxi.payments';
const log = createLogger('payment-service');

const kafka   = new Kafka({ clientId: 'payment-service', brokers });
const producer = kafka.producer();

let connected = false;

async function connect() {
  if (connected) return;
  await producer.connect();
  connected = true;
  log.info('payment_kafka_producer_connected', { brokers, topic });
}

// Connect eagerly, retry on failure
(async function tryConnect(attempt = 1) {
  try {
    await connect();
  } catch (e) {
    const delay = Math.min(3000 * attempt, 30000);
    log.error('payment_kafka_connect_error', { attempt, error: e.message, retry_delay_ms: delay });
    setTimeout(() => tryConnect(attempt + 1), delay);
  }
})();

/**
 * Publish a payment event to Kafka.
 * @param {string} eventType  e.g. PAYMENT_COMPLETED | PAYMENT_FAILED
 * @param {object} payload
 */
async function publishPaymentEvent(eventType, payload) {
  if (!connected) {
    // Try to reconnect once
    await connect();
  }
  const event = {
    eventId: crypto.randomUUID(),
    eventType,
    aggregateType: 'PAYMENT',
    aggregateId: payload.orderId,
    occurredAt: new Date().toISOString(),
    payload,
  };
  await producer.send({
    topic,
    messages: [{ key: String(payload.orderId), value: JSON.stringify(event) }],
  });
  log.info('payment_event_published', { event_type: eventType, order_id: payload.orderId });
  return event;
}

module.exports = { publishPaymentEvent };
