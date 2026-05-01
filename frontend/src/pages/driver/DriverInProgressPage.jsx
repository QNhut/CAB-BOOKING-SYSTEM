import React, { useState, useEffect } from 'react';
import LeafletMap from '../../components/LeafletMap';

const DriverInProgressPage = () => {
  const [ride, setRide] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    try {
      const r = JSON.parse(sessionStorage.getItem('currentRide'));
      if (r) {
        setRide(r);
      } else {
        window.navigateTo('/driver/online');
      }
    } catch {
      window.navigateTo('/driver/online');
    }
  }, []);

  const handleComplete = async () => {
    if (!ride) return;
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/rides/${ride.id}/complete`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        // Save fare so DriverCompletedPage can read it
        if (ride.fare) sessionStorage.setItem('completedFare', String(ride.fare));
        sessionStorage.removeItem('currentRide');
        window.navigateTo('/driver/completed');
      } else {
        const err = await res.json();
        alert(`Lỗi: ${err.error}`);
        setLoading(false);
      }
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  if (!ride) return null;

  const pickup = ride.pickup || { lat: 10.795, lng: 106.722, address: 'Điểm đón' };
  const dropoff = ride.dropoff || { lat: 10.7726, lng: 106.698, address: 'Điểm đến' };
  const mapCenter = [(pickup.lat + dropoff.lat) / 2, (pickup.lng + dropoff.lng) / 2];

  return (
    <div className="mx-auto w-full max-w-[400px] h-[100dvh] bg-slate-900 text-white font-sans relative overflow-hidden flex flex-col shadow-2xl sm:border-x sm:border-slate-800">
      
      <LeafletMap
        center={mapCenter}
        zoom={14}
        markers={[
          { lat: pickup.lat, lng: pickup.lng, color: '#14b8a6', label: 'Bắt đầu' },
          { lat: dropoff.lat, lng: dropoff.lng, color: '#ef4444', label: 'Điểm đến' },
        ]}
        routeLine={[[pickup.lat, pickup.lng], [dropoff.lat, dropoff.lng]]}
        className="absolute inset-0 w-full h-[60%] opacity-90"
      />

      <div className="absolute top-12 w-full px-4 z-10 flex justify-between items-start">
        <div className="bg-teal-500 text-white p-3 rounded-2xl shadow-lg flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
            <span className="material-symbols-outlined">map</span>
          </div>
          <div>
            <h3 className="font-bold text-lg leading-tight">12 phút</h3>
            <p className="text-[11px] font-medium opacity-80">4.5 km tới điểm đến</p>
          </div>
        </div>
        
        <div className="flex flex-col gap-2">
          <button className="w-10 h-10 bg-slate-800/90 backdrop-blur-md rounded-full shadow-lg flex items-center justify-center text-white border border-slate-700">
            <span className="material-symbols-outlined text-[20px]">near_me</span>
          </button>
        </div>
      </div>

      <div className="absolute bottom-0 w-full z-20 bg-slate-900 rounded-t-3xl shadow-[0_-20px_40px_rgba(0,0,0,0.4)] flex flex-col pt-3 pb-safe border-t border-slate-800">
        <div className="w-12 h-1.5 bg-slate-700 rounded-full mx-auto mb-4"></div>
        
        <div className="px-5">
          <div className="bg-slate-800 rounded-2xl p-4 mb-4 border border-slate-700 relative overflow-hidden">
            <div className="absolute right-0 top-0 bottom-0 w-2 bg-rose-500"></div>
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-rose-500 mt-0.5 text-[20px]">location_on</span>
              <div className="pr-4">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Trả khách tại</p>
                <p className="font-bold text-white leading-tight">{dropoff.address}</p>
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center mb-5 bg-slate-900 py-2 border-b border-slate-800 border-t">
             <div>
                <p className="text-xs text-slate-400">Thu tiền mặt</p>
                <p className="text-2xl font-black text-emerald-400">{(ride.fare || 0).toLocaleString('vi-VN')}đ</p>
             </div>
             <div className="text-right">
                <p className="text-xs text-slate-400">Khách hàng</p>
                <p className="font-bold">Khách hàng</p>
             </div>
          </div>

          <button 
            onClick={handleComplete}
            disabled={loading}
            className="w-full py-4 bg-emerald-500 text-white font-bold rounded-2xl shadow-[0_4px_20px_rgba(16,185,129,0.4)] text-lg active:scale-95 transition-transform mb-4 disabled:opacity-50 flex justify-center items-center gap-2"
          >
             {loading ? 'ĐANG XỬ LÝ...' : 'HOÀN THÀNH CHUYẾN'}
             {!loading && <span className="material-symbols-outlined">check_circle</span>}
          </button>
        </div>
      </div>
    </div>
  );
};
export default DriverInProgressPage;
