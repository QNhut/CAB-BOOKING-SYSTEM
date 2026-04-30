import crypto from "crypto";
import axios from "axios";
import { CircuitBreaker } from "../../../../shared/circuit-breaker.js";
import { reverseGeocode, parseLatLng, DEFAULT_LANG } from "./geo.service.js";
import { createLogger } from "../../../../shared/logger.js";
import { pool } from "../config/database.js";
import { producer, RIDE_TOPIC, BOOKING_TOPIC } from "../config/kafka.js";
import { tryLockDriver, unlockDriver } from "../config/redis.js";
import {
  getRideForUpdate, insertRideOffer, setRideOffering, setRideNoDriverFoundWithRetry,
  timeoutOfferRecord, advanceCandidateIndex, setRideOfferingWithCandidates,
  getRidesNeedingRetry, incrementRetryCount, getExpiredOffers,
} from "../models/ride.model.js";

export const log = createLogger("ride-service");

const DRIVER_BASE_URL = process.env.DRIVER_BASE_URL || "http://driver-service:8004";
const AUTH_BASE_URL   = process.env.AUTH_BASE_URL   || "http://auth-service:8001";

export const OFFER_TIMEOUT_SEC          = Number(process.env.OFFER_TIMEOUT_SEC || 60);
export const DRIVER_RETRY_INTERVAL_SEC  = Number(process.env.DRIVER_RETRY_INTERVAL_SEC || 10);
export const DRIVER_RETRY_MAX_ATTEMPTS  = Number(process.env.DRIVER_RETRY_MAX_ATTEMPTS || 12);

// Circuit breakers
export const cbAuth    = new CircuitBreaker("auth-service",   { failureThreshold: 5, resetTimeout: 30000 });
export const cbDriver  = new CircuitBreaker("driver-service", { failureThreshold: 5, resetTimeout: 30000 });
export const cbBooking = new CircuitBreaker("booking-service",{ failureThreshold: 5, resetTimeout: 30000 });

export async function resolveAddress(location) {
  if (!location?.lat || !location?.lng) return null;
  const existing = (location.address || "").trim();
  if (existing && !existing.startsWith("Vị trí hiện tại") && existing.length > 8) return existing;
  try {
    const ll = parseLatLng(location.lat, location.lng);
    if (!ll) return existing || null;
    const results = await reverseGeocode(ll, DEFAULT_LANG);
    const r = results[0] || {};
    return r.formatted || r.address_line1 || existing || `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`;
  } catch (e) {
    log.warn("geo reverse failed", { error: e.message });
    return existing || `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`;
  }
}

export async function fetchUserProfile(userId) {
  try {
    const resp = await cbAuth.exec(() => axios.get(`${AUTH_BASE_URL}/internal/profile/user/${userId}`, { timeout: 2000 }));
    return resp.data;
  } catch { return null; }
}

export async function fetchDriverProfile(driverId) {
  try {
    const resp = await cbAuth.exec(() => axios.get(`${AUTH_BASE_URL}/internal/profile/driver/${driverId}`, { timeout: 2000 }));
    return resp.data;
  } catch { return null; }
}

export async function fetchNearbyDrivers(pickup, vehicleType) {
  const resp = await cbDriver.exec(() => axios.get(`${DRIVER_BASE_URL}/drivers/nearby`, {
    params: { lat: pickup.lat, lng: pickup.lng, radiusM: 3000, vehicleType, limit: 20 },
    timeout: 3000,
  }));
  return resp.data?.drivers || [];
}

export async function setDriverState(driverId, state) {
  return cbDriver.exec(() => axios.post(
    `${DRIVER_BASE_URL}/internal/drivers/${driverId}/state`,
    { state }, { timeout: 3000 }
  ));
}

export async function publishEvent(eventType, aggregateId, payload) {
  const evt = {
    eventId: crypto.randomUUID(), eventType,
    aggregateType: "RIDE", aggregateId,
    occurredAt: new Date().toISOString(), payload,
  };
  await producer.send({
    topic: RIDE_TOPIC,
    messages: [{ key: String(aggregateId), value: JSON.stringify(evt) }],
  });
  return evt;
}

export async function offerNextDriver(rideId) {
  const client = await pool.connect();
  let lockedDriverId = null;

  try {
    await client.query("BEGIN");

    const r = await getRideForUpdate(client, rideId);
    if (!r.rowCount) throw new Error("ride not found");

    const ride = r.rows[0];
    if (ride.status !== "OFFERING") { await client.query("COMMIT"); return; }

    const candidates = ride.candidates || [];
    let idx = ride.candidate_index || 0;

    while (idx < candidates.length) {
      const driverId = candidates[idx].driverId;
      const locked = await tryLockDriver(driverId, OFFER_TIMEOUT_SEC + 5);
      if (!locked) { idx += 1; continue; }
      lockedDriverId = driverId;

      const offerId    = crypto.randomUUID();
      const expiresAt  = new Date(Date.now() + OFFER_TIMEOUT_SEC * 1000).toISOString();

      await insertRideOffer(client, { offerId, rideId, driverId });
      await setRideOffering(client, { rideId, driverId, expiresAt, candidateIndex: idx });
      await client.query("COMMIT");

      const [pickupAddress, dropoffAddress, userProfile] = await Promise.all([
        resolveAddress(ride.pickup),
        resolveAddress(ride.dropoff),
        fetchUserProfile(ride.user_id),
      ]);

      await publishEvent("RIDE_OFFERED_TO_DRIVER", rideId, {
        rideId, bookingId: ride.booking_id, driverId, expiresInSec: OFFER_TIMEOUT_SEC,
        pickup:  ride.pickup  ? { lat: ride.pickup.lat,  lng: ride.pickup.lng,  address: pickupAddress  } : null,
        dropoff: ride.dropoff ? { lat: ride.dropoff.lat, lng: ride.dropoff.lng, address: dropoffAddress } : null,
        fare: ride.fare != null ? Number(ride.fare) : null,
        distanceM: ride.distance_m ?? null,
        durationS: ride.duration_s ?? null,
        currency: ride.currency || "VND",
        userProfile: userProfile ? { full_name: userProfile.full_name || null, phone: userProfile.phone || null } : null,
      });

      console.log(`[RIDE] Offered ride=${rideId} to driver=${driverId} idx=${idx}`);
      return;
    }

    // No drivers
    const nextRetry = new Date(Date.now() + DRIVER_RETRY_INTERVAL_SEC * 1000).toISOString();
    await setRideNoDriverFoundWithRetry(client, rideId, nextRetry);
    await client.query("COMMIT");
    console.log(`[RIDE] NO_DRIVER_FOUND ride=${rideId} nextRetry=${nextRetry}`);
  } catch (e) {
    try { await client.query("ROLLBACK"); } catch {}
    if (lockedDriverId) { try { await unlockDriver(lockedDriverId); } catch {} }
    console.error("offerNextDriver error:", e.message);
  } finally {
    client.release();
  }
}

export async function startTimeoutLoop() {
  setInterval(async () => {
    const client = await pool.connect();
    try {
      const { rows } = await getExpiredOffers();
      for (const row of rows) {
        const rideId   = row.id;
        const driverId = row.current_offer_driver_id;
        if (!driverId) continue;

        await client.query("BEGIN");
        await timeoutOfferRecord(client, rideId, driverId);
        await advanceCandidateIndex(client, rideId);
        await client.query("COMMIT");

        await unlockDriver(driverId);
        console.log(`[RIDE] TIMEOUT ride=${rideId} driver=${driverId} -> offer next`);
        await offerNextDriver(rideId);
      }
    } catch (e) {
      try { await client.query("ROLLBACK"); } catch {}
      console.error("timeout loop error:", e.message);
    } finally {
      client.release();
    }
  }, 2000);
}

export async function startRetryLoop() {
  setInterval(async () => {
    const client = await pool.connect();
    try {
      const { rows } = await getRidesNeedingRetry();
      for (const row of rows) {
        const rideId = row.id;
        try {
          const drivers = await fetchNearbyDrivers(row.pickup, row.vehicle_type);
          if (drivers.length > 0) {
            await client.query("BEGIN");
            await setRideOfferingWithCandidates(client, rideId, drivers);
            await client.query("COMMIT");
            console.log(`[RIDE] Retry found ${drivers.length} drivers for ride=${rideId}`);
            await offerNextDriver(rideId);
            continue;
          }
          const nextCount = (row.retry_count || 0) + 1;
          const nextRetry = nextCount >= DRIVER_RETRY_MAX_ATTEMPTS
            ? null
            : new Date(Date.now() + DRIVER_RETRY_INTERVAL_SEC * 1000).toISOString();
          await incrementRetryCount(rideId, nextCount, nextRetry);
          console.log(`[RIDE] Retry attempt=${nextCount} for ride=${rideId}${nextRetry ? "" : " (gave up)"}`);
        } catch (e) {
          console.error(`[RIDE] retry loop error for ride=${rideId}:`, e.message);
        }
      }
    } catch (e) {
      console.error("retry loop error:", e.message);
    } finally {
      client.release();
    }
  }, 5000);
}
