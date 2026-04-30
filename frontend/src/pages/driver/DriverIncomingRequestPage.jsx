import React, { useEffect, useState } from 'react';
import LeafletMap from '../../components/LeafletMap';

const DRIVER_POS = [10.7880, 106.7150];

const DriverIncomingRequestPage = () => {
  const [timeLeft, setTimeLeft] = useState(15);
  const [ride, setRide] = useState(null);

  useEffect(() => {
    try {
      const r = JSON.parse(sessionStorage.getItem('currentRide'));
      if (r) {
        setRide(r);
        // Calculate remaining time
        if (r.offer_expires_at) {
           const expiresAt = new Date(r.offer_expires_at).getTime();
           const remaining = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
           setTimeLeft(remaining);
        }
      } else {
        window.navigateTo('/driver/online');
      }
    } catch {
      window.navigateTo('/driver/online');
    }
  }, []);

  useEffect(() => {
    if (timeLeft <= 0) {
      handleReject(); // auto reject when timeout
      return;
    }
    const timer = setInterval(() => setTimeLeft(t => t - 1), 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  const handleAccept = async () => {
    if (!ride) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/rides/${ride.id}/driver/accept`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        // Cập nhật status
        const updatedRide = { ...ride, status: 'DRIVER_ASSIGNED' };
        sessionStorage.setItem('currentRide', JSON.stringify(updatedRide));
        window.navigateTo('/driver/pickup');
      } else {
        const err = await res.json();
        alert(`Không thể nhận chuyến: ${err.error}`);
        window.navigateTo('/driver/online');
      }
    } catch (e) {
      console.error(e);
      window.navigateTo('/driver/online');
    }
  };

  const handleReject = async () => {
    if (!ride) return;
    try {
      const token = localStorage.getItem('token');
      await fetch(`/rides/${ride.id}/driver/reject`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
    } catch (e) {
      console.error(e);
    }
    sessionStorage.removeItem('currentRide');
    window.navigateTo('/driver/online');
  };

  if (!ride) return null;

  const pickup = ride.pickup || { lat: 10.795, lng: 106.722, address: 'Điểm đón' };
  const dropoff = ride.dropoff || { lat: 10.7726, lng: 106.698, address: 'Điểm đến' };

  // Center on pickup point
  const mapCenter = [pickup.lat, pickup.lng];
  const routeLine = [DRIVER_POS, [pickup.lat, pickup.lng], [dropoff.lat, dropoff.lng]];

  return (
    <div className="mx-auto w-full max-w-[400px] h-[100dvh] bg-slate-900 text-white font-sans relative overflow-hidden flex flex-col shadow-2xl sm:border-x sm:border-slate-800">
      
      <LeafletMap
        center={mapCenter}
        zoom={14}
        markers={[
          { lat: DRIVER_POS[0], lng: DRIVER_POS[1], color: '#14b8a6', label: 'Bạn' },
          { lat: pickup.lat, lng: pickup.lng, color: '#3b82f6', label: 'Đón' },
          { lat: dropoff.lat, lng: dropoff.lng, color: '#ef4444', label: 'Đến' }
        ]}
        routeLine={routeLine}
        className="absolute inset-0 w-full h-[55%] opacity-80"
      />
      <div className="absolute inset-0 z-[1] bg-gradient-to-b from-slate-900/50 via-transparent to-slate-900 pointer-events-none h-[60%]"></div>

      <div className="absolute top-12 w-full px-4 z-10 flex justify-center">
        <div className="bg-teal-500 text-white px-6 py-2 rounded-full font-bold shadow-[0_0_20px_rgba(20,184,166,0.5)] animate-pulse flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">notifications_active</span>
          CUỐC MỚI • TỰ ĐỘNG TỪ CHỐI SAU {timeLeft}s
        </div>
      </div>

      <div className="absolute bottom-0 w-full z-20 bg-slate-900 rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.5)] flex flex-col pb-safe border-t border-slate-800">
        <div className="p-5">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-2xl font-black text-white">{ride.vehicle_type === 'BIKE' ? 'X-Ride Bike' : 'X-Ride Car'}</h2>
              <div className="flex items-center gap-2 text-slate-400 text-sm mt-1">
                <span className="bg-slate-800 px-2 py-0.5 rounded text-xs font-bold text-slate-300">{(ride.distance_m/1000).toFixed(1)} km</span>
                <span>•</span>
                <span>{Math.round(ride.duration_s/60)} phút</span>
              </div>
            </div>
            <div className="text-right">
              <h2 className="text-3xl font-black text-teal-400">{(ride.fare || 0).toLocaleString('vi-VN')}đ</h2>
              <p className="text-xs text-slate-400 mt-1">Tiền mặt</p>
            </div>
          </div>

          <div className="space-y-4 mb-6 relative pl-2">
            <div className="absolute left-3.5 top-2 bottom-2 w-0.5 bg-slate-800"></div>
            
            <div className="flex items-start gap-4 relative z-10">
              <div className="w-4 h-4 rounded-full bg-blue-500 border-4 border-slate-900 mt-0.5 shadow-sm"></div>
              <div className="flex-1">
                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-0.5">Điểm đón</p>
                <p className="text-sm font-bold text-white line-clamp-2">{pickup.address}</p>
                <p className="text-xs text-blue-400 mt-1">Cách bạn ~{Math.round((ride.distance_m/1000)*0.3)} km</p>
              </div>
            </div>

            <div className="flex items-start gap-4 relative z-10">
              <div className="w-4 h-4 rounded-full bg-rose-500 border-4 border-slate-900 mt-0.5 shadow-sm"></div>
              <div className="flex-1">
                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-0.5">Điểm đến</p>
                <p className="text-sm font-bold text-white line-clamp-2">{dropoff.address}</p>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button 
              onClick={handleReject}
              className="flex-1 py-4 bg-slate-800 text-slate-300 font-bold rounded-2xl flex items-center justify-center gap-2 hover:bg-slate-700 transition-colors"
            >
              <span className="material-symbols-outlined">close</span>
              Từ chối
            </button>
            <button 
              onClick={handleAccept}
              className="flex-[2] py-4 bg-teal-500 text-white font-bold rounded-2xl shadow-[0_4px_20px_rgba(20,184,166,0.4)] flex items-center justify-center gap-2 text-lg active:scale-95 transition-transform"
            >
              NHẬN CUỐC
              <div className="w-6 h-6 rounded-full border-2 border-white/30 border-t-white animate-spin ml-2" style={{display: 'none'}}></div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
export default DriverIncomingRequestPage;
