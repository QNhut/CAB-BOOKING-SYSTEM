/**
 * Kafka Dead Letter Queue (DLQ) handler
 * Moves failed messages to a DLQ topic after max retries.
 * 
 * Usage:
 *   const { withDLQ } = require('../shared/kafka-dlq');
 *   await consumer.run({
 *     eachMessage: withDLQ(producer, 'taxi.bookings.dlq', 3, async ({ message }) => {
 *       // process message
 *     })
 *   });
 */

async function sendToDLQ(producer, dlqTopic, message, error, originalTopic) {
  const headers = {
    ...message.headers,
    "x-dlq-original-topic": Buffer.from(originalTopic || "unknown"),
    "x-dlq-error": Buffer.from(error?.message || "unknown"),
    "x-dlq-timestamp": Buffer.from(new Date().toISOString()),
  };

  await producer.send({
    topic: dlqTopic,
    messages: [{
      key: message.key,
      value: message.value,
      headers,
    }],
  });

  console.log(JSON.stringify({
    level: "warn",
    service: "kafka-dlq",
    msg: "message_sent_to_dlq",
    topic: dlqTopic,
    originalTopic,
    error: error?.message,
  }));
}

function withDLQ(producer, dlqTopic, maxRetries = 3, handler) {
  const retryCount = new Map();

  return async (payload) => {
    const { topic, partition, message } = payload;
    const key = `${topic}-${partition}-${message.offset}`;

    try {
      await handler(payload);
      retryCount.delete(key);
    } catch (error) {
      const count = (retryCount.get(key) || 0) + 1;
      retryCount.set(key, count);

      if (count >= maxRetries) {
        console.error(JSON.stringify({
          level: "error",
          service: "kafka-dlq",
          msg: "max_retries_exceeded",
          topic,
          partition,
          offset: message.offset,
          retries: count,
          error: error.message,
        }));
        await sendToDLQ(producer, dlqTopic, message, error, topic);
        retryCount.delete(key);
      } else {
        console.warn(JSON.stringify({
          level: "warn",
          service: "kafka-dlq",
          msg: "retry_scheduled",
          topic,
          retries: count,
          maxRetries,
        }));
        throw error; // re-throw so KafkaJS retries
      }
    }
  };
}

module.exports = { withDLQ, sendToDLQ };
