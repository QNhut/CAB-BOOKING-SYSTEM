import React, { useState, useEffect } from 'react';
import LeafletMap from '../../components/LeafletMap';

const DRIVER_POS = [10.7880, 106.7150];

const DriverPickupPage = () => {
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

  const handlePickup = async () => {
    if (!ride) return;
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/rides/${ride.id}/driver/pickup`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const updatedRide = { ...ride, status: 'PICKED_UP' };
        sessionStorage.setItem('currentRide', JSON.stringify(updatedRide));
        window.navigateTo('/driver/inprogress');
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
  const mapCenter = [(DRIVER_POS[0] + pickup.lat) / 2, (DRIVER_POS[1] + pickup.lng) / 2];

  return (
    <div className="mx-auto w-full max-w-[400px] h-[100dvh] bg-slate-900 text-white font-sans relative overflow-hidden flex flex-col shadow-2xl sm:border-x sm:border-slate-800">
      
      <LeafletMap
        center={mapCenter}
        zoom={15}
        markers={[
          { lat: DRIVER_POS[0], lng: DRIVER_POS[1], color: '#f59e0b', label: 'Bạn' },
          { lat: pickup.lat, lng: pickup.lng, color: '#3b82f6', label: 'Điểm đón' },
        ]}
        routeLine={[DRIVER_POS, [pickup.lat, pickup.lng]]}
        className="absolute inset-0 w-full h-[65%] opacity-90"
      />

      <div className="absolute top-12 w-full px-4 z-10 flex justify-between items-start">
        <div className="bg-slate-900/90 backdrop-blur-md p-3 rounded-2xl shadow-lg border border-slate-700 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
            <span className="material-symbols-outlined text-blue-400">navigation</span>
          </div>
          <div>
            <h3 className="font-bold text-white text-lg leading-tight">3 phút</h3>
            <p className="text-[11px] text-slate-400 font-medium">1.2 km tới điểm đón</p>
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
          <div className="flex justify-between items-center mb-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-slate-800 border-2 border-blue-500 flex items-center justify-center text-xl font-bold text-slate-400">
                KH
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Khách hàng</h2>
                <div className="flex items-center gap-1 text-xs text-slate-400 bg-slate-800 w-fit px-1.5 py-0.5 rounded mt-1">
                  <span className="material-symbols-outlined text-[12px] text-amber-400" style={{fontVariationSettings: "'FILL' 1"}}>star</span>
                  5.0
                </div>
              </div>
            </div>
            <div className="flex gap-2">
               <button className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-blue-400 border border-slate-700 hover:bg-slate-700 transition-colors">
                 <span className="material-symbols-outlined">chat</span>
               </button>
               <button className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 border border-blue-500/30 hover:bg-blue-500/30 transition-colors">
                 <span className="material-symbols-outlined">call</span>
               </button>
            </div>
          </div>

          <div className="bg-slate-800 rounded-2xl p-4 mb-5 border border-slate-700">
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-blue-400 mt-0.5 text-[20px]">trip_origin</span>
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Điểm đón khách</p>
                <p className="font-bold text-white leading-tight">{pickup.address}</p>
              </div>
            </div>
          </div>

          <button 
            onClick={handlePickup}
            disabled={loading}
            className="w-full py-4 bg-teal-500 text-white font-bold rounded-2xl shadow-[0_4px_20px_rgba(20,184,166,0.4)] text-lg active:scale-95 transition-transform mb-4 disabled:opacity-50"
          >
            {loading ? 'ĐANG XỬ LÝ...' : 'ĐÃ ĐÓN KHÁCH'}
          </button>
        </div>
      </div>
    </div>
  );
};
export default DriverPickupPage;
