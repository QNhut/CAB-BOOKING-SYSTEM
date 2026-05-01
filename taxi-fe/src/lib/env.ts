const GW = "http://localhost:8000";

export const ENV = {
  AUTH_URL: import.meta.env.VITE_AUTH_URL || GW,
  BOOKING_URL: import.meta.env.VITE_BOOKING_URL || GW,
  PRICING_URL: import.meta.env.VITE_PRICING_URL || GW,
  DRIVER_URL: import.meta.env.VITE_DRIVER_URL || GW,
  RIDE_URL: import.meta.env.VITE_RIDE_URL || GW,
  NOTIF_URL: import.meta.env.VITE_NOTIFICATION_URL || GW,
  GEO_URL: import.meta.env.VITE_GEO_URL || GW,
  PAYMENT_URL: import.meta.env.VITE_PAYMENT_URL || GW,
  ETA_URL: import.meta.env.VITE_ETA_URL || GW,
  REVIEW_URL: import.meta.env.VITE_REVIEW_URL || GW,
};