import { useState, useEffect } from "react";
import { useAuth } from "../../auth/AuthContext";
import { getDriverRideHistory } from "../../api/ride";
import { getDriverAverageRating } from "../../api/review";
import { Link } from "react-router-dom";
import { Badge } from "../../components/ui/Badge";


interface RideRecord {
  rideId?: string;
  bookingId?: string;
  status?: string;
  pickup?: { lat?: number; lng?: number; address?: string };
  dropoff?: { lat?: number; lng?: number; address?: string };
  fare?: number;
  currency?: string;
  completedAt?: string;
  createdAt?: string;
}

export function DriverHistoryPage() {
  const { token, driverId } = useAuth();
  const [rides, setRides] = useState<RideRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<{ avg: number | null; total: number; earnings: number }>({ avg: null, total: 0, earnings: 0 });

  useEffect(() => {
    if (!token) return;
    Promise.all([
      getDriverRideHistory().catch(() => ({ rides: [] })),
      driverId ? getDriverAverageRating(driverId).catch(() => ({ average_rating: null, total_reviews: 0 })) : Promise.resolve({ average_rating: null, total_reviews: 0 }),
    ]).then(([histData, ratingData]) => {
      const list = histData.rides || histData || [];
      setRides(list);
      const totalEarnings = list.reduce((s: number, r: RideRecord) => s + (r.fare ? Number(r.fare) : 0), 0);
      setStats({
        avg: ratingData.average_rating,
        total: list.length,
        earnings: totalEarnings,
      });
    }).finally(() => setLoading(false));
  }, [token, driverId]);

  const statusVariant = (s?: string): "success" | "error" | "warning" | "info" => {
    if (!s) return "info";
    if (s === "COMPLETED") return "success";
    if (s.includes("CANCEL")) return "error";
    return "info";
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-6 py-5">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <Link to="/driver" className="text-white/80 hover:text-white transition">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </Link>
          <h1 className="text-xl font-bold">Ride History</h1>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="max-w-lg mx-auto px-4 -mt-4 relative z-10">
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 text-center">
            <p className="text-2xl font-extrabold text-purple-600">{stats.total}</p>
            <p className="text-xs text-gray-500 mt-1">Total Rides</p>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 text-center">
            <p className="text-2xl font-extrabold text-green-600">{stats.earnings > 0 ? `${(stats.earnings / 1000).toFixed(0)}k` : "0"}</p>
            <p className="text-xs text-gray-500 mt-1">Earnings (VND)</p>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 text-center">
            <div className="flex items-center justify-center gap-1">
              {stats.avg != null ? (
                <>
                  <span className="text-2xl font-extrabold text-amber-500">{stats.avg}</span>
                  <span className="text-amber-400 text-lg">★</span>
                </>
              ) : (
                <span className="text-2xl font-extrabold text-gray-300">—</span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">Rating</p>
          </div>
        </div>
      </div>

      {/* Ride List */}
      <div className="max-w-lg mx-auto p-4 space-y-3">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : rides.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <div className="text-5xl mb-4">🚗</div>
            <p className="text-lg font-medium">No rides yet</p>
            <p className="text-sm">Your completed rides will appear here</p>
          </div>
        ) : (
          rides.map((r, i) => {
            const id = r.rideId || r.bookingId || String(i);
            const date = r.completedAt || r.createdAt;
            return (
              <div key={id} className="bg-white rounded-xl border border-gray-100 p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-xs text-gray-400 font-mono">{id.slice(0, 12)}...</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {date ? new Date(date).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : ""}
                    </p>
                  </div>
                  <Badge variant={statusVariant(r.status)}>{r.status || "COMPLETED"}</Badge>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5">●</span>
                    <span className="text-gray-700 truncate">{r.pickup?.address || (r.pickup ? `${r.pickup.lat}, ${r.pickup.lng}` : "Pickup")}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-red-500 mt-0.5">●</span>
                    <span className="text-gray-700 truncate">{r.dropoff?.address || (r.dropoff ? `${r.dropoff.lat}, ${r.dropoff.lng}` : "Dropoff")}</span>
                  </div>
                </div>

                <div className="flex items-center justify-end mt-3 pt-3 border-t border-gray-50">
                  {r.fare && (
                    <span className="font-bold text-green-600">
                      +{Number(r.fare).toLocaleString()} {r.currency || "VND"}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
