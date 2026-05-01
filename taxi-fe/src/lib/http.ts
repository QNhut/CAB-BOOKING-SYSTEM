import axios from "axios";

export const http = axios.create({
  timeout: 8000,
});

// Request interceptor for debugging
http.interceptors.request.use(
  (config) => {
    console.log(`🌐 ${config.method?.toUpperCase()} ${config.url}`, {
      headers: config.headers.Authorization ? "Bearer ***" : "No auth",
    });
    return config;
  },
  (error) => {
    console.error("❌ Request error:", error);
    return Promise.reject(error);
  }
);

// Response interceptor for debugging
http.interceptors.response.use(
  (response) => {
    console.log(`✅ ${response.config.method?.toUpperCase()} ${response.config.url}`, response.data);
    return response;
  },
  (error) => {
    console.error(`❌ ${error.config?.method?.toUpperCase()} ${error.config?.url}`, {
      status: error.response?.status,
      data: error.response?.data,
    });
    return Promise.reject(error);
  }
);

export function setAuthToken(token: string | null) {
  if (token) http.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  else delete http.defaults.headers.common["Authorization"];
}