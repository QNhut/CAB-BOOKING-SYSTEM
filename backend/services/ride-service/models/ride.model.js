import { pool } from "../config/database.js";

// ── Processed events (idempotency) ────────────────────────────────────────────
export async function alreadyProcessed(eventId) {
  const r = await pool.query("SELECT 1 FROM processed_events WHERE event_id=$1", [eventId]);
  return r.rowCount > 0;
}

export async function markProcessed(eventId) {
  await pool.query(
    "INSERT INTO processed_events(event_id) VALUES ($1) ON CONFLICT DO NOTHING",
    [eventId]
  );
}

// ── Rides ─────────────────────────────────────────────────────────────────────
export async function getRideForUpdate(client, rideId) {
  return client.query("SELECT * FROM rides WHERE id=$1 FOR UPDATE", [rideId]);
}

export async function insertRide(client, { id, bookingId, userId, candidates, pickup, dropoff, fare, distanceM, durationS, currency, vehicleType }) {
  return client.query(
    `INSERT INTO rides(id, booking_id, user_id, status, candidates, candidate_index, pickup, dropoff, fare, distance_m, duration_s, currency, vehicle_type)
     VALUES ($1,$2,$3,'OFFERING',$4,0,$5,$6,$7,$8,$9,$10,$11)`,
    [id, bookingId, userId || null, JSON.stringify(candidates),
     pickup  ? JSON.stringify(pickup)  : null,
     dropoff ? JSON.stringify(dropoff) : null,
     fare, distanceM, durationS, currency, vehicleType || null]
  );
}

export async function updateRideCandidates(client, { rideId, candidates, pickup, dropoff, fare, distanceM, durationS, currency, vehicleType }) {
  return client.query(
    `UPDATE rides SET candidates=$2, updated_at=now(),
      pickup       = COALESCE(pickup, $3::jsonb),
      dropoff      = COALESCE(dropoff, $4::jsonb),
      fare         = COALESCE(fare, $5),
      distance_m   = COALESCE(distance_m, $6),
      duration_s   = COALESCE(duration_s, $7),
      currency     = COALESCE(currency, $8),
      vehicle_type = COALESCE(vehicle_type, $9)
     WHERE id=$1`,
    [rideId, JSON.stringify(candidates),
     pickup  ? JSON.stringify(pickup)  : null,
     dropoff ? JSON.stringify(dropoff) : null,
     fare, distanceM, durationS, currency, vehicleType || null]
  );
}

export async function setRideNoDriverFound(client, rideId, nextRetry, vehicleType) {
  return client.query(
    `UPDATE rides SET status='NO_DRIVER_FOUND', retry_count=0, next_retry_at=$2, vehicle_type=$3, updated_at=now() WHERE id=$1`,
    [rideId, nextRetry, vehicleType || null]
  );
}

export async function insertRideOffer(client, { offerId, rideId, driverId }) {
  return client.query(
    `INSERT INTO ride_offers(id, ride_id, driver_id, status) VALUES ($1,$2,$3,'OFFERED')`,
    [offerId, rideId, driverId]
  );
}

export async function setRideOffering(client, { rideId, driverId, expiresAt, candidateIndex }) {
  return client.query(
    `UPDATE rides SET current_offer_driver_id=$2, offer_expires_at=$3, candidate_index=$4, updated_at=now() WHERE id=$1`,
    [rideId, driverId, expiresAt, candidateIndex]
  );
}

export async function setRideStatus(rideId, status) {
  return pool.query("UPDATE rides SET status=$2, updated_at=now() WHERE id=$1", [rideId, status]);
}

export async function acceptRideOffer(client, rideId, driverId) {
  return client.query(
    `UPDATE ride_offers SET status='ACCEPTED', responded_at=now() WHERE ride_id=$1 AND driver_id=$2 AND status='OFFERED'`,
    [rideId, driverId]
  );
}

export async function assignDriver(client, rideId, driverId) {
  return client.query(
    `UPDATE rides SET driver_id=$2, status='DRIVER_ASSIGNED', current_offer_driver_id=NULL, offer_expires_at=NULL, updated_at=now() WHERE id=$1`,
    [rideId, driverId]
  );
}

export async function rejectRideOffer(client, rideId, driverId) {
  return client.query(
    `UPDATE ride_offers SET status='REJECTED', responded_at=now() WHERE ride_id=$1 AND driver_id=$2 AND status='OFFERED'`,
    [rideId, driverId]
  );
}

export async function advanceCandidateIndex(client, rideId) {
  return client.query(
    `UPDATE rides SET current_offer_driver_id=NULL, offer_expires_at=NULL, candidate_index=candidate_index+1, updated_at=now() WHERE id=$1 AND status='OFFERING'`,
    [rideId]
  );
}

export async function getExpiredOffers() {
  return pool.query(
    `SELECT id, current_offer_driver_id FROM rides WHERE status='OFFERING' AND offer_expires_at IS NOT NULL AND offer_expires_at < now() LIMIT 20`
  );
}

export async function timeoutOfferRecord(client, rideId, driverId) {
  return client.query(
    `UPDATE ride_offers SET status='TIMEOUT', responded_at=now() WHERE ride_id=$1 AND driver_id=$2 AND status='OFFERED'`,
    [rideId, driverId]
  );
}

export async function setRideNoDriverFoundWithRetry(client, rideId, nextRetry) {
  return client.query(
    `UPDATE rides SET status='NO_DRIVER_FOUND', retry_count=0, next_retry_at=$2, updated_at=now() WHERE id=$1`,
    [rideId, nextRetry]
  );
}

export async function getRidesNeedingRetry() {
  return pool.query(
    `SELECT id, booking_id, pickup, dropoff, retry_count, vehicle_type FROM rides WHERE status='NO_DRIVER_FOUND' AND next_retry_at IS NOT NULL AND next_retry_at <= now() LIMIT 20`
  );
}

export async function setRideOfferingWithCandidates(client, rideId, candidates) {
  return client.query(
    `UPDATE rides SET candidates=$2, status='OFFERING', candidate_index=0, next_retry_at=NULL, retry_count=0, updated_at=now() WHERE id=$1`,
    [rideId, JSON.stringify(candidates)]
  );
}

export async function incrementRetryCount(rideId, nextCount, nextRetry) {
  if (nextRetry) {
    return pool.query(
      `UPDATE rides SET retry_count=$2, next_retry_at=$3, updated_at=now() WHERE id=$1`,
      [rideId, nextCount, nextRetry]
    );
  }
  return pool.query(
    `UPDATE rides SET retry_count=$2, next_retry_at=NULL, updated_at=now() WHERE id=$1`,
    [rideId, nextCount]
  );
}

export async function cancelOfferingRidesByBooking(bookingId) {
  return pool.query(
    `UPDATE rides SET status='CANCELLED', updated_at=now() WHERE booking_id=$1 AND status IN ('OFFERING','NO_DRIVER_FOUND') RETURNING id, current_offer_driver_id`,
    [bookingId]
  );
}

export async function getActiveRideForUser(userId) {
  return pool.query(
    `SELECT * FROM rides WHERE user_id=$1 AND status IN ('OFFERING','DRIVER_ASSIGNED','PICKED_UP','ARRIVING') ORDER BY created_at DESC LIMIT 1`,
    [userId]
  );
}

export async function getActiveRideForDriver(driverId) {
  return pool.query(
    `SELECT * FROM rides WHERE driver_id=$1 AND status IN ('DRIVER_ASSIGNED','PICKED_UP','ARRIVING') ORDER BY created_at DESC LIMIT 1`,
    [driverId]
  );
}

export async function getOfferedRideForDriver(driverId) {
  return pool.query(
    `SELECT * FROM rides WHERE current_offer_driver_id=$1 AND status='OFFERING' AND offer_expires_at > now() ORDER BY created_at DESC LIMIT 1`,
    [driverId]
  );
}

export async function getCompletedRidesForDriver(driverId, limit) {
  return pool.query(
    `SELECT id, booking_id, user_id, driver_id, status, created_at, updated_at FROM rides WHERE driver_id=$1 AND status='COMPLETED' ORDER BY updated_at DESC LIMIT $2`,
    [driverId, limit]
  );
}

export async function getAllRidesAdmin() {
  return pool.query(
    `SELECT id, booking_id, user_id, driver_id, status,
            pickup->>'lat' AS pickup_lat, pickup->>'lng' AS pickup_lng,
            dropoff->>'lat' AS dropoff_lat, dropoff->>'lng' AS dropoff_lng,
            fare, currency, created_at, updated_at
     FROM rides ORDER BY created_at DESC LIMIT 500`
  );
}

export async function getRideById(id) {
  return pool.query("SELECT * FROM rides WHERE id=$1", [id]);
}
