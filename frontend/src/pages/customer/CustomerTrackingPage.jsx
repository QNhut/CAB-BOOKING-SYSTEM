import React, { useState, useEffect } from 'react';
import LeafletMap from '../../components/LeafletMap';

const CustomerTrackingPage = () => {
  const [booking, setBooking] = useState(null);
  const [ride, setRide] = useState(null);
  const [driver, setDriver] = useState(null);
  const [loading, setLoading] = useState(true);
  const driverFetchedRef = React.useRef(false);

  // Poll status from backend
  useEffect(() => {
    let intervalId;
    
    const fetchActiveBooking = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch('/bookings/me/active', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (res.ok) {
          const data = await res.json();
          if (data.booking) {
            setBooking(data.booking);
            // Save trip price for payment page
            if (data.booking.fare) sessionStorage.setItem('tripPrice', String(data.booking.fare));
            // Nếu booking có ride, fetch chi tiết ride (chứa vị trí tài xế & info)
            if (data.ride && data.ride.id) {
              const rideRes = await fetch(`/rides/${data.ride.id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
              });
              if (rideRes.ok) {
                const rideData = await rideRes.json();
                setRide(rideData);
                
                // Fetch driver info only once
                if (rideData.driver_id && !driverFetchedRef.current) {
                  driverFetchedRef.current = true;
                  sessionStorage.setItem('driverId', rideData.driver_id);
                  const driverRes = await fetch(`/drivers/${rideData.driver_id}/debug`, {
                     headers: { 'Authorization': `Bearer ${token}` }
                  });
                  if (driverRes.ok) {
                    const driverData = await driverRes.json();
                    setDriver(driverData);
                    const name = driverData.full_name || driverData.name || driverData.identifier || 'Tài xế X-Ride';
                    sessionStorage.setItem('driverName', name);
                  }
                }
              }
            }
          } else {
             // Không có active booking -> đã complete/cancel
             clearInterval(intervalId);
             // Navigate to payment if we had a booking in progress
             const hadBooking = sessionStorage.getItem('currentBookingId');
             if (hadBooking) {
               window.navigateTo('/customer/payment');
             } else {
               window.navigateTo('/customer/home');
             }
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchActiveBooking();
    intervalId = setInterval(fetchActiveBooking, 3000); // Poll every 3 seconds

    return () => clearInterval(intervalId);
  }, []);

  if (loading || !booking) {
    return (
      <div className="mx-auto w-full max-w-[400px] h-[100dvh] bg-slate-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  // Derive UI status from booking/ride status
  // booking status: MATCHED, DRIVER_ASSIGNED
  // ride status: ACCEPTED, ARRIVED, IN_PROGRESS, COMPLETED, CANCELLED
  const rideStatus = ride?.status || 'ACCEPTED';
  const isComing = rideStatus === 'ACCEPTED' || booking.status === 'MATCHED';
  const isArrived = rideStatus === 'ARRIVED';
  const isInProgress = rideStatus === 'IN_PROGRESS';

  const pickup = booking.pickup;
  const dropoff = booking.dropoff;
  
  // Vị trí tài xế: lấy từ ride.driver_location, nếu không có lấy giả lập gần pickup
  const driverPos = ride?.driver_location || {
    lat: pickup.lat + (isComing ? 0.005 : 0),
    lng: pickup.lng - (isComing ? 0.005 : 0),
  };

  const mapCenter = isInProgress
    ? [(pickup.lat + dropoff.lat) / 2, (pickup.lng + dropoff.lng) / 2]
    : [(pickup.lat + driverPos.lat) / 2, (pickup.lng + driverPos.lng) / 2];

  const routeLine = isInProgress
    ? [[pickup.lat, pickup.lng], [dropoff.lat, dropoff.lng]]
    : [[driverPos.lat, driverPos.lng], [pickup.lat, pickup.lng]];

  const markers = isInProgress
    ? [
        { lat: pickup.lat, lng: pickup.lng, color: '#3b82f6', label: 'Điểm đón' },
        { lat: dropoff.lat, lng: dropoff.lng, color: '#ef4444', label: 'Điểm đến' },
      ]
    : [
        { lat: driverPos.lat, lng: driverPos.lng, color: '#f59e0b', label: 'Tài xế' },
        { lat: pickup.lat, lng: pickup.lng, color: '#3b82f6', label: 'Điểm đón' },
      ];

  const handleCancel = async () => {
     if (!confirm("Bạn có chắc chắn muốn hủy chuyến?")) return;
     const token = localStorage.getItem('token');
     try {
       await fetch(`/bookings/${booking.id}/cancel`, {
         method: 'POST',
         headers: { 'Authorization': `Bearer ${token}` }
       });
       window.navigateTo('/customer/home');
     } catch(e) { console.error(e); }
  };

  return (
    <div className="mx-auto w-full max-w-[400px] h-[100dvh] bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white font-sans relative overflow-hidden flex flex-col shadow-2xl sm:border-x sm:border-slate-200 dark:border-slate-800">
      
      <LeafletMap
        center={mapCenter}
        zoom={14}
        markers={markers}
        routeLine={routeLine}
        className="absolute inset-0 w-full h-[60%]"
      />

      <div className="absolute top-12 w-full px-4 z-10 flex justify-between items-start">
        <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
            <span className="material-symbols-outlined text-blue-600">time_auto</span>
          </div>
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white text-lg leading-tight">
              {isComing ? 'Đang đến' : isArrived ? 'Đã đến' : 'Đang đi'}
            </h3>
            <p className="text-[11px] text-slate-500 font-medium">
              {isComing ? 'Tài xế đang đến đón' : isArrived ? 'Tài xế đã đến điểm đón' : 'Dự kiến tới đích'}
            </p>
          </div>
        </div>
        <button onClick={handleCancel} className="w-10 h-10 bg-white dark:bg-slate-900 rounded-full shadow-lg flex items-center justify-center text-rose-500 border border-slate-200 dark:border-slate-800">
          <span className="material-symbols-outlined text-[20px]">gpp_bad</span>
        </button>
      </div>

      <div className="absolute bottom-0 w-full z-20 bg-white dark:bg-slate-900 rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.15)] flex flex-col pt-3 pb-safe">
        <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full mx-auto mb-4"></div>
        
        <div className="px-5">
          <div className="flex justify-between items-center mb-5">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-14 h-14 rounded-full border-2 border-blue-500 bg-slate-200 flex items-center justify-center text-xl font-bold text-slate-600">
                  {driver ? (driver.name || driver.id).charAt(0).toUpperCase() : 'TX'}
                </div>
                <div className="absolute -bottom-1 -right-1 bg-amber-500 text-white text-[10px] font-bold px-1 rounded flex items-center border border-white dark:border-slate-900">
                  <span className="material-symbols-outlined text-[10px]" style={{fontVariationSettings: "'FILL' 1"}}>star</span>
                  {driver?.rating || '4.9'}
                </div>
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">{driver?.name || 'Nguyễn Văn Tài Xế'}</h2>
                <p className="text-sm text-slate-500">{booking.vehicleType === 'BIKE' ? 'Xe máy' : 'Ô tô'} • {driver?.vehicle?.model || 'Tiêu chuẩn'}</p>
              </div>
            </div>
            <div className="text-right">
              <div className="bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
                <h2 className="text-xl font-black tracking-widest text-slate-800 dark:text-slate-200">{driver?.vehicle?.licensePlate || '59A-1234'}</h2>
              </div>
            </div>
          </div>

          <div className="flex gap-3 mb-5">
            <button className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
              <span className="material-symbols-outlined text-[20px]">call</span>
              Gọi điện
            </button>
            <button className="flex-1 py-3 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors relative">
              <span className="material-symbols-outlined text-[20px]">chat</span>
              Nhắn tin
            </button>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 mb-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-slate-500">Thanh toán {booking.paymentMethod === 'CASH' ? 'tiền mặt' : 'thẻ'}</span>
              <span className="text-sm font-bold text-slate-900 dark:text-white">
                {(booking.fare || 0).toLocaleString('vi-VN')}đ
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerTrackingPage;
