import { http } from "../lib/http";
import { ENV } from "../lib/env";

/**
 * Get the completed ride history for the logged-in driver (last 20).
 */
export async function getDriverRideHistory() {
  const resp = await http.get(`${ENV.RIDE_URL}/drivers/me/rides/history`);
  return resp.data; // { rides: [...] }
}

/**
 * Get the current ride for the logged-in driver.
 */
export async function getCurrentRide() {
  const resp = await http.get(`${ENV.RIDE_URL}/drivers/me/rides/current`);
  return resp.data;
}

/**
 * Get the current ride for the logged-in user (passenger).
 * Returns ride with status OFFERING, DRIVER_ASSIGNED, PICKED_UP, or ARRIVING.
 */
export async function getCurrentRideForUser() {
  const resp = await http.get(`${ENV.RIDE_URL}/users/me/rides/current`);
  return resp.data;
}

export async function acceptRide(rideId: string) {
  const resp = await http.post(`${ENV.RIDE_URL}/rides/${rideId}/driver/accept`, {});
  return resp.data;
}

export async function cancelRide(rideId: string) {
  const resp = await http.post(`${ENV.RIDE_URL}/rides/${rideId}/user/cancel`, {});
  return resp.data;
}

export async function rejectRide(rideId: string) {
  const resp = await http.post(`${ENV.RIDE_URL}/rides/${rideId}/driver/reject`, {});
  return resp.data;
}

export async function pickupPassenger(rideId: string) {
  const resp = await http.post(`${ENV.RIDE_URL}/rides/${rideId}/driver/pickup`, {});
  return resp.data;
}

export async function completeRide(rideId: string) {
  const resp = await http.post(`${ENV.RIDE_URL}/rides/${rideId}/complete`, {});
  return resp.data;
}