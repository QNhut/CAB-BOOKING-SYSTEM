import { http } from "../lib/http";
import { ENV } from "../lib/env";

export async function getEtaPrediction(data: { pickupLat: number; pickupLng: number; dropoffLat: number; dropoffLng: number; vehicleType?: string }) {
  const res = await http.post(`${ENV.ETA_URL}/eta/predict`, {
    pickup: { lat: data.pickupLat, lng: data.pickupLng },
    dropoff: { lat: data.dropoffLat, lng: data.dropoffLng },
  });
  return res.data;
}

export async function getEtaForecast(lat: number, lng: number) {
  const res = await http.get(`${ENV.ETA_URL}/eta/forecast`, { params: { lat, lng } });
  return res.data;
}
