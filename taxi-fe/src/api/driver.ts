import { http } from "../lib/http";
import { ENV } from "../lib/env";

export async function getMyDriverState() {
  const resp = await http.get(`${ENV.DRIVER_URL}/drivers/me`);
  return resp.data;
}

export async function setStatus(body: { status: "ONLINE" | "OFFLINE" | "BUSY"; vehicleType?: string; lat?: number; lng?: number }) {
  const resp = await http.post(`${ENV.DRIVER_URL}/drivers/me/status`, body);
  return resp.data;
}

export async function updateLocation(body: { lat: number; lng: number; accuracyM?: number }) {
  const resp = await http.post(`${ENV.DRIVER_URL}/drivers/me/location`, body);
  return resp.data;
}