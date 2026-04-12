// Component hiển thị nút lấy vị trí hiện tại
import { useCurrentLocation } from "../hooks/useCurrentLocation";

type LocationButtonProps = {
  onLocationReceived?: (lat: number, lng: number) => void;
  style?: React.CSSProperties;
  fullWidth?: boolean;
};

export function LocationButton({ onLocationReceived, style, fullWidth }: LocationButtonProps) {
  const { loading, error, getCurrentLocation } = useCurrentLocation();

  async function handleClick() {
    const loc = await getCurrentLocation();
    if (loc && onLocationReceived) {
      onLocationReceived(loc.lat, loc.lng);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <button
        onClick={handleClick}
        disabled={loading}
        style={{
          padding: "8px 12px",
          fontSize: 14,
          borderRadius: 6,
          backgroundColor: loading ? "#ccc" : "#4CAF50",
          color: "white",
          border: "none",
          cursor: loading ? "wait" : "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          width: fullWidth ? "100%" : "auto",
          ...style,
        }}
      >
        <span style={{ fontSize: 16 }}>📍</span>
        {loading ? "Đang lấy vị trí..." : "Lấy vị trí hiện tại"}
      </button>
      {error && (
        <div
          style={{
            color: "#d32f2f",
            fontSize: 12,
            padding: "4px 8px",
            backgroundColor: "#ffebee",
            borderRadius: 4,
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}
