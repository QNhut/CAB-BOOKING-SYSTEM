import crypto from "crypto";

export function uuid() {
  return crypto.randomUUID();
}

export class ValidationError extends Error {
  constructor(msg) { super(msg); this.name = "ValidationError"; }
}

export function assertLatLng(p, name) {
  if (!p) throw new Error(`${name} is required`);
  if (typeof p.lat !== "number" || typeof p.lng !== "number" || isNaN(p.lat) || isNaN(p.lng)) {
    throw new ValidationError(`${name} must have lat,lng as numbers`);
  }
  if (p.lat < -90 || p.lat > 90 || p.lng < -180 || p.lng > 180) {
    throw new ValidationError(`${name} lat/lng out of range`);
  }
}

export const VALID_PAYMENT_METHODS = ["CASH", "VNPAY"];
