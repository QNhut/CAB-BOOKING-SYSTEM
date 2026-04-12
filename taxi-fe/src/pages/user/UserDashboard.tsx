import { MapView } from "../../components/MapView";
import { useMemo, useState, useEffect, useRef } from "react";
import { useAuth } from "../../auth/AuthContext";
import { useSSE } from "../../sse/useSSE";
import { Timeline } from "../../components/Timeline";
import { PlaceSearchInput } from "../../components/PlaceSearchInput";
import { estimate } from "../../api/pricing";
import { createBooking, getMyActiveBooking, getUserBookingHistory, cancelBooking } from "../../api/booking";
import { getCurrentRideForUser, cancelRide } from "../../api/ride";
import { useCurrentLocation } from "../../hooks/useCurrentLocation";
import { geoReverse } from "../../api/geo";
import { getProfile, updateProfile, getInternalDriverProfile } from "../../api/auth";
import { createVnpayUrl } from "../../api/payment";
import { submitReview } from "../../api/review";
import { RatingStars } from "../../components/ui/RatingStars";

export function UserDashboard() {
  const { token, logout, userId } = useAuth();
  const { connected, events, clear } = useSSE(token, true);
  const { loading: geoLoading, error: geoError, getCurrentLocation } = useCurrentLocation();

  const [vehicleType, setVehicleType] = useState("CAR_4");
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "VNPAY">("CASH");
  const [pickup, setPickup] = useState<{ label: string; lat: number; lng: number } | null>(null);
  const [dropoff, setDropoff] = useState<{ label: string; lat: number; lng: number } | null>(null);

  const [est, setEst] = useState<any>(null);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [bookingCreatedAt, setBookingCreatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [restoredRide, setRestoredRide] = useState<any>(null);
  // Dedicated accepted ride state — explicitly cleared, not derived from accumulated events
  const [acceptedRide, setAcceptedRide] = useState<{
    rideId: string; driverId: string; bookingId: string;
  } | null>(null);
  const [rideCompleted, setRideCompleted] = useState(false);
  const [completedRides, setCompletedRides] = useState<Array<{
    rideId: string;
    driverId: string;
    bookingId: string;
    completedAt: string;
    pickupLabel?: string;
    dropoffLabel?: string;
    fare?: number;
    currency?: string;
  }>>([]); 

  // Countdown timer: 120s before auto-cancel kicks in
  const CANCEL_TIMEOUT_SEC = 120;
  const [countdown, setCountdown] = useState<number>(CANCEL_TIMEOUT_SEC);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelledMsg, setCancelledMsg] = useState<string | null>(null);
  const [rideCancelLoading, setRideCancelLoading] = useState(false);
  // Track ride sub-status: null=unknown, DRIVER_ASSIGNED=heading to pickup, PICKED_UP=on board
  const [rideStatus, setRideStatus] = useState<"DRIVER_ASSIGNED" | "PICKED_UP" | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Profile modal state
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileFullName, setProfileFullName] = useState("");
  const [profilePhone, setProfilePhone] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  // Driver profile shown during active ride
  const [driverProfile, setDriverProfile] = useState<{
    full_name?: string | null;
    phone?: string | null;
    vehicle_type?: string | null;
    license_plate?: string | null;
  } | null>(null);
  // Prevent re-processing stale SSE events (e.g. hello on reconnect re-triggers booking_cancelled)
  const lastProcessedEventTsRef = useRef<number>(0);
  // Payment confirmation banner
  const [paymentBanner, setPaymentBanner] = useState<{ status: "SUCCESS" | "FAILED"; orderId: string } | null>(null);
  // Rating after ride
  const [ratingValue, setRatingValue] = useState(5);
  const [ratingComment, setRatingComment] = useState("");
  const [ratingSubmitting, setRatingSubmitting] = useState(false);

  const bias = useMemo(() => pickup ? { lat: pickup.lat, lng: pickup.lng } : null, [pickup]);

  // activeRide: priority SSE accepted > restored from API
  const activeRide = acceptedRide ?? (restoredRide ? {
    rideId: restoredRide.id,
    driverId: restoredRide.driver_id,
    bookingId: restoredRide.booking_id,
  } : null);

  // Auto-restore user booking and ride state on mount
  useEffect(() => {
    async function loadPreviousState() {
      if (!token) return;
      
      try {
        // Load active booking
        console.log("📦 Loading user booking state...");
        const bookingData = await getMyActiveBooking();
        
        if (bookingData.booking) {
          console.log("✅ Restored booking:", bookingData.booking.id);
          setBookingId(bookingData.booking.id);
          setBookingCreatedAt(bookingData.booking.createdAt || null);
          
          // Restore pickup/dropoff
          setPickup({
            lat: bookingData.booking.pickup.lat,
            lng: bookingData.booking.pickup.lng,
            label: bookingData.booking.pickup.address || 
                   `${bookingData.booking.pickup.lat}, ${bookingData.booking.pickup.lng}`,
          });
          
          setDropoff({
            lat: bookingData.booking.dropoff.lat,
            lng: bookingData.booking.dropoff.lng,
            label: bookingData.booking.dropoff.address || 
                   `${bookingData.booking.dropoff.lat}, ${bookingData.booking.dropoff.lng}`,
          });
          
          setVehicleType(bookingData.booking.vehicleType);
          
          // Restore pricing estimate
          if (bookingData.booking.fare) {
            setEst({
              fare: bookingData.booking.fare,
              currency: bookingData.booking.currency,
              distanceM: bookingData.booking.distanceM,
              durationS: bookingData.booking.durationS,
            });
          }
        } else {
          console.log("ℹ️ No active booking found");
        }

        // Load active ride (if driver already accepted)
        console.log("🚗 Loading user ride state...");
        const rideData = await getCurrentRideForUser();
        
        if (rideData.ride) {
          console.log("✅ Restored ride:", rideData.type, rideData.ride.id);
          setRestoredRide(rideData.ride);
          // Restore pickup sub-status
          if (rideData.ride.status === "PICKED_UP") setRideStatus("PICKED_UP");
          else if (rideData.ride.status === "DRIVER_ASSIGNED") setRideStatus("DRIVER_ASSIGNED");
          // Fetch driver profile
          if (rideData.ride.driver_id) {
            getInternalDriverProfile(rideData.ride.driver_id).then(p => { if (p) setDriverProfile(p); }).catch(() => {});
          }
        } else {
          console.log("ℹ️ No active ride found");
          setRestoredRide(null);
        }

        // Load completed ride history
        console.log("📋 Loading ride history...");
        const histData = await getUserBookingHistory();
        if (histData.rides?.length) {
          console.log(`✅ Loaded ${histData.rides.length} completed rides`);
          setCompletedRides(
            histData.rides.map((r: any) => ({
              rideId: r.rideId,
              driverId: r.driverId || "",
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
        console.error("❌ Failed to load user state:", err);
      }
    }
    
    loadPreviousState();
  }, [token]);

  // Load profile when token is available
  useEffect(() => {
    if (!token) return;
    getProfile().then(({ profile }) => {
      if (profile) {
        setProfileFullName(profile.full_name || "");
        setProfilePhone(profile.phone || "");
      }
    }).catch(() => {});
  }, [token]);

  // Handle all real-time SSE events — processed exactly once using lastProcessedEventTsRef
  // to prevent stale events from re-firing on reconnect (e.g. booking_cancelled on hello)
  useEffect(() => {
    if (events.length === 0) return;
    const newEvents = events
      .filter((e) => e.ts > lastProcessedEventTsRef.current)
      .sort((a, b) => a.ts - b.ts); // process oldest first
    if (newEvents.length === 0) return;
    lastProcessedEventTsRef.current = newEvents[newEvents.length - 1].ts;

    for (const ev of newEvents) {
      if (ev.eventName === "ride_accepted") {
        const { rideId, driverId, bookingId: bkId, driverProfile: dp } = ev.data?.payload ?? {};
        if (rideId) {
          setAcceptedRide({ rideId, driverId, bookingId: bkId });
          setRestoredRide(null);
          setRideStatus("DRIVER_ASSIGNED");
          if (dp) setDriverProfile(dp);
          else if (driverId) {
            getInternalDriverProfile(driverId).then(p => { if (p) setDriverProfile(p); }).catch(() => {});
          }
        }
      } else if (ev.eventName === "passenger_picked_up") {
        setRideStatus("PICKED_UP");
      } else if (ev.eventName === "ride_completed") {
        console.log("🏁 Ride completed, resetting user state");
        const snap = ev.data?.payload;
        const rideId   = snap?.rideId   || restoredRide?.id        || acceptedRide?.rideId  || "";
        const driverId = snap?.driverId || restoredRide?.driver_id || acceptedRide?.driverId || "";
        const bkId     = snap?.bookingId || restoredRide?.booking_id || acceptedRide?.bookingId || bookingId || "";
        if (rideId) {
          setCompletedRides((prev) => [
            {
              rideId,
              driverId,
              bookingId: bkId,
              completedAt: new Date().toLocaleString("vi-VN"),
              pickupLabel: pickup?.label,
              dropoffLabel: dropoff?.label,
              fare: est?.fare,
              currency: est?.currency || "VND",
            },
            ...prev.filter((r) => r.rideId !== rideId),
          ]);
        }
        setAcceptedRide(null);
        setRestoredRide(null);
        setBookingId(null);
        setBookingCreatedAt(null);
        setPickup(null);
        setDropoff(null);
        setEst(null);
        setRideStatus(null);
        setDriverProfile(null);
        setRideCompleted(true);
        setTimeout(() => setRideCompleted(false), 20000);
        setTimeout(async () => {
          try {
            const histData = await getUserBookingHistory();
            if (histData.rides?.length) {
              setCompletedRides(
                histData.rides.map((r: any) => ({
                  rideId: r.rideId,
                  driverId: r.driverId || "",
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
            console.warn("Failed to reload history after completion:", e);
          }
        }, 3000);
      } else if (ev.eventName === "booking_cancelled") {
        const reason = ev.data?.payload?.reason;
        const msg = reason === "no_driver_timeout"
          ? "Không tìm được tài xế sau 2 phút. Booking đã bị hủy tự động."
          : "Booking đã được hủy thành công.";
        setCancelledMsg(msg);
        setAcceptedRide(null);
        setRestoredRide(null);
        setBookingId(null);
        setBookingCreatedAt(null);
        setRideStatus(null);
        setDriverProfile(null);
        setTimeout(() => setCancelledMsg(null), 10000);
      } else if (ev.eventName === "ride_cancelled") {
        // Ride cancelled by user (echo back) — clear state
        setAcceptedRide(null);
        setRestoredRide(null);
        setBookingId(null);
        setBookingCreatedAt(null);
        setRideStatus(null);
        setDriverProfile(null);
      } else if (ev.eventName === "payment") {
        const { status, orderId } = ev.data?.payload ?? {};
        if (status) {
          setPaymentBanner({ status: status as "SUCCESS" | "FAILED", orderId: orderId ?? "" });
          setTimeout(() => setPaymentBanner(null), 15000);
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events]);

  async function useMyLocation() {
    const loc = await getCurrentLocation();
    if (!loc) return;
    // Show coordinates immediately so user sees something right away
    const coordLabel = `${loc.lat.toFixed(6)}, ${loc.lng.toFixed(6)}`;
    setPickup({ label: `📍 ${coordLabel}`, lat: loc.lat, lng: loc.lng });
    // Then try to resolve a human-readable address
    const address = await geoReverse(loc.lat, loc.lng);
    if (address) {
      setPickup({ label: address, lat: loc.lat, lng: loc.lng });
    }
  }

  async function doRideCancel() {
    if (!activeRide?.rideId || rideCancelLoading) return;
    setRideCancelLoading(true);
    try {
      await cancelRide(activeRide.rideId);
      // Optimistically clear ride state
      setCancelledMsg("✅ Đã hủy chuyến thành công.");
      setAcceptedRide(null);
      setRestoredRide(null);
      setBookingId(null);
      setBookingCreatedAt(null);
      setRideStatus(null);
      setDriverProfile(null);
      setTimeout(() => setCancelledMsg(null), 6000);
    } catch (err: any) {
      const msg = err?.response?.data?.error || err.message || "Hủy chuyến thất bại";
      setCancelledMsg(`❌ ${msg}`);
      setTimeout(() => setCancelledMsg(null), 5000);
    } finally {
      setRideCancelLoading(false);
    }
  }

  // Countdown timer: start when searching for driver, stop when matched/cancelled
  useEffect(() => {
    const isSearching = !!bookingId && !activeRide;
    if (!isSearching) {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
      setCountdown(CANCEL_TIMEOUT_SEC);
      return;
    }

    // Calculate real remaining time based on when booking was created
    const elapsed = bookingCreatedAt
      ? Math.floor((Date.now() - new Date(bookingCreatedAt).getTime()) / 1000)
      : 0;
    const remaining = Math.max(CANCEL_TIMEOUT_SEC - elapsed, 0);

    if (remaining === 0) {
      setCountdown(0);
      // Already expired on restore — clear state immediately, show message only if cancel succeeds
      // (if it fails, the booking was already cancelled by backend; SSE will show the message)
      const expiredId = bookingId!;
      setAcceptedRide(null);
      setRestoredRide(null);
      setBookingId(null);
      setBookingCreatedAt(null);
      cancelBooking(expiredId)
        .then(() => {
          setCancelledMsg("Không tìm được tài xế. Booking đã bị hủy tự động.");
          setTimeout(() => setCancelledMsg(null), 10000);
        })
        .catch(() => {
          // Backend already cancelled — SSE booking_cancelled will handle the message
        });
      return;
    }

    setCountdown(remaining);
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownRef.current!);
          countdownRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [bookingId, bookingCreatedAt, activeRide]); // eslint-disable-line react-hooks/exhaustive-deps

  // When countdown reaches 0 while still searching, auto-cancel
  useEffect(() => {
    if (countdown === 0 && bookingId && !activeRide) {
      const expiredId = bookingId;
      setAcceptedRide(null);
      setRestoredRide(null);
      setBookingId(null);
      setBookingCreatedAt(null);
      cancelBooking(expiredId)
        .then(() => {
          setCancelledMsg("Không tìm được tài xế. Booking đã bị hủy tự động.");
          setTimeout(() => setCancelledMsg(null), 10000);
        })
        .catch(() => {
          // Already cancelled by backend — SSE booking_cancelled will handle the message
        });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countdown]);

  async function doCancel() {
    if (!bookingId || cancelLoading) return;
    setCancelLoading(true);
    try {
      await cancelBooking(bookingId);
      // Clear state optimistically (SSE will also arrive and clear again — idempotent)
      setCancelledMsg("Booking đã được hủy thành công.");
      setAcceptedRide(null);
      setRestoredRide(null);
      setBookingId(null);
      setBookingCreatedAt(null);
      setTimeout(() => setCancelledMsg(null), 10000);
    } catch (err: any) {
      const msg = err?.response?.data?.error || err.message || "Hủy booking thất bại";
      setCancelledMsg(`❌ ${msg}`);
      setTimeout(() => setCancelledMsg(null), 5000);
    } finally {
      setCancelLoading(false);
    }
  }

  async function doEstimate() {
    if (!pickup || !dropoff) return;
    setLoading("estimate");
    try {
      const resp = await estimate({ pickup, dropoff, vehicleType });
      setEst(resp);
    } finally {
      setLoading(null);
    }
  }

  async function doBook() {
    if (!pickup || !dropoff) return;
    setLoading("book");
    try {
      // Always fetch a fresh estimate at booking time to prevent price discrepancy
      const freshEstimate = await estimate({ pickup, dropoff, vehicleType });
      setEst(freshEstimate);

      if (!freshEstimate?.fare || !freshEstimate?.distanceM || !freshEstimate?.durationS) {
        throw new Error("Không thể tính giá. Vui lòng thử lại.");
      }

      const resp = await createBooking({
        userId,
        pickup,
        dropoff,
        vehicleType,
        paymentMethod,
        pricingSnapshot: {
          fare: freshEstimate.fare,
          distanceM: freshEstimate.distanceM,
          durationS: freshEstimate.durationS,
        }
      });
      const newBookingId = resp.bookingId || resp.id || null;
      setBookingId(newBookingId);
      setBookingCreatedAt(new Date().toISOString());

      // If VNPay, open payment page in a new tab
      if (paymentMethod === "VNPAY" && newBookingId && freshEstimate.fare) {
        try {
          const vnpay = await createVnpayUrl({
            orderId: newBookingId,
            amount: Math.round(freshEstimate.fare),
            userId: userId ?? undefined,
          });
          window.open(vnpay.paymentUrl, "_blank", "noopener,noreferrer");
        } catch (vnpErr: any) {
          console.error("VNPay URL error:", vnpErr);
          alert("⚠️ Đặt xe thành công nhưng không mở được trang VNPay. Bạn có thể thanh toán sau.");
        }
      }
    } catch (err: any) {
      alert(err?.response?.data?.error || err.message || "Tạo booking thất bại");
    } finally {
      setLoading(null);
    }
  }

  // Compute map center
  const mapCenter = pickup
    ? { lat: pickup.lat, lng: pickup.lng }
    : { lat: 10.7769, lng: 106.7009 };

  // State for events panel
  const [showEvents, setShowEvents] = useState(false);

  // Determine UI mode
  const isSearching = !!bookingId && !activeRide;
  const isRideActive = !!activeRide && !rideCompleted;

  return (
    <div className="h-screen w-full max-w-[480px] mx-auto flex flex-col overflow-hidden relative bg-gray-900 sm:shadow-2xl">
      {/* ═══ Full-screen Map Background ═══ */}
      <div className="absolute inset-0 z-0">
        <MapView
          center={mapCenter}
          pickup={pickup ? { ...pickup, label: pickup.label } : undefined}
          dropoff={dropoff ? { ...dropoff, label: dropoff.label } : undefined}
          height="100%"
        />
      </div>

      {/* ═══ Floating Header ═══ */}
      <header className="relative z-20 m-3">
        <div className="glass rounded-2xl px-4 py-3 shadow-lg flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-md">
              <span className="text-xl">🚖</span>
            </div>
            <div>
              <h1 className="font-bold text-gray-900 text-sm">CAB Booking</h1>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${connected ? "bg-green-500" : "bg-red-400"}`} />
                <span className="text-xs text-gray-500">{userId?.substring(0, 10)}...</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowEvents(!showEvents)}
              className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center text-sm hover:bg-gray-200 transition"
              title="Events">📊</button>
            <a href="/user/history"
              className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center text-sm hover:bg-gray-200 transition"
              title="History">📋</a>
            <button onClick={() => setProfileOpen(true)}
              className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center text-sm hover:bg-gray-200 transition"
              title="Profile">👤</button>
            <button onClick={logout}
              className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center text-sm hover:bg-red-100 transition"
              title="Logout">🚪</button>
          </div>
        </div>
      </header>

      {/* ═══ Events Panel (slide-in) ═══ */}
      {showEvents && (
        <div className="absolute top-20 right-3 z-30 w-80 max-h-[60vh] glass rounded-2xl shadow-2xl overflow-hidden animate-fade-in">
          <div className="p-3 border-b border-gray-200/50 flex justify-between items-center">
            <span className="font-bold text-sm text-gray-800">📊 Live Events</span>
            <div className="flex gap-2">
              <button onClick={clear} className="text-xs px-2 py-1 bg-gray-100 rounded-lg hover:bg-gray-200">Clear</button>
              <button onClick={() => setShowEvents(false)} className="text-xs px-2 py-1 bg-gray-100 rounded-lg hover:bg-gray-200">✕</button>
            </div>
          </div>
          <div className="p-3 overflow-auto max-h-[50vh]">
            <Timeline events={events} />
          </div>
        </div>
      )}

      {/* ═══ Banners ═══ */}
      {(cancelledMsg || paymentBanner) && (
        <div className="relative z-20 mx-3 mt-1 animate-fade-in">
          {cancelledMsg && (
            <div className="glass rounded-xl p-3 border border-orange-200 mb-2">
              <p className="text-sm font-semibold text-orange-800">🚫 {cancelledMsg}</p>
            </div>
          )}
          {paymentBanner && (
            <div className={`glass rounded-xl p-3 border flex items-center justify-between ${paymentBanner.status === "SUCCESS" ? "border-green-200" : "border-red-200"}`}>
              <p className="text-sm font-semibold">
                {paymentBanner.status === "SUCCESS" ? "✅" : "❌"} {paymentBanner.status === "SUCCESS" ? "Payment successful!" : "Payment failed"}
              </p>
              <button onClick={() => setPaymentBanner(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
          )}
        </div>
      )}

      {/* ═══ Ride Completed — Rating Overlay ═══ */}
      {rideCompleted && (
        <div className="absolute inset-0 z-40 flex items-end sm:items-center justify-center bg-black/40 animate-fade-in">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-[400px] shadow-2xl animate-slide-up">
            <div className="flex justify-center pt-3 sm:hidden"><div className="w-10 h-1 rounded-full bg-gray-300" /></div>
            <div className="p-6 text-center">
              <div className="text-5xl mb-2">🎉</div>
              <h2 className="text-xl font-bold text-gray-900">Ride Complete!</h2>
              {completedRides[0]?.fare && (
                <p className="text-2xl font-extrabold text-indigo-600 mt-1">{completedRides[0].fare.toLocaleString()} {completedRides[0].currency || "VND"}</p>
              )}
              <p className="text-gray-500 text-sm mt-2 mb-4">How was your driver?</p>
              <div className="flex justify-center mb-4">
                <RatingStars rating={ratingValue} onChange={setRatingValue} size="lg" />
              </div>
              <textarea value={ratingComment} onChange={(e) => setRatingComment(e.target.value)}
                placeholder="Leave a comment (optional)..."
                rows={2}
                className="w-full rounded-xl border-2 border-gray-200 p-3 text-sm focus:border-indigo-500 outline-none resize-none mb-4" />
              <div className="flex gap-3">
                <button onClick={() => { setRideCompleted(false); setRatingValue(5); setRatingComment(""); }}
                  className="flex-1 py-3 rounded-xl bg-gray-100 font-semibold text-sm text-gray-600 hover:bg-gray-200 transition">Skip</button>
                <button disabled={ratingSubmitting}
                  onClick={async () => {
                    const lastRide = completedRides[0];
                    if (!lastRide?.rideId || !lastRide?.driverId) { setRideCompleted(false); return; }
                    setRatingSubmitting(true);
                    try {
                      await submitReview({ rideId: lastRide.rideId, reviewerId: userId || "", reviewerRole: "USER", revieweeId: lastRide.driverId, rating: ratingValue, comment: ratingComment.trim() || undefined });
                    } catch {}
                    setRatingSubmitting(false); setRideCompleted(false); setRatingValue(5); setRatingComment("");
                  }}
                  className="flex-[2] py-3 rounded-xl bg-indigo-600 text-white font-bold text-sm disabled:opacity-50 hover:bg-indigo-700 transition">
                  {ratingSubmitting ? "Submitting..." : "⭐ Submit Rating"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Bottom Sheet ═══ */}
      <div className="relative z-10 mt-auto">
        <div className="bg-white rounded-t-3xl shadow-[0_-8px_30px_rgba(0,0,0,0.12)] max-h-[75vh] overflow-y-auto animate-slide-up">
          <div className="flex justify-center pt-3 pb-2"><div className="w-10 h-1 rounded-full bg-gray-300" /></div>

          <div className="px-5 pb-6">
            {/* ── Searching for Driver ── */}
            {isSearching && (
              <div className="animate-fade-in">
                <div className="text-center mb-4">
                  <div className="relative w-20 h-20 mx-auto mb-3">
                    <div className="absolute inset-0 rounded-full bg-green-400/30 animate-pulse-ring" />
                    <div className="absolute inset-2 rounded-full bg-green-400/50 animate-pulse-ring" style={{ animationDelay: '0.5s' }} />
                    <div className="absolute inset-4 rounded-full bg-green-500 flex items-center justify-center">
                      <span className="text-2xl">🔍</span>
                    </div>
                  </div>
                  <h3 className="text-lg font-bold text-gray-900">Finding your driver...</h3>
                  <p className="text-sm text-gray-500 mt-1">Please wait while we connect you</p>
                </div>

                <div className={`rounded-2xl p-4 mb-4 ${countdown <= 30 ? "bg-orange-50 border border-orange-200" : "bg-gray-50"}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-500 uppercase font-semibold tracking-wide">Auto-cancel in</p>
                      <p className={`text-3xl font-mono font-extrabold ${countdown <= 30 ? "text-orange-600" : "text-gray-800"}`}>
                        {Math.floor(countdown / 60)}:{String(countdown % 60).padStart(2, "0")}
                      </p>
                    </div>
                    <button onClick={doCancel} disabled={cancelLoading}
                      className="px-5 py-2.5 rounded-xl bg-red-500 text-white font-bold text-sm hover:bg-red-600 disabled:bg-gray-300 transition shadow-md">
                      {cancelLoading ? "Cancelling..." : "Cancel"}
                    </button>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-2xl p-4 space-y-2 text-sm">
                  {pickup && <div className="flex gap-2"><span className="text-green-500">●</span><span className="text-gray-700 truncate">{pickup.label}</span></div>}
                  {dropoff && <div className="flex gap-2"><span className="text-red-500">●</span><span className="text-gray-700 truncate">{dropoff.label}</span></div>}
                  {est?.fare && <div className="flex justify-between mt-2 pt-2 border-t border-gray-200"><span className="text-gray-500">Fare</span><span className="font-bold">{est.fare.toLocaleString()} {est.currency || "VND"}</span></div>}
                </div>
              </div>
            )}

            {/* ── Active Ride ── */}
            {isRideActive && (
              <div className="animate-fade-in">
                <div className={`rounded-2xl p-4 mb-4 ${rideStatus === "PICKED_UP" ? "bg-green-50 border border-green-200" : "bg-blue-50 border border-blue-200"}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${rideStatus === "PICKED_UP" ? "bg-green-500" : "bg-blue-500"}`}>
                      <span className="text-2xl">{rideStatus === "PICKED_UP" ? "🚙" : "🚕"}</span>
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900">{rideStatus === "PICKED_UP" ? "On the way!" : "Driver arriving"}</h3>
                      <p className="text-sm text-gray-500">{rideStatus === "PICKED_UP" ? "Heading to your destination" : "Driver is coming to pick you up"}</p>
                    </div>
                  </div>
                </div>

                {/* Driver Info */}
                {(driverProfile?.full_name || driverProfile?.phone || driverProfile?.license_plate) ? (
                  <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4 shadow-sm">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-14 h-14 rounded-full bg-indigo-100 flex items-center justify-center"><span className="text-2xl">🚗</span></div>
                      <div className="flex-1">
                        <p className="font-bold text-gray-900 text-lg">{driverProfile.full_name || "Driver"}</p>
                        {driverProfile.phone && <p className="text-sm text-gray-500">📞 {driverProfile.phone}</p>}
                      </div>
                      {driverProfile.phone && (
                        <a href={`tel:${driverProfile.phone}`} className="w-11 h-11 rounded-full bg-green-500 flex items-center justify-center shadow-md hover:bg-green-600 transition">
                          <span className="text-white text-lg">📞</span>
                        </a>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {driverProfile.vehicle_type && <span className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-bold">{driverProfile.vehicle_type === "CAR_7" ? "🚐 7-seat" : "🚗 4-seat"}</span>}
                      {driverProfile.license_plate && <span className="px-3 py-1 bg-gray-100 text-gray-800 rounded-lg text-xs font-bold border">{driverProfile.license_plate}</span>}
                    </div>
                  </div>
                ) : activeRide && (
                  <div className="bg-gray-50 rounded-2xl p-3 mb-4 text-sm text-gray-500">
                    👤 Driver: <code className="bg-white px-2 py-0.5 rounded text-xs">{activeRide.driverId?.substring(0, 10)}...</code>
                  </div>
                )}

                {/* Route */}
                <div className="bg-gray-50 rounded-2xl p-4 mb-4 space-y-3">
                  {pickup && (
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0"><span className="text-sm">📍</span></div>
                      <div className="min-w-0"><p className="text-xs text-gray-400 uppercase font-semibold">Pickup</p><p className="text-sm font-medium text-gray-800 truncate">{pickup.label}</p></div>
                    </div>
                  )}
                  <div className="ml-4 border-l-2 border-dashed border-gray-300 h-3" />
                  {dropoff && (
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0"><span className="text-sm">🏁</span></div>
                      <div className="min-w-0"><p className="text-xs text-gray-400 uppercase font-semibold">Dropoff</p><p className="text-sm font-medium text-gray-800 truncate">{dropoff.label}</p></div>
                    </div>
                  )}
                  {(est?.fare != null || est?.distanceM != null) && (
                    <div className="flex gap-2 pt-2 border-t border-gray-200">
                      {est?.fare != null && (
                        <div className="flex-1 text-center bg-white rounded-xl p-2.5 shadow-sm">
                          <p className="text-xs text-gray-400">Fare</p>
                          <p className="text-lg font-extrabold text-indigo-600">{Number(est.fare).toLocaleString()} <span className="text-xs">{est.currency || "VND"}</span></p>
                        </div>
                      )}
                      {est?.distanceM != null && (
                        <div className="flex-1 text-center bg-white rounded-xl p-2.5 shadow-sm">
                          <p className="text-xs text-gray-400">Distance</p>
                          <p className="text-lg font-extrabold text-green-600">{est.distanceM >= 1000 ? (est.distanceM / 1000).toFixed(1) : est.distanceM} <span className="text-xs">{est.distanceM >= 1000 ? "km" : "m"}</span></p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <button onClick={doRideCancel} disabled={rideCancelLoading}
                  className="w-full py-3.5 rounded-2xl bg-red-500 text-white font-bold text-sm hover:bg-red-600 disabled:bg-gray-300 transition shadow-md">
                  {rideCancelLoading ? "Cancelling..." : "Cancel Ride"}
                </button>
              </div>
            )}

            {/* ── Idle: Booking Form ── */}
            {!isSearching && !isRideActive && !rideCompleted && (
              <div className="animate-fade-in space-y-4">
                <h2 className="text-xl font-bold text-gray-900">Where to?</h2>

                {/* Vehicle */}
                <div className="flex gap-2">
                  {[{ v: "CAR_4", icon: "🚗", label: "Standard" }, { v: "CAR_7", icon: "🚐", label: "XL" }].map(({ v, icon, label }) => (
                    <button key={v} onClick={() => { setVehicleType(v); setEst(null); }}
                      className={`flex-1 py-3 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 transition border-2 ${vehicleType === v ? "border-indigo-500 bg-indigo-50 text-indigo-700 shadow-sm" : "border-gray-200 text-gray-500 hover:border-gray-300"}`}>
                      <span className="text-lg">{icon}</span>{label}
                    </button>
                  ))}
                </div>

                {/* Pickup */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-sm font-semibold text-gray-600 flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" /> Pickup
                    </label>
                    <button onClick={useMyLocation} disabled={geoLoading}
                      className={`px-3 py-1 text-xs rounded-full font-semibold transition ${geoLoading ? "bg-gray-200 text-gray-400" : "bg-green-100 text-green-700 hover:bg-green-200"}`}>
                      {geoLoading ? "Locating..." : "📍 My Location"}
                    </button>
                  </div>
                  <PlaceSearchInput label="" value={pickup} onChange={(v) => { setPickup(v); setEst(null); }} biasLatLng={null} />
                  {geoError && <p className="text-red-500 text-xs mt-1">{geoError}</p>}
                </div>

                {/* Dropoff */}
                <div>
                  <label className="text-sm font-semibold text-gray-600 flex items-center gap-1.5 mb-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" /> Drop-off
                  </label>
                  <PlaceSearchInput label="" value={dropoff} onChange={(v) => { setDropoff(v); setEst(null); }} biasLatLng={bias} />
                </div>

                {/* Payment */}
                <div className="flex gap-2">
                  <button onClick={() => setPaymentMethod("CASH")}
                    className={`flex-1 py-3 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 transition border-2 ${paymentMethod === "CASH" ? "border-green-500 bg-green-50 text-green-700" : "border-gray-200 text-gray-500"}`}>
                    💵 Cash
                  </button>
                  <button onClick={() => setPaymentMethod("VNPAY")}
                    className={`flex-1 py-3 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 transition border-2 ${paymentMethod === "VNPAY" ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-500"}`}>
                    📳 VNPay
                  </button>
                </div>

                {/* Estimate */}
                {est && (
                  <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-2xl p-4 border border-indigo-100">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-bold text-indigo-800">Price Estimate</span>
                      <span className="text-2xl font-extrabold text-indigo-600">{est.fare?.toLocaleString()} <span className="text-sm">{est.currency || "VND"}</span></span>
                    </div>
                    <div className="flex gap-3 text-xs text-gray-500">
                      <span>📏 {(est.distanceM / 1000).toFixed(1)} km</span>
                      <span>⏱ {Math.round(est.durationS / 60)} min</span>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <button disabled={loading === "estimate" || !pickup || !dropoff} onClick={doEstimate}
                    className="flex-1 py-3.5 rounded-2xl bg-gray-100 text-gray-700 font-bold text-sm disabled:opacity-40 hover:bg-gray-200 transition">
                    {loading === "estimate" ? "..." : "💎 Estimate"}
                  </button>
                  <button disabled={loading === "book" || !pickup || !dropoff} onClick={doBook}
                    className={`flex-[2] py-3.5 rounded-2xl text-white font-bold text-sm disabled:opacity-40 hover:opacity-90 transition shadow-lg ${paymentMethod === "VNPAY" ? "bg-blue-600" : "bg-indigo-600"}`}>
                    {loading === "book" ? "Booking..." : paymentMethod === "VNPAY" ? "📳 Book & Pay" : "🚀 Book Now"}
                  </button>
                </div>

              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══ Profile Modal ═══ */}
      {profileOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center" onClick={() => setProfileOpen(false)}>
          <div className="bg-white rounded-t-3xl sm:rounded-3xl p-6 w-full sm:w-[400px] sm:max-w-[90vw] shadow-2xl animate-slide-up" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-center sm:hidden mb-3"><div className="w-10 h-1 rounded-full bg-gray-300" /></div>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-14 h-14 rounded-full bg-indigo-100 flex items-center justify-center"><span className="text-2xl">👤</span></div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">{profileFullName || "User"}</h2>
                <p className="text-sm text-gray-500">{userId?.substring(0, 16)}...</p>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Full Name</label>
                <input type="text" value={profileFullName} onChange={(e) => setProfileFullName(e.target.value)}
                  className="w-full p-3 rounded-xl border-2 border-gray-200 text-sm focus:border-indigo-500 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Phone</label>
                <input type="tel" value={profilePhone} onChange={(e) => setProfilePhone(e.target.value)}
                  className="w-full p-3 rounded-xl border-2 border-gray-200 text-sm focus:border-indigo-500 outline-none" />
              </div>
            </div>
            {profileSaved && <p className="mt-2 text-green-600 font-semibold text-sm">✅ Saved!</p>}
            <div className="flex gap-3 mt-5">
              <button onClick={() => setProfileOpen(false)} className="flex-1 py-3 rounded-xl bg-gray-100 font-semibold text-sm hover:bg-gray-200 transition">Close</button>
              <button disabled={profileSaving}
                onClick={async () => {
                  setProfileSaving(true); setProfileSaved(false);
                  try { await updateProfile({ fullName: profileFullName, phone: profilePhone }); setProfileSaved(true); setTimeout(() => setProfileSaved(false), 3000); } catch {}
                  setProfileSaving(false);
                }}
                className="flex-[2] py-3 rounded-xl bg-indigo-600 text-white font-semibold text-sm disabled:opacity-50 hover:bg-indigo-700 transition">
                {profileSaving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
