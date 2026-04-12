import { http } from "../lib/http";
import { ENV } from "../lib/env";

export async function estimate(body: {
  pickup: { lat: number; lng: number };
  dropoff: { lat: number; lng: number };
  vehicleType: string;
}) {
  const resp = await http.post(`${ENV.PRICING_URL}/pricing/estimate`, body);
  return resp.data;
}