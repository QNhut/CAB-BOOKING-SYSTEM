import { useState, useEffect } from "react";
import { useAuth } from "../../auth/AuthContext";
import { getUserBookingHistory } from "../../api/booking";
import { Link } from "react-router-dom";
import { Badge } from "../../components/ui/Badge";

interface RideRecord {
  id?: string;
  booking_id?: string;
  ride_id?: string;
  status?: string;
  pickup_address?: string;
  dropoff_address?: string;
  pickup_label?: string;
  dropoff_label?: string;
  fare?: number;
  currency?: string;
  vehicle_type?: string;
  created_at?: string;
  completed_at?: string;
  driverId?: string;
  driver_id?: string;
}

export function RideHistoryPage() {
  const { token } = useAuth();
  const [rides, setRides] = useState<RideRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    getUserBookingHistory()
      .then((data) => setRides(data.rides || data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  const completedRides = rides.filter((r) => r.status === "COMPLETED");
  const totalSpent = completedRides.reduce((s, r) => s + (r.fare ? Number(r.fare) : 0), 0);

  const statusVariant = (s?: string): "success" | "error" | "warning" | "info" => {
    if (!s) return "info";
    if (s === "COMPLETED") return "success";
    if (s.includes("CANCEL")) return "error";
    if (s === "SEARCHING" || s === "PENDING") return "warning";
    return "info";
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="gradient-primary text-white px-6 py-5">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <Link to="/user" className="text-white/80 hover:text-white transition">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </Link>
          <h1 className="text-xl font-bold">Ride History</h1>
        </div>
      </div>

      {/* Stats Cards */}
      {!loading && rides.length > 0 && (
        <div className="max-w-lg mx-auto px-4 -mt-4 relative z-10">
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 text-center">
              <p className="text-2xl font-extrabold text-indigo-600">{rides.length}</p>
              <p className="text-xs text-gray-500 mt-1">Total Rides</p>
            </div>
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 text-center">
              <p className="text-2xl font-extrabold text-green-600">{completedRides.length}</p>
              <p className="text-xs text-gray-500 mt-1">Completed</p>
            </div>
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 text-center">
              <p className="text-2xl font-extrabold text-amber-600">{totalSpent > 0 ? `${(totalSpent / 1000).toFixed(0)}k` : "0"}</p>
              <p className="text-xs text-gray-500 mt-1">Spent (VND)</p>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-lg mx-auto p-4 space-y-3">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : rides.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <div className="text-5xl mb-4">🚗</div>
            <p className="text-lg font-medium">No rides yet</p>
            <p className="text-sm">Your ride history will appear here</p>
          </div>
        ) : (
          rides.map((r, i) => {
            const id = r.ride_id || r.booking_id || r.id || String(i);
            return (
              <div key={id} className="bg-white rounded-xl border border-gray-100 p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-xs text-gray-400 font-mono">{id.slice(0, 12)}...</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {r.created_at ? new Date(r.created_at).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : ""}
                    </p>
                  </div>
                  <Badge variant={statusVariant(r.status)}>{r.status || "UNKNOWN"}</Badge>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5">●</span>
                    <span className="text-gray-700">{r.pickup_address || r.pickup_label || "Pickup"}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-red-500 mt-0.5">●</span>
                    <span className="text-gray-700">{r.dropoff_address || r.dropoff_label || "Dropoff"}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
                  <div className="flex items-center gap-3 text-xs text-gray-400">
                    <span>{r.vehicle_type === "CAR_7" ? "🚐 7-seat" : "🚗 4-seat"}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {r.fare && (
                      <span className="font-bold text-gray-900">
                        {Number(r.fare).toLocaleString()} {r.currency || "VND"}
                      </span>
                    )}
                    {r.status === "COMPLETED" && (
                      <Link to={`/user/rating/${id}?driverId=${encodeURIComponent(r.driverId || r.driver_id || "")}`} className="text-xs bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full font-medium hover:bg-indigo-100 transition">
                        Rate
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
