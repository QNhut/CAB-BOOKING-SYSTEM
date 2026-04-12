import dotenv from "dotenv";
import { Pool } from "pg";
import { createProducer, KAFKA_BOOKING_TOPIC } from "./kafka.js";


dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;
const POLL_MS = Number(process.env.OUTBOX_POLL_MS || 1000);
const BATCH_SIZE = Number(process.env.OUTBOX_BATCH_SIZE || 20);

const pool = new Pool({ connectionString: DATABASE_URL });
const producer = createProducer();
await producer.connect();

async function claimBatch(client) {
  // Claim NEW events to avoid multiple workers processing same rows.
  // Using FOR UPDATE SKIP LOCKED for safe concurrency.
  const { rows } = await client.query(
    `
    WITH cte AS (
      SELECT id
      FROM outbox_events
      WHERE status = 'NEW'
      ORDER BY created_at ASC
      LIMIT $1
      FOR UPDATE SKIP LOCKED
    )
    UPDATE outbox_events o
      SET status = 'SENDING'
    FROM cte
    WHERE o.id = cte.id
    RETURNING o.*;
    `,
    [BATCH_SIZE]
  );
  return rows;
}

async function markSent(client, id) {
  await client.query(
    `UPDATE outbox_events SET status='SENT', sent_at=now() WHERE id=$1`,
    [id]
  );
}

async function markFailed(client, id, errMsg) {
  // MVP: mark FAILED; sau có retry/backoff thì thêm next_retry_at, retry_count...
  await client.query(
    `UPDATE outbox_events SET status='FAILED', payload = jsonb_set(payload, '{error}', to_jsonb($2::text), true)
     WHERE id=$1`,
    [id, errMsg]
  );
}

async function handleEvent(evt) {
  // Chuẩn hoá envelope để consumer dễ đọc
  const message = {
    eventId: evt.id,
    eventType: evt.event_type,
    aggregateType: evt.aggregate_type,
    aggregateId: String(evt.aggregate_id),
    occurredAt: new Date(evt.created_at).toISOString(),
    payload: evt.payload,
  };

  await producer.send({
    topic: KAFKA_BOOKING_TOPIC,
    messages: [
      {
        key: message.aggregateId,              // ordering theo bookingId
        value: JSON.stringify(message),
      },
    ],
  });

  console.log(`[KAFKA] sent ${message.eventType} key=${message.aggregateId}`);
}

async function loop() {
  while (true) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const batch = await claimBatch(client);
      await client.query("COMMIT");

      if (batch.length === 0) {
        await new Promise(r => setTimeout(r, POLL_MS));
        continue;
      }

      for (const evt of batch) {
        const c2 = await pool.connect();
        try {
          await handleEvent(evt);
          await markSent(c2, evt.id);
        } catch (e) {
          await markFailed(c2, evt.id, e.message || "publish failed");
        } finally {
          c2.release();
        }
      }
    } catch (e) {
      try { await client.query("ROLLBACK"); } catch {}
      console.error("Outbox loop error:", e.message);
    } finally {
      client.release();
    }
  }
}

console.log("✅ Outbox worker started");
loop();

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("SIGTERM received, shutting down gracefully...");
  if (producer) {
    await producer.disconnect();
  }
  await pool.end();
  process.exit(0);
});