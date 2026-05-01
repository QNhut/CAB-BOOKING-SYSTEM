import React, { useState, useEffect } from 'react';

const CustomerPaymentPage = () => {
  const [rating, setRating] = useState(0);
  const [tripData, setTripData] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Đọc thông tin chuyến từ sessionStorage
    try {
      const bookingId = sessionStorage.getItem('currentBookingId');
      const pickup = JSON.parse(sessionStorage.getItem('pickup') || 'null');
      const dropoff = JSON.parse(sessionStorage.getItem('dropoff') || 'null');
      const price = sessionStorage.getItem('tripPrice');
      const driverName = sessionStorage.getItem('driverName');
      const driverId = sessionStorage.getItem('driverId');
      const paymentMethod = sessionStorage.getItem('currentPaymentMethod') || 'CASH';
      setTripData({ bookingId, pickup, dropoff, price: price ? parseInt(price) : 45000, driverName: driverName || 'Tài xế X-Ride', driverId, paymentMethod });
    } catch { /* ignore */ }
  }, []);

  const handleFinish = async () => {
    setSubmitting(true);
    // Submit review if user rated
    if (rating > 0 && tripData?.bookingId && tripData?.driverId) {
      try {
        const token = localStorage.getItem('token');
        await fetch('/reviews', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ booking_id: tripData.bookingId, driver_id: tripData.driverId, rating })
        });
      } catch (err) {
        console.error('Submit review error:', err);
      }
    }
    // Clear session
    sessionStorage.removeItem('currentBookingId');
    sessionStorage.removeItem('pickup');
    sessionStorage.removeItem('dropoff');
    sessionStorage.removeItem('tripPrice');
    sessionStorage.removeItem('driverName');
    sessionStorage.removeItem('driverId');
    sessionStorage.removeItem('currentPaymentMethod');
    sessionStorage.removeItem('currentPaymentStatus');
    window.navigateTo('/customer/home');
  };

  return (
    <div className="mx-auto w-full max-w-[400px] h-[100dvh] bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-sans relative overflow-hidden flex flex-col shadow-2xl sm:border-x sm:border-slate-200 dark:border-slate-800">
      
      <div className="flex-grow overflow-y-auto pt-12 px-6 pb-[100px]">
        <div className="text-center mb-8 animate-[slideDown_0.5s_ease-out]">
          <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-white dark:border-slate-950 shadow-lg">
            <span className="material-symbols-outlined text-[40px]">check_circle</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white mb-1">Đã đến nơi!</h1>
          <p className="text-sm text-slate-500">Chuyến đi của bạn đã hoàn thành</p>
        </div>

        <div className="bg-slate-50 dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 relative mb-8">
          <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 flex gap-1">
            <div className="w-16 h-8 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 rounded-t-full"></div>
          </div>
          
          <div className="flex justify-between items-end mb-6">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Tổng cộng</p>
              <h2 className="text-3xl font-black text-slate-900 dark:text-white">{(tripData?.price || 45000).toLocaleString('vi-VN')}đ</h2>
            </div>
            <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
              <span className={`material-symbols-outlined text-[18px] ${tripData?.paymentMethod === 'VNPAY' ? 'text-blue-600' : 'text-green-600'}`}>
                {tripData?.paymentMethod === 'VNPAY' ? 'account_balance' : 'payments'}
              </span>
              <span className="text-xs font-bold">{tripData?.paymentMethod === 'VNPAY' ? 'VNPay' : 'Tiền mặt'}</span>
            </div>
          </div>

          {tripData?.paymentMethod === 'VNPAY' && (
            <div className="mb-5 rounded-2xl bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/40 px-4 py-3 text-sm text-blue-700 dark:text-blue-300">
              Chuyến đi này đã được thanh toán online qua VNPay trước khi ghép tài xế.
            </div>
          )}

          <div className="border-t border-dashed border-slate-300 dark:border-slate-700 py-4 space-y-3">
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-emerald-500 text-[18px] mt-0.5">trip_origin</span>
              <div>
                <p className="text-xs text-slate-500">Điểm đón</p>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{tripData?.pickup?.address || tripData?.pickup?.name || 'Landmark 81, Bình Thạnh'}</p>
              </div>
            </div>
            <div className="w-0.5 h-4 bg-slate-200 dark:bg-slate-700 ml-2.5"></div>
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-amber-500 text-[18px] mt-0.5">location_on</span>
              <div>
                <p className="text-xs text-slate-500">Điểm đến</p>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{tripData?.dropoff?.address || tripData?.dropoff?.name || 'Chợ Bến Thành, Quận 1'}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="text-center">
          <h3 className="font-bold text-lg mb-2">Đánh giá {tripData?.driverName || 'Tài xế X-Ride'}</h3>
          <p className="text-xs text-slate-500 mb-4">Phản hồi của bạn giúp X-Ride tốt hơn</p>
          
          <div className="flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <span 
                key={star}
                onClick={() => setRating(star)}
                className={`material-symbols-outlined text-[40px] cursor-pointer transition-all hover:scale-110 ${rating >= star ? 'text-amber-400' : 'text-slate-200 dark:text-slate-800'}`}
                style={{fontVariationSettings: rating >= star ? "'FILL' 1" : "'FILL' 0"}}
              >
                star
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 w-full p-4 bg-white dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 pb-safe">
        <button 
          onClick={handleFinish}
          disabled={submitting}
          className="w-full py-4 bg-blue-600 text-white font-bold rounded-xl text-lg shadow-lg hover:bg-blue-700 active:scale-95 transition-transform disabled:opacity-50"
        >
          {submitting ? 'ĐANG XỬ LÝ...' : 'HOÀN THÀNH'}
        </button>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes slideDown { from { transform: translateY(-50px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      `}} />
    </div>
  );
};

export default CustomerPaymentPage;
