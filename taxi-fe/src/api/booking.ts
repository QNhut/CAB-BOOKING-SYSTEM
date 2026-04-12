import { http } from "../lib/http";
import { ENV } from "../lib/env";

/**
 * Get completed ride history for the logged-in user (last 20 trips).
 */
export async function getUserBookingHistory() {
  const resp = await http.get(`${ENV.BOOKING_URL}/bookings/me/history`);
  return resp.data; // { rides: [...] }
}

/**
 * Get currently active booking for the logged-in user.
 * Returns booking with status PAID, MATCHED, or WAITING_PAYMENT.
 */
export async function getMyActiveBooking() {
  const resp = await http.get(`${ENV.BOOKING_URL}/bookings/me/active`);
  return resp.data;
}

export async function cancelBooking(bookingId: string) {
  const resp = await http.post(`${ENV.BOOKING_URL}/bookings/${bookingId}/cancel`, {});
  return resp.data;
}

export async function createBooking(body: {
  userId?: string | null;
  pickup: { lat: number; lng: number; label?: string; address?: string };
  dropoff: { lat: number; lng: number; label?: string; address?: string };
  vehicleType: string;
  paymentMethod?: string;
  pricingSnapshot?: {
    fare: number;
    distanceM: number;
    durationS: number;
    currency?: string;
  };
}) {
  // Map label → address so booking-service stores the human-readable name
  const payload = {
    ...body,
    pickup: {
      lat: body.pickup.lat,
      lng: body.pickup.lng,
      address: body.pickup.address || body.pickup.label || undefined,
    },
    dropoff: {
      lat: body.dropoff.lat,
      lng: body.dropoff.lng,
      address: body.dropoff.address || body.dropoff.label || undefined,
    },
  };
  const resp = await http.post(`${ENV.BOOKING_URL}/bookings`, payload);
  return resp.data;
}