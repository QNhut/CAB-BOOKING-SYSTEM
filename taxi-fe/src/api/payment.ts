import axios from "axios";
import { ENV } from "../lib/env";

export interface VnpayUrlRequest {
  orderId: string;
  amount: number;       // VND, integers only (no decimals)
  userId?: string;      // stored so IPN can route the SSE event back to this user
  bankCode?: string;    // optional: VNPAYQR, VNBANK, INTCARD …
  language?: string;   // "vn" | "en"
  returnUrl?: string;  // override default return URL
}

export interface VnpayUrlResponse {
  paymentUrl: string;
  orderId: string;
  amount: number;
}

export interface PendingVnpayBookingDraft {
  orderId: string;
  userId?: string | null;
  pickup: { lat: number; lng: number; label?: string; address?: string };
  dropoff: { lat: number; lng: number; label?: string; address?: string };
  vehicleType: string;
  pricingSnapshot: {
    fare: number;
    distanceM: number;
    durationS: number;
    currency?: string;
  };
  createdAt: string;
}

export interface VnpayVerifyResponse {
  success: boolean;
  checksumValid: boolean;
  code: string;
  orderId: string | null;
  amount: number | null;
  transactionNo: string | null;
  bankCode: string | null;
}

const PENDING_VNPAY_PREFIX = "pending-vnpay-booking:";

function getPendingKey(orderId: string) {
  return `${PENDING_VNPAY_PREFIX}${orderId}`;
}

/**
 * POST /payment/order/create_payment_url
 * Returns a signed VNPay redirect URL.
 */
export async function createVnpayUrl(payload: VnpayUrlRequest): Promise<VnpayUrlResponse> {
  // returnUrl must point back to the FRONTEND so VNPay redirects the browser there
  const returnUrl = payload.returnUrl ?? `${window.location.origin}/payment/return`;

  const res = await axios.post<VnpayUrlResponse>(
    `${ENV.PAYMENT_URL}/payment/order/create_payment_url`,
    { ...payload, returnUrl },
    { headers: { "Content-Type": "application/json" } }
  );
  return res.data;
}

export async function verifyVnpayReturn(params: Record<string, string>): Promise<VnpayVerifyResponse> {
  const res = await axios.post<VnpayVerifyResponse>(
    `${ENV.PAYMENT_URL}/payment/order/verify_return`,
    params,
    { headers: { "Content-Type": "application/json" } }
  );
  return res.data;
}

export function savePendingVnpayBookingDraft(draft: PendingVnpayBookingDraft) {
  localStorage.setItem(getPendingKey(draft.orderId), JSON.stringify(draft));
}

export function loadPendingVnpayBookingDraft(orderId: string): PendingVnpayBookingDraft | null {
  const raw = localStorage.getItem(getPendingKey(orderId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PendingVnpayBookingDraft;
  } catch {
    return null;
  }
}

export function clearPendingVnpayBookingDraft(orderId: string) {
  localStorage.removeItem(getPendingKey(orderId));
}
