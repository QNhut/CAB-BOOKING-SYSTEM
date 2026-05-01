import { useEffect, useState, useCallback } from "react";
import { useAuth } from "../../auth/AuthContext";
import { http } from "../../lib/http";
import { ENV } from "../../lib/env";
import { MapView } from "../../components/MapView";

type Tab = "overview" | "users" | "drivers" | "rides" | "pricing" | "monitoring";

interface KPI {
  totalUsers: number;
  totalDrivers: number;
  totalRides: number;
  activeRides: number;
  completedRides: number;
  cancelledRides: number;
  revenue: number;
  avgRating: number;
}

interface UserRow {
  id: string;
  identifier: string;
  role: string;
  full_name?: string;
  phone?: string;
  status?: string;
  created_at?: string;
  avg_rating?: number | null;
}

interface RideRow {
  id: string;
  booking_id?: string;
  driver_id?: string;
  user_id?: string;
  status: string;
  pickup_lat?: number;
  pickup_lng?: number;
  dropoff_lat?: number;
  dropoff_lng?: number;
  fare?: number;
  currency?: string;
  created_at?: string;
}

const ACTIVE_STATUSES = ["DRIVER_ASSIGNED", "PICKED_UP", "EN_ROUTE"];

export function AdminDashboard() {
  const { logout } = useAuth();
  const [tab, setTab] = useState<Tab>("overview");
  const [kpi, setKpi] = useState<KPI>({
    totalUsers: 0, totalDrivers: 0, totalRides: 0,
    activeRides: 0, completedRides: 0, cancelledRides: 0,
    revenue: 0, avgRating: 0,
  });
  const [users, setUsers] = useState<UserRow[]>([]);
  const [rides, setRides] = useState<RideRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [kpiLoading, setKpiLoading] = useState(true);
  const [kpiError, setKpiError] = useState("");
  const [surgeZone, setSurgeZone] = useState("");
  const [surgeMultiplier, setSurgeMultiplier] = useState("1.5");
  const [surgeMsg, setSurgeMsg] = useState("");
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [healthStatus, setHealthStatus] = useState<Record<string, "ok" | "warn" | "error">>({});
  const [healthLoading, setHealthLoading] = useState(false);
  const [rideFilter, setRideFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  /* ── Load KPI (lightweight — NO per-user rating fetch) ────────────────── */
  const loadKPI = useCallback(async () => {
    setKpiLoading(true);
    setKpiError("");
    try {
      const [usersRes, ridesRes] = await Promise.allSettled([
        http.get(`${ENV.AUTH_URL}/auth/admin/users`, { timeout: 8000 }),
        http.get(`${ENV.RIDE_URL}/rides/admin/all`, { timeout: 8000 }),
      ]);

      const uData = usersRes.status === "fulfilled" ? usersRes.value.data : null;
      const rData = ridesRes.status === "fulfilled" ? ridesRes.value.data : null;

      if (!uData && !rData) {
        setKpiError("Cannot connect to services. Check if backend is running.");
        setKpiLoading(false);
        return;
      }

      const allUsers: UserRow[] = uData?.users || uData || [];
      const allRides: RideRow[] = rData?.rides || rData || [];

      const completedRides = allRides.filter((r) => r.status === "COMPLETED");
      const revenue = completedRides.reduce((s, r) => s + Number(r.fare || 0), 0);

      setKpi({
        totalUsers: allUsers.filter((u) => u.role === "USER").length,
        totalDrivers: allUsers.filter((u) => u.role === "DRIVER").length,
        totalRides: allRides.length,
        activeRides: allRides.filter((r) => ACTIVE_STATUSES.includes(r.status)).length,
        completedRides: completedRides.length,
        cancelledRides: allRides.filter((r) => r.status === "CANCELLED").length,
        revenue,
        avgRating: 0,
      });

      // Load avg rating in background (non-blocking)
      loadAvgRating(allUsers);
      setLastRefresh(new Date());
    } catch {
      setKpiError("Failed to load dashboard data");
    }
    setKpiLoading(false);
  }, []);

  /* ── Avg rating — background fetch, capped to avoid overload ──────────── */
  async function loadAvgRating(allUsers: UserRow[]) {
    try {
      const drivers = allUsers.filter((u) => u.role === "DRIVER").slice(0, 10);
      const ratings: number[] = [];
      const results = await Promise.allSettled(
        drivers.map((d) => {
          const aliases = d.driver_id ? `?aliases=${encodeURIComponent(d.driver_id)}` : "";
          return http.get(`${ENV.REVIEW_URL}/reviews/driver/${d.id}/average${aliases}`, { timeout: 3000 });
        })
      );
      for (const r of results) {
        if (r.status === "fulfilled" && r.value.data?.average_rating > 0) {
          ratings.push(r.value.data.average_rating);
        }
      }
      if (ratings.length > 0) {
        const avg = ratings.reduce((a, b) => a + b, 0) / ratings.length;
        setKpi((prev) => ({ ...prev, avgRating: avg }));
      }
    } catch {
      /* non-critical */
    }
  }

  /* ── Health check ─────────────────────────────────────────────────────── */
  const checkHealth = useCallback(async () => {
    setHealthLoading(true);
    const services = [
      { key: "API Gateway", url: `${ENV.AUTH_URL}/health` },
      { key: "Auth Service", url: `${ENV.AUTH_URL}/auth/health` },
      { key: "Booking Service", url: `${ENV.BOOKING_URL}/bookings/health` },
      { key: "Driver Service", url: `${ENV.DRIVER_URL}/drivers/health` },
      { key: "Ride Service", url: `${ENV.RIDE_URL}/rides/health` },
      { key: "Pricing Service", url: `${ENV.PRICING_URL}/pricing/health` },
      { key: "Notification Service", url: `${ENV.NOTIF_URL}/notifications/health` },
      { key: "Review Service", url: `${ENV.REVIEW_URL}/reviews/health` },
    ];
    const results: Record<string, "ok" | "error"> = {};
    await Promise.all(
      services.map(async (s) => {
        try {
          await http.get(s.url, { timeout: 5000 });
          results[s.key] = "ok";
        } catch {
          results[s.key] = "error";
        }
      })
    );
    setHealthStatus(results);
    setHealthLoading(false);
  }, []);

  /* ── Effects ──────────────────────────────────────────────────────────── */
  useEffect(() => {
    loadKPI();
    checkHealth();
    const interval = setInterval(loadKPI, 30000);
    return () => clearInterval(interval);
  }, [loadKPI, checkHealth]);

  useEffect(() => {
    if (tab === "users" || tab === "drivers") loadUsers();
    if (tab === "rides") loadRides();
    if (tab === "monitoring") checkHealth();
  }, [tab, checkHealth]);

  /* ── Load users with ratings ──────────────────────────────────────────── */
  async function loadUsers() {
    setLoading(true);
    try {
      const res = await http.get(`${ENV.AUTH_URL}/auth/admin/users`, { timeout: 8000 });
      const baseUsers: UserRow[] = res.data?.users || res.data || [];
      const withRatings = await Promise.all(
        baseUsers.map(async (u) => {
          try {
            const driverAliases = u.driver_id ? `?aliases=${encodeURIComponent(u.driver_id)}` : "";
            const endpoint =
              u.role === "DRIVER" ? `${ENV.REVIEW_URL}/reviews/driver/${u.id}/average${driverAliases}`
                : u.role === "USER" ? `${ENV.REVIEW_URL}/reviews/user/${u.id}`
                  : null;
            if (!endpoint) return { ...u, avg_rating: null };
            const ratingRes = await http.get(endpoint, { timeout: 3000 });
            return { ...u, avg_rating: ratingRes.data?.average_rating || null };
          } catch {
            return { ...u, avg_rating: null };
          }
        })
      );
      setUsers(withRatings);
    } catch {
      setUsers([]);
    }
    setLoading(false);
  }

  /* ── Load rides ───────────────────────────────────────────────────────── */
  async function loadRides() {
    setLoading(true);
    try {
      const res = await http.get(`${ENV.RIDE_URL}/rides/admin/all`, { timeout: 8000 });
      setRides(res.data?.rides || res.data || []);
    } catch {
      setRides([]);
    }
    setLoading(false);
  }

  /* ── CRUD ─────────────────────────────────────────────────────────────── */
  async function deleteUser(userId: string) {
    try {
      await http.delete(`${ENV.AUTH_URL}/auth/admin/users/${userId}`);
      setDeleteUserId(null);
      loadUsers();
      loadKPI();
    } catch (e: any) {
      alert("Delete failed: " + (e.response?.data?.error || e.message));
    }
  }

  async function updateUser(user: UserRow) {
    try {
      await http.put(`${ENV.AUTH_URL}/auth/admin/users/${user.id}`, {
        full_name: user.full_name,
        phone: user.phone,
        status: user.status,
      });
      setEditingUser(null);
      loadUsers();
    } catch (e: any) {
      alert("Update failed: " + (e.response?.data?.error || e.message));
    }
  }

  async function applySurge() {
    if (!surgeZone.trim()) {
      setSurgeMsg("Please enter a zone name");
      return;
    }
    try {
      const multiplier = parseFloat(surgeMultiplier);
      await http.post(`${ENV.PRICING_URL}/pricing/surge`, {
        zone: surgeZone.trim(),
        demand_index: multiplier,
        supply_index: 1.0,
      });
      setSurgeMsg(`Surge ${multiplier}x applied to zone "${surgeZone}"`);
    } catch (e: any) {
      setSurgeMsg("Failed: " + (e.response?.data?.error || e.message));
    }
  }

  /* ── Computed ─────────────────────────────────────────────────────────── */
  const tabList: { key: Tab; label: string; icon: string }[] = [
    { key: "overview", label: "Overview", icon: "📊" },
    { key: "users", label: "Users", icon: "👥" },
    { key: "drivers", label: "Drivers", icon: "🚗" },
    { key: "rides", label: "Rides", icon: "🗺️" },
    { key: "pricing", label: "Pricing", icon: "💰" },
    { key: "monitoring", label: "Monitoring", icon: "📈" },
  ];

  const filteredUsers = (
    tab === "drivers" ? users.filter((u) => u.role === "DRIVER")
      : tab === "users" ? users.filter((u) => u.role === "USER")
        : users
  ).filter((u) =>
    !searchQuery ||
    u.identifier.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (u.full_name || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredRides =
    rideFilter === "ALL" ? rides
      : rideFilter === "ACTIVE" ? rides.filter((r) => ACTIVE_STATUSES.includes(r.status))
        : rides.filter((r) => r.status === rideFilter);

  const healthOk = Object.values(healthStatus).filter((s) => s === "ok").length;
  const healthTotal = Object.keys(healthStatus).length;

  /* ── Render ───────────────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* ── Sidebar ── */}
      <aside className="w-56 bg-gradient-to-b from-slate-900 to-slate-800 text-white flex flex-col shrink-0">
        <div className="p-5 border-b border-white/10">
          <h1 className="text-lg font-bold flex items-center gap-2">🚖 GoRide Admin</h1>
          <p className="text-[11px] text-gray-400 mt-1">Management Console</p>
        </div>
        <nav className="flex-1 p-3 space-y-0.5">
          {tabList.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition flex items-center gap-2.5 ${
                tab === t.key
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/25"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <span className="text-base">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </nav>
        <div className="p-3 border-t border-white/10">
          <div className="px-3 py-2 mb-2 text-[11px] text-gray-500">
            Last refresh: {lastRefresh.toLocaleTimeString()}
          </div>
          <button
            onClick={logout}
            className="w-full px-3 py-2 rounded-lg bg-red-500/15 text-red-400 text-sm font-medium hover:bg-red-500/25 transition"
          >
            Sign Out
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 p-6 overflow-auto">

        {/* ════════ OVERVIEW ════════ */}
        {tab === "overview" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-800">Dashboard Overview</h2>
              <button
                onClick={loadKPI}
                disabled={kpiLoading}
                className="px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-600 text-xs font-semibold hover:bg-indigo-100 transition disabled:opacity-50"
              >
                {kpiLoading ? "Loading..." : "🔄 Refresh"}
              </button>
            </div>

            {kpiError && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                ⚠️ {kpiError}
                <button onClick={loadKPI} className="ml-3 underline font-semibold">Retry</button>
              </div>
            )}

            {/* KPI Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              <KPICard icon="👥" label="Total Users" value={kpi.totalUsers} color="blue" />
              <KPICard icon="🚗" label="Total Drivers" value={kpi.totalDrivers} color="green" />
              <KPICard icon="🗺️" label="Total Rides" value={kpi.totalRides} color="purple" />
              <KPICard icon="🟢" label="Active Rides" value={kpi.activeRides} color="emerald"
                sub={kpi.activeRides > 0 ? "In progress now" : "No active rides"} />
              <KPICard icon="✅" label="Completed" value={kpi.completedRides} color="teal" />
              <KPICard icon="❌" label="Cancelled" value={kpi.cancelledRides} color="red" />
              <KPICard icon="💰" label="Revenue" value={`${kpi.revenue.toLocaleString("vi-VN")}₫`} color="amber" />
              <KPICard icon="⭐" label="Avg Rating" value={kpi.avgRating > 0 ? kpi.avgRating.toFixed(1) : "—"} color="yellow"
                sub={kpi.avgRating > 0 ? "From driver reviews" : "No reviews yet"} />
            </div>

            {/* Quick Actions + Health */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                <h3 className="text-sm font-bold text-gray-700 mb-3">Quick Actions</h3>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setTab("users")} className="p-3 rounded-lg bg-blue-50 text-blue-700 font-medium text-xs hover:bg-blue-100 transition">👥 Manage Users</button>
                  <button onClick={() => setTab("drivers")} className="p-3 rounded-lg bg-green-50 text-green-700 font-medium text-xs hover:bg-green-100 transition">🚗 Manage Drivers</button>
                  <button onClick={() => setTab("rides")} className="p-3 rounded-lg bg-purple-50 text-purple-700 font-medium text-xs hover:bg-purple-100 transition">🗺️ View Rides</button>
                  <button onClick={() => setTab("pricing")} className="p-3 rounded-lg bg-amber-50 text-amber-700 font-medium text-xs hover:bg-amber-100 transition">💰 Pricing Config</button>
                </div>
              </div>

              <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-gray-700">System Health</h3>
                  {healthTotal > 0 && (
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      healthOk === healthTotal ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                    }`}>
                      {healthOk}/{healthTotal} online
                    </span>
                  )}
                </div>
                <div className="space-y-1.5">
                  {["API Gateway", "Auth Service", "Booking Service", "Driver Service", "Ride Service", "Pricing Service"].map((svc) => (
                    <HealthRow key={svc} label={svc} status={healthStatus[svc] || "warn"} />
                  ))}
                </div>
              </div>
            </div>

            {/* Active rides detail */}
            {kpi.activeRides > 0 && (
              <div className="bg-white rounded-xl p-5 shadow-sm border border-emerald-200 bg-emerald-50/30">
                <h3 className="text-sm font-bold text-emerald-800 mb-2">🟢 Active Rides ({kpi.activeRides})</h3>
                <p className="text-xs text-gray-500 mb-3">Rides currently in DRIVER_ASSIGNED, PICKED_UP, or EN_ROUTE status across all users</p>
                <button onClick={() => { setTab("rides"); setRideFilter("ACTIVE"); }} className="text-xs text-indigo-600 font-semibold hover:underline">
                  View active rides →
                </button>
              </div>
            )}
          </div>
        )}

        {/* ════════ USERS / DRIVERS ════════ */}
        {(tab === "users" || tab === "drivers") && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <h2 className="text-xl font-bold text-gray-800">
                {tab === "drivers" ? "🚗 Drivers" : "👥 Users"}
                <span className="text-sm font-normal text-gray-400 ml-2">({filteredUsers.length})</span>
              </h2>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Search by name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm w-56 focus:border-indigo-400 outline-none"
                />
                <button
                  onClick={loadUsers}
                  disabled={loading}
                  className="px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-600 text-xs font-semibold hover:bg-indigo-100 transition disabled:opacity-50"
                >
                  {loading ? "..." : "🔄 Refresh"}
                </button>
              </div>
            </div>

            {loading ? (
              <LoadingSpinner />
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50/80 text-gray-500 text-left text-xs uppercase tracking-wider">
                        <th className="px-4 py-3 font-semibold">ID</th>
                        <th className="px-4 py-3 font-semibold">Email</th>
                        <th className="px-4 py-3 font-semibold">Name</th>
                        <th className="px-4 py-3 font-semibold">Phone</th>
                        <th className="px-4 py-3 font-semibold">Role</th>
                        <th className="px-4 py-3 font-semibold">Rating</th>
                        <th className="px-4 py-3 font-semibold">Created</th>
                        <th className="px-4 py-3 font-semibold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {filteredUsers.map((u) => (
                        <tr key={u.id} className="hover:bg-blue-50/30 transition">
                          <td className="px-4 py-2.5 font-mono text-xs text-gray-400">{u.id.substring(0, 8)}</td>
                          <td className="px-4 py-2.5 font-medium text-gray-800 text-xs">{u.identifier}</td>
                          <td className="px-4 py-2.5 text-gray-600 text-xs">{u.full_name || "—"}</td>
                          <td className="px-4 py-2.5 text-gray-600 text-xs">{u.phone || "—"}</td>
                          <td className="px-4 py-2.5"><RoleBadge role={u.role} /></td>
                          <td className="px-4 py-2.5 text-xs">
                            {u.avg_rating != null && u.avg_rating > 0 ? (
                              <span className="inline-flex items-center gap-1 text-amber-600 font-semibold">⭐ {u.avg_rating.toFixed(1)}</span>
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-xs text-gray-400">
                            {u.created_at ? new Date(u.created_at).toLocaleDateString() : "—"}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <div className="inline-flex gap-1">
                              <button onClick={() => setEditingUser({ ...u })}
                                className="px-2 py-1 text-xs bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition font-medium">Edit</button>
                              <button onClick={() => setDeleteUserId(u.id)}
                                className="px-2 py-1 text-xs bg-red-50 text-red-600 rounded hover:bg-red-100 transition font-medium">Delete</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {filteredUsers.length === 0 && (
                        <tr>
                          <td colSpan={8} className="px-4 py-12 text-center text-gray-400 text-sm">
                            {searchQuery ? "No results matching your search" : "No records found"}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ════════ RIDES ════════ */}
        {tab === "rides" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <h2 className="text-xl font-bold text-gray-800">
                🗺️ All Rides
                <span className="text-sm font-normal text-gray-400 ml-2">({filteredRides.length})</span>
              </h2>
              <div className="flex items-center gap-2">
                <select
                  value={rideFilter}
                  onChange={(e) => setRideFilter(e.target.value)}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs focus:border-indigo-400 outline-none cursor-pointer"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="ACTIVE">Active Only</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="CANCELLED">Cancelled</option>
                  <option value="NO_DRIVER_FOUND">No Driver Found</option>
                  <option value="DRIVER_ASSIGNED">Driver Assigned</option>
                  <option value="PICKED_UP">Picked Up</option>
                </select>
                <button
                  onClick={loadRides}
                  disabled={loading}
                  className="px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-600 text-xs font-semibold hover:bg-indigo-100 transition disabled:opacity-50"
                >
                  {loading ? "..." : "🔄 Refresh"}
                </button>
              </div>
            </div>

            {loading ? (
              <LoadingSpinner />
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50/80 text-gray-500 text-left text-xs uppercase tracking-wider">
                        <th className="px-4 py-3 font-semibold">Ride ID</th>
                        <th className="px-4 py-3 font-semibold">Status</th>
                        <th className="px-4 py-3 font-semibold">Driver</th>
                        <th className="px-4 py-3 font-semibold">Fare</th>
                        <th className="px-4 py-3 font-semibold">Created</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {filteredRides.map((r) => (
                        <tr key={r.id} className="hover:bg-blue-50/30 transition">
                          <td className="px-4 py-2.5 font-mono text-xs text-gray-400">{r.id.substring(0, 12)}</td>
                          <td className="px-4 py-2.5"><StatusBadge status={r.status} /></td>
                          <td className="px-4 py-2.5 font-mono text-xs text-gray-400">
                            {r.driver_id ? r.driver_id.substring(0, 8) : "—"}
                          </td>
                          <td className="px-4 py-2.5 text-xs font-semibold text-gray-700">
                            {r.fare ? `${Number(r.fare).toLocaleString("vi-VN")}₫` : "—"}
                          </td>
                          <td className="px-4 py-2.5 text-xs text-gray-400">
                            {r.created_at ? new Date(r.created_at).toLocaleString() : "—"}
                          </td>
                        </tr>
                      ))}
                      {filteredRides.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-4 py-12 text-center text-gray-400 text-sm">No rides found</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ════════ PRICING ════════ */}
        {tab === "pricing" && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-gray-800">💰 Pricing & Surge</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                <h3 className="text-sm font-bold text-gray-700 mb-4">Apply Surge Pricing</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Zone Name</label>
                    <input value={surgeZone} onChange={(e) => setSurgeZone(e.target.value)} placeholder="e.g. district_1"
                      className="w-full p-2.5 rounded-lg border border-gray-200 text-sm focus:border-indigo-400 outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Multiplier</label>
                    <select value={surgeMultiplier} onChange={(e) => setSurgeMultiplier(e.target.value)}
                      className="w-full p-2.5 rounded-lg border border-gray-200 text-sm focus:border-indigo-400 outline-none cursor-pointer">
                      <option value="1.0">1.0x (Normal)</option>
                      <option value="1.2">1.2x</option>
                      <option value="1.5">1.5x</option>
                      <option value="2.0">2.0x</option>
                      <option value="2.5">2.5x</option>
                      <option value="3.0">3.0x (Peak)</option>
                    </select>
                  </div>
                  <button onClick={applySurge}
                    className="w-full p-2.5 rounded-lg bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 transition">
                    ⚡ Apply Surge
                  </button>
                  {surgeMsg && (
                    <p className={`text-xs font-medium p-2 rounded-lg ${
                      surgeMsg.startsWith("Surge") ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                    }`}>{surgeMsg}</p>
                  )}
                </div>
              </div>
              <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                <h3 className="text-sm font-bold text-gray-700 mb-4">Base Rates</h3>
                <div className="space-y-2">
                  {[
                    { label: "🚗 4-seat Car (base)", value: "15,000₫" },
                    { label: "🚗 4-seat Car (/km)", value: "12,000₫" },
                    { label: "🚐 7-seat Car (base)", value: "20,000₫" },
                    { label: "🚐 7-seat Car (/km)", value: "16,000₫" },
                  ].map((r) => (
                    <div key={r.label} className="flex justify-between items-center p-2.5 bg-gray-50 rounded-lg text-xs">
                      <span className="font-medium text-gray-600">{r.label}</span>
                      <span className="font-bold text-gray-800">{r.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ════════ MONITORING ════════ */}
        {tab === "monitoring" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-800">📈 System Monitoring</h2>
              <button onClick={checkHealth} disabled={healthLoading}
                className="px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-600 text-xs font-semibold hover:bg-indigo-100 transition disabled:opacity-50">
                {healthLoading ? "Checking..." : "🔄 Refresh Health"}
              </button>
            </div>

            {/* Map */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-4 border-b border-gray-100">
                <h3 className="text-sm font-bold text-gray-700">🗺️ Live Map — Ho Chi Minh City</h3>
              </div>
              <MapView center={{ lat: 10.7769, lng: 106.7009 }} zoom={12} height="350px" className="rounded-b-xl" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-gray-700">Service Status</h3>
                  {healthTotal > 0 && (
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      healthOk === healthTotal ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                    }`}>{healthOk}/{healthTotal}</span>
                  )}
                </div>
                <div className="space-y-1.5">
                  {[
                    { key: "API Gateway", port: "8000" },
                    { key: "Auth Service", port: "8001" },
                    { key: "Booking Service", port: "8003" },
                    { key: "Driver Service", port: "8004" },
                    { key: "Ride Service", port: "8005" },
                    { key: "Pricing Service", port: "8002" },
                    { key: "Notification Service", port: "8006" },
                    { key: "Review Service", port: "8011" },
                  ].map((s) => (
                    <HealthRow key={s.key} label={s.key} status={healthStatus[s.key] || "warn"} detail={`Port ${s.port}`} />
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                <h3 className="text-sm font-bold text-gray-700 mb-3">Infrastructure</h3>
                <div className="space-y-1.5">
                  <HealthRow label="PostgreSQL" status="ok" detail="Port 5432" />
                  <HealthRow label="Redis" status="ok" detail="Port 6379" />
                  <HealthRow label="Apache Kafka" status="ok" detail="Port 9092" />
                  <HealthRow label="Prometheus" status="ok" detail="Port 9090" />
                  <HealthRow label="Grafana" status="ok" detail="Port 3000" />
                </div>
                <div className="mt-4 space-y-1.5">
                  <a href="http://localhost:9090" target="_blank" rel="noopener noreferrer"
                    className="block p-2.5 rounded-lg bg-orange-50 text-orange-700 text-xs font-semibold hover:bg-orange-100 transition">
                    📊 Prometheus Dashboard →
                  </a>
                  <a href="http://localhost:3000" target="_blank" rel="noopener noreferrer"
                    className="block p-2.5 rounded-lg bg-green-50 text-green-700 text-xs font-semibold hover:bg-green-100 transition">
                    📈 Grafana Dashboard →
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ── Edit Modal ── */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setEditingUser(null)}>
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-bold text-gray-800 mb-4">
              Edit {editingUser.role === "DRIVER" ? "Driver" : "User"}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Full Name</label>
                <input type="text" value={editingUser.full_name || ""}
                  onChange={(e) => setEditingUser({ ...editingUser, full_name: e.target.value })}
                  className="w-full p-2.5 border border-gray-200 rounded-lg text-sm focus:border-indigo-400 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Phone</label>
                <input type="text" value={editingUser.phone || ""}
                  onChange={(e) => setEditingUser({ ...editingUser, phone: e.target.value })}
                  className="w-full p-2.5 border border-gray-200 rounded-lg text-sm focus:border-indigo-400 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
                <select value={editingUser.status || "active"}
                  onChange={(e) => setEditingUser({ ...editingUser, status: e.target.value })}
                  className="w-full p-2.5 border border-gray-200 rounded-lg text-sm focus:border-indigo-400 outline-none cursor-pointer">
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                  <option value="banned">Banned</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => updateUser(editingUser)}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition">
                Save Changes
              </button>
              <button onClick={() => setEditingUser(null)}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm font-semibold hover:bg-gray-200 transition">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Modal ── */}
      {deleteUserId && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setDeleteUserId(null)}>
          <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-bold text-gray-800 mb-2">Confirm Delete</h3>
            <p className="text-sm text-gray-500 mb-5">This action cannot be undone.</p>
            <div className="flex gap-2">
              <button onClick={() => deleteUser(deleteUserId)}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition">Delete</button>
              <button onClick={() => setDeleteUserId(null)}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm font-semibold hover:bg-gray-200 transition">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   Sub-components
   ═══════════════════════════════════════════════════════════════════════════════ */

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="w-6 h-6 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      <span className="ml-3 text-sm text-gray-400">Loading data...</span>
    </div>
  );
}

function KPICard({ icon, label, value, color, sub }: {
  icon: string; label: string; value: string | number; color: string; sub?: string;
}) {
  const styles: Record<string, { bg: string; text: string }> = {
    blue:    { bg: "bg-blue-50 border-blue-100",      text: "text-blue-700" },
    green:   { bg: "bg-green-50 border-green-100",     text: "text-green-700" },
    purple:  { bg: "bg-purple-50 border-purple-100",   text: "text-purple-700" },
    orange:  { bg: "bg-orange-50 border-orange-100",   text: "text-orange-700" },
    amber:   { bg: "bg-amber-50 border-amber-100",    text: "text-amber-700" },
    yellow:  { bg: "bg-yellow-50 border-yellow-100",   text: "text-yellow-700" },
    emerald: { bg: "bg-emerald-50 border-emerald-100", text: "text-emerald-700" },
    teal:    { bg: "bg-teal-50 border-teal-100",      text: "text-teal-700" },
    red:     { bg: "bg-red-50 border-red-100",        text: "text-red-700" },
  };
  const s = styles[color] || styles.blue;
  return (
    <div className={`rounded-xl p-4 border shadow-sm ${s.bg}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-lg">{icon}</span>
        <span className="text-xs font-medium text-gray-500">{label}</span>
      </div>
      <p className={`text-2xl font-extrabold ${s.text}`}>{value}</p>
      {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    COMPLETED: "bg-green-100 text-green-700",
    CANCELLED: "bg-red-100 text-red-700",
    DRIVER_ASSIGNED: "bg-blue-100 text-blue-700",
    PICKED_UP: "bg-cyan-100 text-cyan-700",
    EN_ROUTE: "bg-indigo-100 text-indigo-700",
    NO_DRIVER_FOUND: "bg-gray-100 text-gray-500",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${map[status] || "bg-gray-100 text-gray-600"}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

function RoleBadge({ role }: { role: string }) {
  const map: Record<string, string> = {
    DRIVER: "bg-green-100 text-green-700",
    ADMIN: "bg-purple-100 text-purple-700",
    USER: "bg-blue-100 text-blue-700",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${map[role] || "bg-gray-100 text-gray-600"}`}>
      {role}
    </span>
  );
}

function HealthRow({ label, status, detail }: { label: string; status: "ok" | "warn" | "error"; detail?: string }) {
  return (
    <div className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${
          status === "ok" ? "bg-green-500" : status === "warn" ? "bg-yellow-400" : "bg-red-500"
        }`} />
        <span className="text-xs font-medium text-gray-700">{label}</span>
      </div>
      {detail && <span className="text-[10px] text-gray-400">{detail}</span>}
    </div>
  );
}
