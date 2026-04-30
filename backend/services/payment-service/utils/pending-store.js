/**
 * In-memory store: orderId → { userId, amount }
 * Used by IPN handler to resolve the userId for a given VNPay transaction
 * so the Kafka event can be routed to the correct user via notification-service.
 *
 * Entries are auto-expired after 2 hours to avoid memory leaks.
 */

const store = new Map(); // orderId -> { userId, amount, expiresAt }
const TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

function save(orderId, userId, amount) {
  store.set(String(orderId), {
    userId: String(userId),
    amount: Number(amount),
    expiresAt: Date.now() + TTL_MS,
  });
}

function get(orderId) {
  const entry = store.get(String(orderId));
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(String(orderId));
    return null;
  }
  return entry;
}

function remove(orderId) {
  store.delete(String(orderId));
}

// Sweep expired entries every 30 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of store) {
    if (now > val.expiresAt) store.delete(key);
  }
}, 30 * 60 * 1000);

module.exports = { save, get, remove };
