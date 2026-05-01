// Hook để lấy vị trí hiện tại từ browser Geolocation API
import { useState, useCallback } from "react";

export type GeoLocation = {
  lat: number;
  lng: number;
  accuracy?: number;
};

export type GeoLocationState = {
  loading: boolean;
  error: string | null;
  location: GeoLocation | null;
  getCurrentLocation: () => Promise<GeoLocation | null>;
};

export function useCurrentLocation(): GeoLocationState {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [location, setLocation] = useState<GeoLocation | null>(null);

  const getCurrentLocation = useCallback(async (): Promise<GeoLocation | null> => {
    if (!navigator.geolocation) {
      setError("Trình duyệt không hỗ trợ Geolocation");
      return null;
    }

    setLoading(true);
    setError(null); // Clear previous errors

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        });
      });

      const loc: GeoLocation = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy,
      };

      setLocation(loc);
      setError(null); // Clear any previous errors on success
      setLoading(false);
      return loc;
    } catch (err: any) {
      let errorMsg = "Không thể lấy vị trí";
      
      // Log error details for debugging
      console.error("Geolocation error:", err);
      console.error("Error code:", err.code);
      console.error("Error message:", err.message);
      
      if (err.code === 1 || err.code === GeolocationPositionError.PERMISSION_DENIED) {
        errorMsg = "⚠️ Bạn cần cấp quyền truy cập vị trí. Hãy kiểm tra cài đặt trình duyệt.";
      } else if (err.code === 2 || err.code === GeolocationPositionError.POSITION_UNAVAILABLE) {
        errorMsg = "📍 Không thể xác định vị trí. Vui lòng thử lại.";
      } else if (err.code === 3 || err.code === GeolocationPositionError.TIMEOUT) {
        errorMsg = "⏱️ Hết thời gian chờ. Vui lòng thử lại.";
      }

      setError(errorMsg);
      setLoading(false);
      return null;
    }
  }, []);

  return {
    loading,
    error,
    location,
    getCurrentLocation,
  };
}
