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
