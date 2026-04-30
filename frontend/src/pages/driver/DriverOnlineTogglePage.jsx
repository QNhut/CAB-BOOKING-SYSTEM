import React, { useEffect, useState, useRef } from 'react';
import BottomNav from './BottomNav';
import LeafletMap from '../../components/LeafletMap';

const DEFAULT_POS = [10.7880, 106.7150];

const DriverOnlineTogglePage = ({ toggleMenu, toggleTheme, isDarkMode }) => {
  const [loading, setLoading] = useState(true);
  const [driverPos, setDriverPos] = useState(DEFAULT_POS);
  const posRef = useRef(DEFAULT_POS);

  // Update posRef whenever driverPos changes so sendLocation uses current coords
  useEffect(() => { posRef.current = driverPos; }, [driverPos]);

  // Get real geolocation once on mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords = [pos.coords.latitude, pos.coords.longitude];
          setDriverPos(coords);
          posRef.current = coords;
        },
        () => { /* fall back to DEFAULT_POS */ }
      );
    }
  }, []);

  useEffect(() => {
    let pollId;
    let locationIntervalId;

    const token = localStorage.getItem('token');
    if (!token) return;

    // Send driver location periodically using latest coords
    const sendLocation = async () => {
      try {
        const [lat, lng] = posRef.current;
        await fetch('/drivers/me/location', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ lat, lng })
        });
      } catch (err) {
        console.error("Failed to send location", err);
      }
    };

    // Check if there is an incoming ride or active ride
    const checkRide = async () => {
      try {
        const res = await fetch('/drivers/me/rides/current', {
           headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.type === 'offered') {
            sessionStorage.setItem('currentRide', JSON.stringify(data.ride));
            clearInterval(pollId);
            window.navigateTo('/driver/incoming');
          } else if (data.type === 'active') {
            sessionStorage.setItem('currentRide', JSON.stringify(data.ride));
            clearInterval(pollId);
            if (data.ride.status === 'DRIVER_ASSIGNED') {
              window.navigateTo('/driver/pickup');
            } else {
              window.navigateTo('/driver/inprogress');
            }
          }
        }
      } catch (err) {
        console.error("Failed to check ride", err);
      } finally {
        setLoading(false);
      }
    };

    // Make driver ONLINE first
    fetch('/drivers/me/status', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
       body: JSON.stringify({ status: 'ONLINE', vehicleType: 'CAR_4' })
    }).catch(e => console.error(e));

    sendLocation();
    checkRide();
    
    pollId = setInterval(checkRide, 3000);
    locationIntervalId = setInterval(sendLocation, 10000);

    return () => {
      clearInterval(pollId);
      clearInterval(locationIntervalId);
    };
  }, []);

  const handleOffline = async () => {
    const token = localStorage.getItem('token');
    try {
      await fetch('/drivers/me/status', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
         body: JSON.stringify({ status: 'OFFLINE' })
      });
      window.navigateTo('/driver/login');
    } catch (e) { console.error(e); }
  };

  return (
    <div className="mx-auto w-full max-w-[400px] h-[100dvh] bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white font-sans relative overflow-hidden flex flex-col shadow-2xl sm:border-x sm:border-slate-200 dark:border-slate-800">
      
      {/* Bản đồ Leaflet thực */}
      <LeafletMap
        center={driverPos}
        zoom={15}
        markers={[{ lat: driverPos[0], lng: driverPos[1], color: '#14b8a6', label: 'Vị trí của bạn' }]}
        className="absolute inset-0 w-full h-full"
      />

      <div className="absolute inset-0 z-[1] bg-teal-900/10 pointer-events-none"></div>

      <div className="absolute top-0 w-full p-4 z-10 flex justify-between items-start">
        <div className="flex items-center gap-3">
          <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-full px-4 py-2 shadow-md flex items-center gap-2 border border-slate-200 dark:border-slate-800">
            <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse"></div>
            <span className="text-sm font-bold text-slate-800 dark:text-white">Trực tuyến</span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button onClick={toggleTheme} className="w-10 h-10 flex items-center justify-center bg-white/90 dark:bg-slate-900/90 text-slate-700 dark:text-slate-300 rounded-full shadow-md border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <span className="material-symbols-outlined">{isDarkMode ? 'light_mode' : 'dark_mode'}</span>
          </button>
        </div>
      </div>

      <div className="absolute top-20 w-full px-4 z-10">
        <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-3xl p-5 shadow-xl border border-slate-200 dark:border-slate-800">
          <div className="flex flex-col items-center justify-center py-4 mb-4">
            <h2 className="text-[20px] font-bold text-slate-900 dark:text-white mb-2">Đang tìm chuyến...</h2>
            <p className="text-slate-500 dark:text-slate-400 text-center text-sm mb-6">Hệ thống đang quét các yêu cầu đặt xe xung quanh bạn</p>
            
            <div className="relative w-24 h-24 flex items-center justify-center mb-4">
              <div className="absolute inset-0 bg-teal-500 rounded-full opacity-20 animate-ping" style={{animationDuration: '3s'}}></div>
              <div className="absolute inset-2 bg-teal-500 rounded-full opacity-20 animate-ping" style={{animationDuration: '3s', animationDelay: '1s'}}></div>
              <div className="absolute inset-4 bg-teal-500 rounded-full opacity-20 animate-ping" style={{animationDuration: '3s', animationDelay: '2s'}}></div>
              <div className="relative w-14 h-14 bg-teal-500 rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(20,184,166,0.6)] z-10">
                <span className="material-symbols-outlined text-white text-[24px]">radar</span>
              </div>
            </div>
          </div>
          
          <div className="bg-slate-50 dark:bg-slate-950 rounded-2xl p-4 border border-slate-100 dark:border-slate-800">
             <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider mb-1">Thu nhập hôm nay</p>
             <h2 className="text-2xl font-black text-teal-600">0đ</h2>
          </div>
        </div>
      </div>

      {/* Go Offline Button */}
      <div className="absolute bottom-[84px] w-full px-4 z-10 flex justify-center">
        <button 
          onClick={handleOffline}
          className="w-14 h-14 bg-red-500 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-red-600 transition-colors"
        >
          <span className="material-symbols-outlined">power_settings_new</span>
        </button>
      </div>

      <BottomNav />
    </div>
  );
};
export default DriverOnlineTogglePage;
