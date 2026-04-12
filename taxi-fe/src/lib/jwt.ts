import { jwtDecode } from "jwt-decode";

export type Role = "USER" | "DRIVER" | "ADMIN";

export type JwtClaims = {
  sub: string;
  role?: Role;
  userId?: string;
  driverId?: string;
  exp?: number;
  iat?: number;
};

export function decodeToken(token: string): JwtClaims {
  return jwtDecode<JwtClaims>(token);
}

export function isExpired(token: string): boolean {
  try {
    const { exp } = decodeToken(token);
    if (!exp) return false;
    return Date.now() >= exp * 1000;
  } catch {
    return true;
  }
}