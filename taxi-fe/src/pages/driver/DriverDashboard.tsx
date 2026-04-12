import { MapView } from "../../components/MapView";
import { useMemo, useState, useEffect, useRef } from "react";
import { useAuth } from "../../auth/AuthContext";
import { useSSE } from "../../sse/useSSE";
import { Timeline } from "../../components/Timeline";
import { getMyDriverState, setStatus, updateLocation } from "../../api/driver";
import { getCurrentRide, acceptRide, rejectRide, completeRide, pickupPassenger, getDriverRideHistory } from "../../api/ride";
import { getProfile, updateProfile, getInternalUserProfile } from "../../api/auth";
import { useCurrentLocation } from "../../hooks/useCurrentLocation";
import { submitReview } from "../../api/review";
import { RatingStars } from "../../components/ui/RatingStars";

export function DriverDashboard() {
  const { token, logout, driverId } = useAuth();
  const { connected, events, clear } = useSSE(token, true);
  const { loading: geoLoading, error: geoError, getCurrentLocation } = useCurrentLocation();

  // Profile state
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileFullName, setProfileFullName] = useState("");
  const [profilePhone, setProfilePhone] = useState("");
  const [profileVehicleType, setProfileVehicleType] = useState("CAR_4");
  const [profileLicensePlate, setProfileLicensePlate] = useState("");
  const [profileDriverLicense, setProfileDriverLicense] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  const [vehicleType, setVehicleType] = useState("CAR_4");
  const [status, setSt] = useState<"ONLINE" | "OFFLINE" | "BUSY">("OFFLINE");
  const [lat, setLat] = useState("10.762622");
  const [lng, setLng] = useState("106.660172");
  const [currentRideId, setCurrentRideId] = useState<string | null>(null);
  const [currentRideInfo, setCurrentRideInfo] = useState<{
    bookingId?: string;
    userId?: string;
    pickup?: { lat: number; lng: number; address?: string | null } | null;
    dropoff?: { lat: number; lng: number; address?: string | null } | null;
    fare?: number | null;
    distanceM?: number | null;
    durationS?: number | null;
    currency?: string;
    userProfile?: { full_name?: string | null; phone?: string | null } | null;
  } | null>(null);
  // DRIVER_ASSIGNED = heading to pickup, PICKED_UP = passenger on board
  const [rideStatus, setRideStatus] = useState<"DRIVER_ASSIGNED" | "PICKED_UP" | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [rideCancelledMsg, setRideCancelledMsg] = useState<string | null>(null);
  // Ride IDs that have been accepted/rejected/completed — permanently hidden from offer panel
  const [dismissedRideIds, setDismissedRideIds] = useState<Set<string>>(new Set());
  // Offer restored from API on page load (SSE event is gone after refresh)
  const [restoredOffer, setRestoredOffer] = useState<{
    payload: {
      rideId: string;
      bookingId: string;
      expiresInSec: number;
      pickup?: { lat: number; lng: number; address?: string | null } | null;
      dropoff?: { lat: number; lng: number; address?: string | null } | null;
      fare?: number | null;
      distanceM?: number | null;
      durationS?: number | null;
      currency?: string;
      userProfile?: { full_name?: string | null; phone?: string | null } | null;
    }
  } | null>(null);
  // Ref to track which SSE events we've already processed (prevent re-firing on reconnect)
  const lastProcessedEventTsRef = useRef<number>(0);
  // Timer ref for auto-expiring the current offer
  const offerExpireTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Completed ride history (loaded on mount + appended when completing a ride)
  const [completedRides, setCompletedRides] = useState<Array<{
    rideId: string;
    bookingId: string;
    completedAt: string;
    pickupLabel?: string;
    dropoffLabel?: string;
    fare?: number;
    currency?: string;
  }>>([]); 
  // Rating after completing ride
  const [rideJustCompleted, setRideJustCompleted] = useState<{
    rideId: string; userId?: string; fare?: number; currency?: string;
  } | null>(null);
  const [ratingValue, setRatingValue] = useState(5);
  const [ratingComment, setRatingComment] = useState("");
  const [ratingSubmitting, setRatingSubmitting] = useState(false);

  function dismissOffer(rideId: string) {
    setDismissedRideIds((prev) => new Set([...prev, rideId]));
    // Also clear restoredOffer if it matches
    setRestoredOffer((prev) => (prev?.payload?.rideId === rideId ? null : prev));
  }

  // Cleanup offer expire timer on unmount
  useEffect(() => {
    return () => {
      if (offerExpireTimerRef.current) clearTimeout(offerExpireTimerRef.current);
    };
  }, []);

  // Auto-restore previous state (valid for 30 minutes)
  useEffect(() => {
    async function loadPreviousState() {
      if (!token) return;
      
      try {
        // Load driver state (status, vehicle, location)
        const driverState = await getMyDriverState();
        console.log("📦 Restored driver state:", driverState);
        
        if (driverState.status && driverState.status !== "OFFLINE") {
          setSt(driverState.status);
        }
        if (driverState.vehicleType) {
          setVehicleType(driverState.vehicleType);
        }
        if (driverState.location) {
          const lat = typeof driverState.location.lat === "number" 
            ? driverState.location.lat 
            : parseFloat(driverState.location.lat);
          const lng = typeof driverState.location.lng === "number" 
            ? driverState.location.lng 
            : parseFloat(driverState.location.lng);
          
          if (!isNaN(lat) && !isNaN(lng)) {
            setLat(lat.toFixed(6));
            setLng(lng.toFixed(6));
          }
        }

        // Load current ride (active or offered)
        const rideState = await getCurrentRide();
        console.log("🚗 Restored ride state:", rideState);
        
        if (rideState.type === "active" && rideState.ride) {
          setCurrentRideId(rideState.ride.id);
          setSt("BUSY");
          // Restore ride status from DB
          if (rideState.ride.status === "PICKED_UP") setRideStatus("PICKED_UP");
          else setRideStatus("DRIVER_ASSIGNED");
          // Restore ride info from DB columns
          setCurrentRideInfo({
            bookingId: rideState.ride.booking_id,
            userId: rideState.ride.user_id || undefined,
            pickup:  rideState.ride.pickup  || null,
            dropoff: rideState.ride.dropoff || null,
            fare:      rideState.ride.fare       != null ? Number(rideState.ride.fare) : null,
            distanceM: rideState.ride.distance_m ?? null,
            durationS: rideState.ride.duration_s ?? null,
            currency:  rideState.ride.currency || "VND",
            userProfile: null, // will be filled below
          });
          // Fetch passenger profile for restored active ride
          if (rideState.ride.user_id) {
            try {
              const pData = await getInternalUserProfile(rideState.ride.user_id);
              if (pData) setCurrentRideInfo(prev => prev ? { ...prev, userProfile: pData } : prev);
            } catch {}
          }
          console.log("✅ Restored active ride:", rideState.ride.id);
        } else if (rideState.type === "offered" && rideState.ride) {
          const ride = rideState.ride;
          const remainingSec = ride.offer_expires_at
            ? Math.max(0, Math.floor((new Date(ride.offer_expires_at).getTime() - Date.now()) / 1000))
            : 30;
          if (remainingSec > 0) {
            console.log("🔔 Restored pending offer:", ride.id, "expires in", remainingSec, "s");
            setRestoredOffer({
              payload: {
                rideId: ride.id,
                bookingId: ride.booking_id,
                expiresInSec: remainingSec,
                pickup: ride.pickup || null,
                dropoff: ride.dropoff || null,
                fare: ride.fare != null ? Number(ride.fare) : null,
                distanceM: ride.distance_m ?? null,
                durationS: ride.duration_s ?? null,
                currency: ride.currency || "VND",
              },
            });
            // Auto-expire timer from remaining time
            if (offerExpireTimerRef.current) clearTimeout(offerExpireTimerRef.current);
            offerExpireTimerRef.current = setTimeout(() => {
              console.log("⏱️ Restored offer expired for ride", ride.id);
              setRestoredOffer(null);
              offerExpireTimerRef.current = null;
            }, (remainingSec + 1) * 1000);
          } else {
            console.log("ℹ️ Pending offer already expired, skipping restore");
          }
        }

        // Load completed ride history
        console.log("📋 Loading driver ride history...");
        const histData = await getDriverRideHistory();
        if (histData.rides?.length) {
          console.log(`✅ Loaded ${histData.rides.length} completed rides`);
          setCompletedRides(
            histData.rides.map((r: any) => ({
              rideId: r.rideId,
              bookingId: r.bookingId,
              completedAt: new Date(r.completedAt).toLocaleString("vi-VN"),
              pickupLabel: r.pickup?.address || (r.pickup ? `${r.pickup.lat}, ${r.pickup.lng}` : ""),
              dropoffLabel: r.dropoff?.address || (r.dropoff ? `${r.dropoff.lat}, ${r.dropoff.lng}` : ""),
              fare: r.fare,
              currency: r.currency || "VND",
            }))
          );
        }
        
      } catch (err) {
        console.error("Failed to load previous state:", err);
      }
    }
    loadPreviousState();
  }, [token]); // Re-run when token changes (login/logout)

  // Load driver profile
  useEffect(() => {
    if (!token) return;
    getProfile().then((res: any) => {
      const p = res.profile || {};
      setProfileFullName(p.full_name || "");
      setProfilePhone(p.phone || "");
      setProfileVehicleType(p.vehicle_type || "CAR_4");
      setProfileLicensePlate(p.license_plate || "");
      setProfileDriverLicense(p.driver_license || "");
    }).catch(() => {});
  }, [token]);

  // When SSE confirms ride_completed or offer cancelled — processed exactly once
  useEffect(() => {
    if (events.length === 0) return;
    const newEvents = events
      .filter((e) => e.ts > lastProcessedEventTsRef.current)
      .sort((a, b) => a.ts - b.ts);
    if (newEvents.length === 0) return;
    lastProcessedEventTsRef.current = newEvents[newEvents.length - 1].ts;

    for (const ev of newEvents) {
      if (ev.eventName === "ride_completed") {
        const completedRideId = ev.data?.payload?.rideId;
        if (completedRideId && completedRideId === currentRideId) {
          console.log("🏁 SSE ride_completed matches current ride — resetting driver state");
          setCurrentRideId(null);
          setCurrentRideInfo(null);
          setRideStatus(null);
          setSt("ONLINE");
        }
      } else if (ev.eventName === "passenger_picked_up") {
        const rideId = ev.data?.payload?.rideId;
        if (rideId && rideId === currentRideId) {
          setRideStatus("PICKED_UP");
        }
      } else if (ev.eventName === "ride_cancelled") {
        const rideId = ev.data?.payload?.rideId;
        if (rideId && rideId === currentRideId) {
          console.log("🚨 Ride cancelled by user:", rideId);
          setCurrentRideId(null);          setCurrentRideInfo(null);          setRideStatus(null);          setSt("ONLINE");
          setRideCancelledMsg("⚠️ Khách hàng đã hủy chuyến. Bạn sẽ nhận chuyến mới.");
          setTimeout(() => setRideCancelledMsg(null), 10000);
        }
      } else if (ev.eventName === "ride_offer_cancelled") {
        const rideId = ev.data?.payload?.rideId;
        if (rideId) {
          console.log("🚫 Offer cancelled for ride", rideId);
          dismissOffer(rideId);
          if (offerExpireTimerRef.current) {
            clearTimeout(offerExpireTimerRef.current);
            offerExpireTimerRef.current = null;
          }
        }
      } else if (ev.eventName === "ride_offer") {
        // Start auto-expire timer based on expiresInSec from offer payload
        const expiresInSec = ev.data?.payload?.expiresInSec;
        const rideId = ev.data?.payload?.rideId || ev.data?.payload?.ride_id;
        if (rideId && expiresInSec) {
          if (offerExpireTimerRef.current) clearTimeout(offerExpireTimerRef.current);
          offerExpireTimerRef.current = setTimeout(() => {
            console.log("⏱️ Offer timed out on frontend for ride", rideId);
            dismissOffer(rideId);
            offerExpireTimerRef.current = null;
          }, (expiresInSec + 1) * 1000); // +1s grace
        }
      }
    }
  }, [events, currentRideId]); // eslint-disable-line react-hooks/exhaustive-deps

  const lastOffer = useMemo(() => {
    // Show only ride_offer events that haven't been accepted/rejected/completed.
    const e = events.find((x) => {
      if (x.eventName !== "ride_offer") return false;
      const payload = x.data?.payload || {};
      const rideId = payload.rideId || payload.ride_id;
      if (!rideId) return false;
      return !dismissedRideIds.has(rideId);
    });
    if (e) return e.data;
    // Fall back to offer restored from API on page load
    if (restoredOffer && !dismissedRideIds.has(restoredOffer.payload.rideId)) {
      return restoredOffer;
    }
    return null;
  }, [events, dismissedRideIds, restoredOffer]);

  const offeredRideId = lastOffer?.payload?.rideId || lastOffer?.payload?.ride_id || null;

  async function useMyLocation() {
    const loc = await getCurrentLocation();
    if (loc) {
      setLat(loc.lat.toFixed(6));
      setLng(loc.lng.toFixed(6));
      // Tự động cập nhật vị trí lên server
      try {
        await updateLocation({ lat: loc.lat, lng: loc.lng, accuracyM: loc.accuracy || 10 });
      } catch (err) {
        console.error("Failed to update location:", err);
      }
    }
  }

  async function doSetStatus(next: "ONLINE" | "OFFLINE") {
    setBusy("status");
    try {
      // When going ONLINE, include current lat/lng so driver is immediately
      // discoverable by ride-service (GEOADD in driver-service)
      const body: { status: "ONLINE" | "OFFLINE"; vehicleType: string; lat?: number; lng?: number } = { status: next, vehicleType };
      if (next === "ONLINE") {
        body.lat = Number(lat);
        body.lng = Number(lng);
      }
      const resp = await setStatus(body);
      setSt(resp.status || next);

      // After going online, also try to get browser GPS and update for accuracy
      if (next === "ONLINE") {
        getCurrentLocation().then((loc) => {
          if (loc) {
            setLat(loc.lat.toFixed(6));
            setLng(loc.lng.toFixed(6));
            updateLocation({ lat: loc.lat, lng: loc.lng, accuracyM: loc.accuracy || 10 }).catch(() => {});
          }
        });
      }
    } finally {
      setBusy(null);
    }
  }

  async function doLocation() {
    setBusy("loc");
    try {
      await updateLocation({ lat: Number(lat), lng: Number(lng), accuracyM: 10 });
      // keep UI simple
    } finally {
      setBusy(null);
    }
  }

  async function doAccept() {
    if (!offeredRideId) return;
    setBusy("accept");
    try {
      await acceptRide(String(offeredRideId));
      // Snapshot the offer details before dismissing
      const offerPayload = lastOffer?.payload;
      setCurrentRideInfo(offerPayload ? {
        bookingId: offerPayload.bookingId || offerPayload.booking_id,
        userId: offerPayload.userId || offerPayload.user_id || undefined,
        pickup:    offerPayload.pickup  || null,
        dropoff:   offerPayload.dropoff || null,
        fare:      offerPayload.fare      ?? null,
        distanceM: offerPayload.distanceM ?? null,
        durationS: offerPayload.durationS ?? null,
        currency:  offerPayload.currency  || "VND",
        userProfile: offerPayload.userProfile || null,
      } : null);
      setRideStatus("DRIVER_ASSIGNED");
      dismissOffer(String(offeredRideId));
      setCurrentRideId(String(offeredRideId));
      setSt("BUSY");
    } finally {
      setBusy(null);
    }
  }

  async function doReject() {
    if (!offeredRideId) return;
    setBusy("reject");
    try {
      await rejectRide(String(offeredRideId));
      dismissOffer(String(offeredRideId)); // permanently hide this offer
    } finally {
      setBusy(null);
    }
  }

  async function doPickup() {
    if (!currentRideId) return;
    setBusy("pickup");
    try {
      await pickupPassenger(String(currentRideId));
      setRideStatus("PICKED_UP");
    } catch (e: any) {
      alert(e?.response?.data?.error || e.message || "Lỗi cập nhật trạng thái");
    } finally {
      setBusy(null);
    }
  }

  async function doComplete() {
    if (!currentRideId) return;
    setBusy("complete");
    try {
      await completeRide(String(currentRideId));
      dismissOffer(String(currentRideId));
      // Save info for rating before clearing
      setRideJustCompleted({
        rideId: String(currentRideId),
        userId: currentRideInfo?.userId || undefined,
        fare: currentRideInfo?.fare ? Number(currentRideInfo.fare) : undefined,
        currency: currentRideInfo?.currency || "VND",
      });
      // Try to get the userId from the booking/ride so we can submit rating
      // The ride's booking user is the reviewee
      setCurrentRideId(null);
      setCurrentRideInfo(null);
      setRideStatus(null);
      setSt("ONLINE");
      // Reload history from server after short delay so DB has committed
      setTimeout(async () => {
        try {
          const histData = await getDriverRideHistory();
          if (histData.rides?.length) {
            setCompletedRides(
              histData.rides.map((r: any) => ({
                rideId: r.rideId,
                bookingId: r.bookingId,
                completedAt: new Date(r.completedAt).toLocaleString("vi-VN"),
                pickupLabel: r.pickup?.address || (r.pickup ? `${r.pickup.lat}, ${r.pickup.lng}` : ""),
                dropoffLabel: r.dropoff?.address || (r.dropoff ? `${r.dropoff.lat}, ${r.dropoff.lng}` : ""),
                fare: r.fare,
                currency: r.currency || "VND",
              }))
            );
          }
        } catch (e) {
          console.error("History reload failed:", e);
        }
      }, 2000);
    } finally {
      setBusy(null);
    }
  }

  // Compute map data for driver view
  const driverPos = { lat: Number(lat), lng: Number(lng) };
  const ridePickup = currentRideInfo?.pickup || lastOffer?.payload?.pickup || null;
  const rideDropoff = currentRideInfo?.dropoff || lastOffer?.payload?.dropoff || null;
  const mapCenter = ridePickup ? { lat: Number(ridePickup.lat), lng: Number(ridePickup.lng) } : driverPos;

  // Smart route: DRIVER_ASSIGNED => driver→pickup, PICKED_UP => pickup→dropoff
  const routeFrom = currentRideId
    ? (rideStatus === "PICKED_UP" && ridePickup ? { lat: Number(ridePickup.lat), lng: Number(ridePickup.lng) } : driverPos)
    : undefined;
  const routeTo = currentRideId
    ? (rideStatus === "PICKED_UP" && rideDropoff ? { lat: Number(rideDropoff.lat), lng: Number(rideDropoff.lng) } : (ridePickup ? { lat: Number(ridePickup.lat), lng: Number(ridePickup.lng) } : undefined))
    : undefined;

  // State for events panel
  const [showEvents, setShowEvents] = useState(false);

  return (
    <div className="h-screen w-full max-w-[480px] mx-auto flex flex-col overflow-hidden relative bg-gray-900 sm:shadow-2xl">
      {/* ═══ Full-screen Map ═══ */}
      <div className="absolute inset-0 z-0">
        <MapView
          center={mapCenter}
          pickup={ridePickup ? { lat: Number(ridePickup.lat), lng: Number(ridePickup.lng), label: ridePickup.address || "Pickup" } : undefined}
          dropoff={rideDropoff ? { lat: Number(rideDropoff.lat), lng: Number(rideDropoff.lng), label: rideDropoff.address || "Dropoff" } : undefined}
          driver={{ ...driverPos, label: "You" }}
          routeFrom={routeFrom}
          routeTo={routeTo}
          height="100%"
        />
      </div>

      {/* ═══ Floating Header ═══ */}
      <header className="relative z-20 m-3">
        <div className="glass rounded-2xl px-4 py-3 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-600 flex items-center justify-center shadow-md">
                <span className="text-xl">🚗</span>
              </div>
              <div>
                <h1 className="font-bold text-gray-900 text-sm">Driver Mode</h1>
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${status === "ONLINE" ? "bg-green-500" : status === "BUSY" ? "bg-yellow-500" : "bg-red-400"}`} />
                  <span className="text-xs text-gray-500">{status}</span>
                  {connected && <span className="text-xs text-green-600">● Connected</span>}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <a href="/driver/history"
                className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center text-sm hover:bg-gray-200 transition"
                title="History">📋</a>
              <button onClick={() => setShowEvents(!showEvents)}
                className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center text-sm hover:bg-gray-200 transition">📊</button>
              <button onClick={() => setProfileOpen(true)}
                className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center text-sm hover:bg-gray-200 transition">👤</button>
              <button onClick={logout}
                className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center text-sm hover:bg-red-100 transition">🚪</button>
            </div>
          </div>

          {/* Big Status Toggle */}
          <div className="flex gap-2 mt-3">
            <button disabled={busy === "status"} onClick={() => doSetStatus("ONLINE")}
              className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition ${status === "ONLINE" || status === "BUSY" ? "bg-green-500 text-white shadow-lg shadow-green-500/30" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>
              {busy === "status" ? "..." : "🟢 Online"}
            </button>
            <button disabled={busy === "status"} onClick={() => doSetStatus("OFFLINE")}
              className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition ${status === "OFFLINE" ? "bg-red-500 text-white shadow-lg shadow-red-500/30" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>
              {busy === "status" ? "..." : "🔴 Offline"}
            </button>
          </div>
        </div>
      </header>

      {/* ═══ Events Panel ═══ */}
      {showEvents && (
        <div className="absolute top-44 right-3 z-30 w-80 max-h-[50vh] glass rounded-2xl shadow-2xl overflow-hidden animate-fade-in">
          <div className="p-3 border-b border-gray-200/50 flex justify-between items-center">
            <span className="font-bold text-sm text-gray-800">📊 Events</span>
            <div className="flex gap-2">
              <button onClick={clear} className="text-xs px-2 py-1 bg-gray-100 rounded-lg hover:bg-gray-200">Clear</button>
              <button onClick={() => setShowEvents(false)} className="text-xs px-2 py-1 bg-gray-100 rounded-lg hover:bg-gray-200">✕</button>
            </div>
          </div>
          <div className="p-3 overflow-auto max-h-[40vh]">
            <Timeline events={events} />
          </div>
        </div>
      )}

      {/* ═══ Ride Cancelled Banner ═══ */}
      {rideCancelledMsg && (
        <div className="relative z-20 mx-3 mt-1 animate-fade-in">
          <div className="glass rounded-xl p-3 border border-orange-200">
            <p className="text-sm font-semibold text-orange-800">{rideCancelledMsg}</p>
          </div>
        </div>
      )}

      {/* ═══ RIDE OFFER OVERLAY ═══ */}
      {offeredRideId && !currentRideId && (
        <div className="absolute inset-0 z-40 flex items-end justify-center bg-black/20 animate-fade-in">
          <div className="w-full max-w-lg bg-white rounded-t-3xl shadow-2xl animate-slide-up">
            <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 rounded-full bg-gray-300" /></div>

            {/* Offer Header */}
            <div className="px-5 pt-2 pb-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-14 h-14 rounded-2xl bg-orange-500 flex items-center justify-center shadow-lg animate-pulse">
                  <span className="text-3xl">🔔</span>
                </div>
                <div>
                  <h2 className="text-xl font-extrabold text-gray-900">New Ride Request!</h2>
                  <p className="text-sm text-gray-500">Tap accept to start earning</p>
                </div>
              </div>

              {/* Passenger Info */}
              {(lastOffer?.payload?.userProfile?.full_name || lastOffer?.payload?.userProfile?.phone) && (
                <div className="bg-yellow-50 rounded-2xl p-3 mb-3 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-yellow-200 flex items-center justify-center"><span>👤</span></div>
                  <div>
                    {lastOffer.payload.userProfile?.full_name && <p className="font-bold text-gray-900">{lastOffer.payload.userProfile.full_name}</p>}
                    {lastOffer.payload.userProfile?.phone && <p className="text-sm text-gray-500">{lastOffer.payload.userProfile.phone}</p>}
                  </div>
                </div>
              )}

              {/* Route */}
              <div className="bg-gray-50 rounded-2xl p-4 space-y-3 mb-3">
                {lastOffer?.payload?.pickup && (
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0"><span className="text-sm">📍</span></div>
                    <div className="min-w-0"><p className="text-xs text-gray-400 uppercase font-semibold">Pickup</p><p className="text-sm font-medium text-gray-800 truncate">{lastOffer.payload.pickup.address || `${Number(lastOffer.payload.pickup.lat).toFixed(5)}, ${Number(lastOffer.payload.pickup.lng).toFixed(5)}`}</p></div>
                  </div>
                )}
                <div className="ml-4 border-l-2 border-dashed border-gray-300 h-3" />
                {lastOffer?.payload?.dropoff && (
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0"><span className="text-sm">🏁</span></div>
                    <div className="min-w-0"><p className="text-xs text-gray-400 uppercase font-semibold">Dropoff</p><p className="text-sm font-medium text-gray-800 truncate">{lastOffer.payload.dropoff.address || `${Number(lastOffer.payload.dropoff.lat).toFixed(5)}, ${Number(lastOffer.payload.dropoff.lng).toFixed(5)}`}</p></div>
                  </div>
                )}
              </div>

              {/* Fare & Distance */}
              {(lastOffer?.payload?.fare != null || lastOffer?.payload?.distanceM != null) && (
                <div className="flex gap-3 mb-4">
                  {lastOffer?.payload?.fare != null && (
                    <div className="flex-1 text-center bg-amber-50 rounded-2xl p-3 border border-amber-200">
                      <p className="text-xs text-gray-400 mb-1">Fare</p>
                      <p className="text-2xl font-extrabold text-orange-600">{Number(lastOffer.payload.fare).toLocaleString("vi-VN")}</p>
                      <p className="text-xs text-gray-400">{lastOffer.payload.currency || "VND"}</p>
                    </div>
                  )}
                  {lastOffer?.payload?.distanceM != null && (
                    <div className="flex-1 text-center bg-green-50 rounded-2xl p-3 border border-green-200">
                      <p className="text-xs text-gray-400 mb-1">Distance</p>
                      <p className="text-2xl font-extrabold text-green-600">{lastOffer.payload.distanceM >= 1000 ? (lastOffer.payload.distanceM / 1000).toFixed(1) : lastOffer.payload.distanceM}</p>
                      <p className="text-xs text-gray-400">{lastOffer.payload.distanceM >= 1000 ? "km" : "m"}</p>
                    </div>
                  )}
                </div>
              )}

              {/* BIG Accept/Reject Buttons */}
              <div className="flex gap-3">
                <button disabled={busy === "reject"} onClick={doReject}
                  className="flex-1 py-4 rounded-2xl bg-red-500 text-white font-extrabold text-lg hover:bg-red-600 disabled:bg-gray-300 transition shadow-lg shadow-red-500/30 active:scale-95">
                  {busy === "reject" ? "..." : "✕ Reject"}
                </button>
                <button disabled={busy === "accept"} onClick={doAccept}
                  className="flex-[2] py-4 rounded-2xl bg-green-500 text-white font-extrabold text-lg hover:bg-green-600 disabled:bg-gray-300 transition shadow-lg shadow-green-500/30 active:scale-95">
                  {busy === "accept" ? "Accepting..." : "✓ Accept"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Bottom Panel ═══ */}
      <div className="relative z-10 mt-auto">
        <div className="bg-white rounded-t-3xl shadow-[0_-8px_30px_rgba(0,0,0,0.12)] animate-slide-up">
          <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 rounded-full bg-gray-300" /></div>

          <div className="px-5 pb-5">
            {/* ── Active Ride ── */}
            {currentRideId ? (
              <div className="animate-fade-in">
                <div className={`rounded-2xl p-4 mb-3 ${rideStatus === "PICKED_UP" ? "bg-green-50 border border-green-200" : "bg-blue-50 border border-blue-200"}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${rideStatus === "PICKED_UP" ? "bg-green-500" : "bg-blue-500"}`}>
                      <span className="text-2xl">{rideStatus === "PICKED_UP" ? "🚙" : "🚕"}</span>
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900">{rideStatus === "PICKED_UP" ? "Passenger on board" : "Head to pickup"}</h3>
                      <p className="text-sm text-gray-500">{rideStatus === "PICKED_UP" ? "Drive to destination" : "Pick up your passenger"}</p>
                    </div>
                  </div>
                </div>

                {/* Passenger Info */}
                {(currentRideInfo?.userProfile?.full_name || currentRideInfo?.userProfile?.phone) && (
                  <div className="bg-yellow-50 rounded-2xl p-3 mb-3 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-yellow-200 flex items-center justify-center"><span>👤</span></div>
                    <div className="flex-1">
                      {currentRideInfo.userProfile?.full_name && <p className="font-bold text-gray-900">{currentRideInfo.userProfile.full_name}</p>}
                      {currentRideInfo.userProfile?.phone && <p className="text-sm text-gray-500">📞 {currentRideInfo.userProfile.phone}</p>}
                    </div>
                    {currentRideInfo.userProfile?.phone && (
                      <a href={`tel:${currentRideInfo.userProfile.phone}`} className="w-11 h-11 rounded-full bg-green-500 flex items-center justify-center shadow-md">
                        <span className="text-white">📞</span>
                      </a>
                    )}
                  </div>
                )}

                {/* Fare Info */}
                {(currentRideInfo?.fare != null || currentRideInfo?.distanceM != null) && (
                  <div className="flex gap-2 mb-3">
                    {currentRideInfo?.fare != null && (
                      <div className="flex-1 text-center bg-amber-50 rounded-xl p-2.5">
                        <p className="text-xs text-gray-400">Fare</p>
                        <p className="text-lg font-extrabold text-orange-600">{Number(currentRideInfo.fare).toLocaleString()} {currentRideInfo.currency || "VND"}</p>
                      </div>
                    )}
                    {currentRideInfo?.distanceM != null && (
                      <div className="flex-1 text-center bg-green-50 rounded-xl p-2.5">
                        <p className="text-xs text-gray-400">Distance</p>
                        <p className="text-lg font-extrabold text-green-600">{currentRideInfo.distanceM >= 1000 ? `${(currentRideInfo.distanceM / 1000).toFixed(1)} km` : `${currentRideInfo.distanceM} m`}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="space-y-2">
                  {rideStatus === "DRIVER_ASSIGNED" && (
                    <button disabled={busy === "pickup"} onClick={doPickup}
                      className="w-full py-4 rounded-2xl bg-green-500 text-white font-extrabold text-lg hover:bg-green-600 disabled:bg-gray-300 transition shadow-lg active:scale-95">
                      {busy === "pickup" ? "Updating..." : "🙋 Picked Up Passenger"}
                    </button>
                  )}
                  <button disabled={busy === "complete"} onClick={doComplete}
                    className="w-full py-4 rounded-2xl bg-indigo-600 text-white font-extrabold text-lg hover:bg-indigo-700 disabled:opacity-50 transition shadow-lg active:scale-95">
                    {busy === "complete" ? "Completing..." : "✅ Complete Ride"}
                  </button>
                </div>
              </div>

            ) : (
              /* ── Idle: Location + Waiting ── */
              <div className="animate-fade-in">
                {/* Location */}
                <div className="mb-4">
                  <div className="bg-gray-50 rounded-2xl p-3 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-lg">📍</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-500">Current Location</p>
                      <p className="text-sm font-mono text-gray-700">{Number(lat).toFixed(4)}, {Number(lng).toFixed(4)}</p>
                    </div>
                    <button onClick={useMyLocation} disabled={geoLoading}
                      className="px-3 py-2 rounded-xl bg-green-500 text-white text-xs font-bold hover:bg-green-600 disabled:opacity-50 transition">
                      {geoLoading ? "..." : "📍"}
                    </button>
                  </div>
                  {geoError && <p className="text-red-500 text-xs mt-1">{geoError}</p>}
                  <button disabled={busy === "loc"} onClick={doLocation}
                    className="w-full mt-2 py-2.5 rounded-xl bg-purple-600 text-white font-semibold text-sm disabled:opacity-50 hover:bg-purple-700 transition">
                    {busy === "loc" ? "Updating..." : "🔄 Update Location"}
                  </button>
                </div>

                {/* Vehicle Type */}
                <div className="flex gap-2 mb-4">
                  {[{ v: "CAR_4", icon: "🚗", label: "Standard" }, { v: "CAR_7", icon: "🚐", label: "XL" }].map(({ v, icon, label }) => (
                    <button key={v} onClick={() => setVehicleType(v)}
                      className={`flex-1 py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition border-2 ${vehicleType === v ? "border-purple-500 bg-purple-50 text-purple-700" : "border-gray-200 text-gray-500"}`}>
                      <span>{icon}</span>{label}
                    </button>
                  ))}
                </div>

                {/* Waiting Status */}
                {status === "ONLINE" && !offeredRideId && (
                  <div className="text-center py-4 bg-gray-50 rounded-2xl">
                    <div className="relative w-16 h-16 mx-auto mb-3">
                      <div className="absolute inset-0 rounded-full bg-purple-400/20 animate-pulse-ring" />
                      <div className="absolute inset-3 rounded-full bg-purple-500 flex items-center justify-center">
                        <span className="text-xl">📡</span>
                      </div>
                    </div>
                    <p className="text-sm font-medium text-gray-600">Waiting for ride offers...</p>
                    <p className="text-xs text-gray-400 mt-1">Stay online to receive requests</p>
                  </div>
                )}

                {/* Recent Completed Rides */}
                {completedRides.length > 0 && (
                  <div className="mt-4">
                    <h3 className="text-sm font-bold text-gray-700 mb-2">📋 Recent Rides</h3>
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                      {completedRides.slice(0, 3).map((r) => (
                        <div key={r.rideId} className="flex items-center justify-between bg-gray-50 rounded-xl p-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-800 truncate">{r.dropoffLabel || r.pickupLabel || "Ride"}</p>
                            <p className="text-xs text-gray-400">{r.completedAt}</p>
                          </div>
                          {r.fare && <span className="text-sm font-bold text-green-600 ml-2">+{r.fare.toLocaleString()}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══ Rating Overlay after ride completion ═══ */}
      {rideJustCompleted && (
        <div className="absolute inset-0 z-40 flex items-end sm:items-center justify-center bg-black/40 animate-fade-in">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-[400px] shadow-2xl animate-slide-up">
            <div className="flex justify-center pt-3 sm:hidden"><div className="w-10 h-1 rounded-full bg-gray-300" /></div>
            <div className="p-6 text-center">
              <div className="text-5xl mb-2">✅</div>
              <h2 className="text-xl font-bold text-gray-900">Ride Completed!</h2>
              {rideJustCompleted.fare && (
                <p className="text-2xl font-extrabold text-green-600 mt-1">+{rideJustCompleted.fare.toLocaleString()} {rideJustCompleted.currency || "VND"}</p>
              )}
              <p className="text-gray-500 text-sm mt-2 mb-4">Rate your passenger</p>
              <div className="flex justify-center mb-4">
                <RatingStars rating={ratingValue} onChange={setRatingValue} size="lg" />
              </div>
              <textarea value={ratingComment} onChange={(e) => setRatingComment(e.target.value)}
                placeholder="Leave a comment (optional)..."
                rows={2}
                className="w-full rounded-xl border-2 border-gray-200 p-3 text-sm focus:border-purple-500 outline-none resize-none mb-4" />
              <div className="flex gap-3">
                <button onClick={() => { setRideJustCompleted(null); setRatingValue(5); setRatingComment(""); }}
                  className="flex-1 py-3 rounded-xl bg-gray-100 font-semibold text-sm text-gray-600 hover:bg-gray-200 transition">Skip</button>
                <button disabled={ratingSubmitting}
                  onClick={async () => {
                    setRatingSubmitting(true);
                    try {
                      await submitReview({ rideId: rideJustCompleted.rideId, reviewerId: driverId || "", reviewerRole: "DRIVER", revieweeId: rideJustCompleted.userId || "user", rating: ratingValue, comment: ratingComment.trim() || undefined });
                    } catch {}
                    setRatingSubmitting(false); setRideJustCompleted(null); setRatingValue(5); setRatingComment("");
                  }}
                  className="flex-[2] py-3 rounded-xl bg-purple-600 text-white font-bold text-sm disabled:opacity-50 hover:bg-purple-700 transition">
                  {ratingSubmitting ? "Submitting..." : "⭐ Submit Rating"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Profile Modal ═══ */}
      {profileOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center" onClick={() => setProfileOpen(false)}>
          <div className="bg-white rounded-t-3xl sm:rounded-3xl p-6 w-full sm:w-[440px] sm:max-w-[90vw] shadow-2xl animate-slide-up" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-center sm:hidden mb-3"><div className="w-10 h-1 rounded-full bg-gray-300" /></div>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-14 h-14 rounded-full bg-purple-100 flex items-center justify-center"><span className="text-2xl">🚗</span></div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">{profileFullName || "Driver"}</h2>
                <p className="text-sm text-gray-500">{driverId?.substring(0, 16)}...</p>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Full Name</label>
                <input type="text" value={profileFullName} onChange={(e) => setProfileFullName(e.target.value)}
                  className="w-full p-3 rounded-xl border-2 border-gray-200 text-sm focus:border-purple-500 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Phone</label>
                <input type="tel" value={profilePhone} onChange={(e) => setProfilePhone(e.target.value)}
                  className="w-full p-3 rounded-xl border-2 border-gray-200 text-sm focus:border-purple-500 outline-none" />
              </div>
              <div className="bg-purple-50 rounded-xl p-3 space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-purple-700 mb-1">Vehicle Type</label>
                  <select value={profileVehicleType} onChange={(e) => setProfileVehicleType(e.target.value)}
                    className="w-full p-2.5 rounded-lg border-2 border-purple-200 text-sm focus:border-purple-500 outline-none bg-white">
                    <option value="CAR_4">🚗 4-seat Car</option>
                    <option value="CAR_7">🚐 7-seat Car</option>
                  </select>
                </div>
                <div><label className="block text-xs font-semibold text-purple-700 mb-1">License Plate</label>
                  <input type="text" value={profileLicensePlate} onChange={(e) => setProfileLicensePlate(e.target.value)}
                    className="w-full p-2.5 rounded-lg border-2 border-purple-200 text-sm focus:border-purple-500 outline-none bg-white" />
                </div>
                <div><label className="block text-xs font-semibold text-purple-700 mb-1">Driver License</label>
                  <input type="text" value={profileDriverLicense} onChange={(e) => setProfileDriverLicense(e.target.value)}
                    className="w-full p-2.5 rounded-lg border-2 border-purple-200 text-sm focus:border-purple-500 outline-none bg-white" />
                </div>
              </div>
            </div>
            {profileSaved && <p className="mt-2 text-green-600 font-semibold text-sm">✅ Saved!</p>}
            <div className="flex gap-3 mt-5">
              <button onClick={() => setProfileOpen(false)} className="flex-1 py-3 rounded-xl bg-gray-100 font-semibold text-sm hover:bg-gray-200 transition">Close</button>
              <button disabled={profileSaving}
                onClick={async () => {
                  setProfileSaving(true); setProfileSaved(false);
                  try { await updateProfile({ fullName: profileFullName, phone: profilePhone, vehicleType: profileVehicleType, licensePlate: profileLicensePlate, driverLicense: profileDriverLicense }); setProfileSaved(true); setTimeout(() => setProfileSaved(false), 3000); } catch {}
                  setProfileSaving(false);
                }}
                className="flex-[2] py-3 rounded-xl bg-purple-600 text-white font-semibold text-sm disabled:opacity-50 hover:bg-purple-700 transition">
                {profileSaving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
