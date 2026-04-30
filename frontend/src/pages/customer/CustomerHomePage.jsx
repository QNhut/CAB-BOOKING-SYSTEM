import React, { useState } from 'react';
import CustomerBottomNav from './CustomerBottomNav';
import LeafletMap from '../../components/LeafletMap';
import { getStoredPickup, setStoredPickup } from '../../lib/customerStorage';

const CustomerHomePage = ({ toggleMenu }) => {
  const [pickup, setPickup] = useState(() => getStoredPickup());
  const [locating, setLocating] = useState(false);
  const [flyTo, setFlyTo] = useState(null);
  const [locError, setLocError] = useState('');

  const handleLocate = () => {
    if (!navigator.geolocation) {
      setLocError('Trình duyệt không hỗ trợ định vị.');
      return;
    }
    setLocating(true);
    setLocError('');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        let nextPickup = {
          lat: latitude,
          lng: longitude,
          name: 'Vị trí của bạn',
          address: 'Vị trí của bạn'
        };

        try {
          const response = await fetch(`/geo/reverse?lat=${latitude}&lng=${longitude}`);

          if (response.ok) {
            const data = await response.json();
            const label = data.formattedAddress || data.name || nextPickup.address;
            nextPickup = {
              ...nextPickup,
              name: label,
              address: label,
            };
          }
        } catch (error) {
          console.warn('Reverse geocode error:', error);
        }

        const storedPickup = setStoredPickup(nextPickup);
        setPickup(storedPickup);
        setFlyTo([storedPickup.lat, storedPickup.lng]);
        setLocating(false);
      },
      (err) => {
        console.warn('Geolocation error:', err.message);
        setLocError('Không lấy được vị trí. Vui lòng cấp quyền định vị.');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  return (
    <div className="mx-auto w-full max-w-[400px] h-[100dvh] bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white font-sans relative overflow-hidden flex flex-col shadow-2xl sm:border-x sm:border-slate-200 dark:border-slate-800">
      
      {/* Bản đồ Leaflet thực */}
      <LeafletMap
        center={[pickup.lat, pickup.lng]}
        zoom={14}
        markers={[
          {
            lat: pickup.lat,
            lng: pickup.lng,
            color: '#3b82f6',
            label: pickup.address || pickup.name,
          }
        ]}
        className="absolute inset-0 w-full h-full"
        flyTo={flyTo}
      />

      {/* Header */}
      <div className="absolute top-4 w-full px-4 z-30 flex justify-end items-center">
        <button className="w-12 h-12 bg-white dark:bg-slate-900 rounded-full shadow-lg flex items-center justify-center text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:scale-105 transition-transform relative">
          <span className="material-symbols-outlined">notifications</span>
          <span className="absolute top-3 right-3 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-slate-900"></span>
        </button>
      </div>

      {/* My Location Button */}
      <div className="absolute bottom-[280px] right-4 z-30 flex flex-col items-end gap-2">
        {locError && (
          <div className="bg-red-50 border border-red-200 text-red-600 text-[11px] font-medium px-3 py-2 rounded-xl shadow max-w-[200px] text-right">{locError}</div>
        )}
        <button
          onClick={handleLocate}
          disabled={locating}
          className="w-12 h-12 bg-white dark:bg-slate-900 text-blue-600 rounded-full shadow-lg flex items-center justify-center border border-slate-200 dark:border-slate-800 hover:scale-105 transition-transform disabled:opacity-60"
          title="Lấy vị trí hiện tại"
        >
          <span className={`material-symbols-outlined ${locating ? 'animate-spin' : ''}`}>
            {locating ? 'autorenew' : 'my_location'}
          </span>
        </button>
      </div>

      {/* Bottom Action Sheet */}
      <div className="absolute bottom-[68px] w-full z-20 bg-white dark:bg-slate-900 rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.15)] flex flex-col">
        <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full mx-auto my-3"></div>
        <div className="px-5 pb-6 pt-2">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">Bạn muốn đi đâu?</h2>
          
          <div 
            onClick={() => window.navigateTo('/customer/destination')}
            className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded-xl flex items-center gap-3 cursor-text hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors mb-4"
          >
            <span className="material-symbols-outlined text-blue-500">search</span>
            <span className="text-slate-500 dark:text-slate-400 font-medium text-lg">Tìm điểm đến...</span>
          </div>

          <div className="flex gap-4">
            <div 
              onClick={() => window.navigateTo('/customer/destination')}
              className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-3 rounded-xl flex items-center gap-3 cursor-pointer hover:border-blue-400 transition-colors shadow-sm"
            >
              <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/30 text-blue-600 rounded-full flex items-center justify-center">
                <span className="material-symbols-outlined text-[20px]">home</span>
              </div>
              <div>
                <p className="font-bold text-slate-800 dark:text-slate-200 text-sm">Nhà</p>
                <p className="text-xs text-slate-500 w-20 truncate">123 Lê Lợi</p>
              </div>
            </div>
            <div 
              onClick={() => window.navigateTo('/customer/destination')}
              className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-3 rounded-xl flex items-center gap-3 cursor-pointer hover:border-blue-400 transition-colors shadow-sm"
            >
              <div className="w-10 h-10 bg-amber-50 dark:bg-amber-900/30 text-amber-600 rounded-full flex items-center justify-center">
                <span className="material-symbols-outlined text-[20px]">work</span>
              </div>
              <div>
                <p className="font-bold text-slate-800 dark:text-slate-200 text-sm">Công ty</p>
                <p className="text-xs text-slate-500 w-20 truncate">Tòa nhà Bitexco</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <CustomerBottomNav />
    </div>
  );
};

export default CustomerHomePage;
