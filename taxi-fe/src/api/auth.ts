import { http } from "../lib/http";
import { ENV } from "../lib/env";

export async function login(identifier: string, password: string) {
  const resp = await http.post(`${ENV.AUTH_URL}/auth/login`, { identifier, password });
  return resp.data as { accessToken: string; refreshToken?: string; account?: any };
}

export async function register(data: {
  identifier: string;
  password: string;
  role: "USER" | "DRIVER";
  userId?: string;
  driverId?: string;
}) {
  const resp = await http.post(`${ENV.AUTH_URL}/auth/register`, data);
  return resp.data as { accessToken: string; refreshToken?: string; account?: any };
}

export async function getProfile() {
  const resp = await http.get(`${ENV.AUTH_URL}/auth/profile`);
  return resp.data as {
    role: string;
    profile: {
      full_name?: string | null;
      phone?: string | null;
      vehicle_type?: string | null;
      license_plate?: string | null;
      driver_license?: string | null;
    } | null;
  };
}

export async function updateProfile(data: {
  fullName?: string;
  phone?: string;
  vehicleType?: string;
  licensePlate?: string;
  driverLicense?: string;
}) {
  const resp = await http.put(`${ENV.AUTH_URL}/auth/profile`, data);
  return resp.data as { ok: boolean; profile: any };
}

export async function getInternalUserProfile(userId: string) {
  const resp = await http.get(`${ENV.AUTH_URL}/internal/profile/user/${userId}`);
  return resp.data as { full_name?: string | null; phone?: string | null } | null;
}

export async function getInternalDriverProfile(driverId: string) {
  const resp = await http.get(`${ENV.AUTH_URL}/internal/profile/driver/${driverId}`);
  return resp.data as {
    full_name?: string | null;
    phone?: string | null;
    vehicle_type?: string | null;
    license_plate?: string | null;
  } | null;
}