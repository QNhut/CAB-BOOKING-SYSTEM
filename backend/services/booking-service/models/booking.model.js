import { pool } from "../config/database.js";

export async function getActiveBooking(userId) {
  return pool.query(
    `SELECT * FROM bookings
     WHERE user_id = $1
       AND status IN ('PAID', 'MATCHED', 'WAITING_PAYMENT', 'DRIVER_ASSIGNED')
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId]
  );
}

export async function insertBooking(client, row) {
  return client.query(
    `INSERT INTO bookings (
       id, user_id, status, payment_method, payment_status,
       pickup_lat, pickup_lng, pickup_address,
       dropoff_lat, dropoff_lng, dropoff_address,
       vehicle_type, distance_m, duration_s, fare, currency,
       idempotency_key
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
    [
      row.id, row.userId, row.status, row.paymentMethod, row.paymentStatus,
      row.pickup.lat, row.pickup.lng, row.pickup.address || null,
      row.dropoff.lat, row.dropoff.lng, row.dropoff.address || null,
      row.vehicleType, row.distanceM, row.durationS, row.fare, row.currency,
      row.idempotencyKey || null,
    ]
  );
}

export async function insertStatusHistory(client, id, bookingId, fromStatus, toStatus, reason) {
  return client.query(
    `INSERT INTO booking_status_history (id, booking_id, from_status, to_status, reason)
     VALUES ($1,$2,$3,$4,$5)`,
    [id, bookingId, fromStatus, toStatus, reason]
  );
}

export async function insertOutboxEvent(client, id, aggregateType, aggregateId, eventType, payload) {
  return client.query(
    `INSERT INTO outbox_events (id, aggregate_type, aggregate_id, event_type, payload)
     VALUES ($1,$2,$3,$4,$5::jsonb)`,
    [id, aggregateType, aggregateId, eventType, JSON.stringify(payload)]
  );
}

export async function findIdempotent(client, key) {
  return client.query(
    `SELECT id, status FROM bookings WHERE idempotency_key = $1 LIMIT 1`,
    [key]
  );
}

export async function getBookingById(id) {
  return pool.query("SELECT * FROM bookings WHERE id = $1", [id]);
}

export async function getUserBookingHistory(userId, limit) {
  return pool.query(
    `SELECT id, status, payment_method,
            pickup_lat, pickup_lng, pickup_address,
            dropoff_lat, dropoff_lng, dropoff_address,
            vehicle_type, fare, currency, distance_m, duration_s,
            ride_id, driver_id, created_at, updated_at
     FROM bookings
     WHERE user_id = $1 AND status = 'COMPLETED'
     ORDER BY updated_at DESC
     LIMIT $2`,
    [userId, limit]
  );
}

export async function getUserBookings(userId, limit) {
  return pool.query(
    `SELECT id, status, fare, currency, created_at
     FROM bookings
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [userId, limit || 50]
  );
}

export async function updateBookingStatusById(id, status) {
  return pool.query(
    `UPDATE bookings SET status=$2, updated_at=now() WHERE id=$1 RETURNING id, status`,
    [id, status]
  );
}

export async function batchGetBookings(ids) {
  const placeholders = ids.map((_, i) => `$${i + 1}`).join(",");
  return pool.query(
    `SELECT id, pickup_lat, pickup_lng, pickup_address,
            dropoff_lat, dropoff_lng, dropoff_address,
            fare, currency, distance_m, duration_s, vehicle_type, updated_at, created_at
     FROM bookings WHERE id IN (${placeholders})`,
    ids
  );
}

export async function getOutboxEvents(status) {
  return pool.query(
    "SELECT * FROM outbox_events WHERE status = $1 ORDER BY created_at ASC LIMIT 50",
    [status]
  );
}

export async function findBookingForCancel(id) {
  return pool.query(`SELECT id, user_id, status FROM bookings WHERE id = $1`, [id]);
}

export async function cancelBooking(id) {
  return pool.query(`UPDATE bookings SET status='CANCELLED', updated_at=now() WHERE id=$1`, [id]);
}

export async function cancelExpiredBookings(expireMinutes) {
  return pool.query(
    `UPDATE bookings
     SET status='CANCELLED', updated_at=now()
     WHERE status IN ('PAID','WAITING_PAYMENT')
       AND created_at < now() - interval '${expireMinutes} minutes'
     RETURNING id, user_id`
  );
}
