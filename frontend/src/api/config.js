// API Base URLs configured from environment variables
// Sử dụng đường dẫn tương đối để Vite proxy xử lý (tránh lỗi CORS)
export const API_URLS = {
  AUTH: import.meta.env.VITE_AUTH_URL || "",
  BOOKING: import.meta.env.VITE_BOOKING_URL || "",
  PRICING: import.meta.env.VITE_PRICING_URL || "",
  DRIVER: import.meta.env.VITE_DRIVER_URL || "",
  RIDE: import.meta.env.VITE_RIDE_URL || "",
  NOTIF: import.meta.env.VITE_NOTIF_URL || "",
  GEO: import.meta.env.VITE_GEO_URL || "",
  PAYMENT: import.meta.env.VITE_PAYMENT_URL || "",
  ETA: import.meta.env.VITE_ETA_URL || "",
  FRAUD: import.meta.env.VITE_FRAUD_URL || "",
  REVIEW: import.meta.env.VITE_REVIEW_URL || "",
  AGENT: import.meta.env.VITE_AGENT_URL || "",
  USER: import.meta.env.VITE_USER_URL || "",
};

export default API_URLS;
