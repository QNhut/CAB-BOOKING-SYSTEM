import React, { useEffect, useState } from 'react';

const CustomerSearchingPage = () => {
  const [cancelLoading, setCancelLoading] = useState(false);

  useEffect(() => {
    const bookingId = sessionStorage.getItem('currentBookingId');
    if (!bookingId) {
      console.warn("No booking ID found, simulating redirect");
      const timer = setTimeout(() => window.navigateTo('/customer/tracking'), 4000);
      return () => clearTimeout(timer);
    }

    let intervalId;
    
    // Poll trạng thái booking từ backend
    const checkBookingStatus = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`/bookings/${bookingId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const b = await res.json();
          // Nếu có tài xế nhận
          if (b.status === 'MATCHED' || b.status === 'DRIVER_ASSIGNED' || b.status === 'COMPLETED') {
            clearInterval(intervalId);
            window.navigateTo('/customer/tracking');
          } else if (b.status === 'CANCELLED') {
            clearInterval(intervalId);
            alert("Chuyến xe đã bị hủy do không tìm thấy tài xế.");
            window.navigateTo('/customer/home');
          }
        }
      } catch (err) {
        console.error("Poll booking status error", err);
      }
    };

    // Kiểm tra ngay lúc đầu, sau đó mỗi 2 giây
    checkBookingStatus();
    intervalId = setInterval(checkBookingStatus, 2000);

    return () => clearInterval(intervalId);
  }, []);

  const handleCancel = async () => {
    const bookingId = sessionStorage.getItem('currentBookingId');
    if (!bookingId) {
      window.navigateTo('/customer/home');
      return;
    }
    
    setCancelLoading(true);
    const token = localStorage.getItem('token');
    try {
      await fetch(`/bookings/${bookingId}/cancel`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      sessionStorage.removeItem('currentBookingId');
      window.navigateTo('/customer/home');
    } catch (err) {
      console.error(err);
      window.navigateTo('/customer/home');
    }
  };

  return (
    <div className="mx-auto w-full max-w-[400px] h-[100dvh] bg-slate-900 text-white font-sans relative overflow-hidden flex flex-col shadow-2xl sm:border-x sm:border-slate-800">
      <div className="absolute inset-0 z-0">
        <img src="https://images.unsplash.com/photo-1524661135-423995f22d0b?q=80&w=600&auto=format&fit=crop" alt="Map Route" className="w-full h-full object-cover opacity-30 grayscale" />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 flex items-center justify-center">
          <div className="absolute inset-0 bg-blue-500 rounded-full opacity-20 animate-ping" style={{animationDuration: '2s'}}></div>
          <div className="absolute inset-8 bg-blue-500 rounded-full opacity-20 animate-ping" style={{animationDuration: '2s', animationDelay: '0.6s'}}></div>
          <div className="relative w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(37,99,235,0.8)] z-10">
            <span className="material-symbols-outlined text-[32px] animate-pulse">person_pin_circle</span>
          </div>
        </div>
        <span className="material-symbols-outlined absolute top-[40%] left-[30%] text-slate-400 text-[20px]">local_taxi</span>
        <span className="material-symbols-outlined absolute top-[60%] right-[20%] text-slate-400 text-[20px]">local_taxi</span>
        <span className="material-symbols-outlined absolute top-[30%] right-[30%] text-slate-400 text-[20px]">local_taxi</span>
      </div>

      <div className="absolute top-12 left-4 z-10">
        <button onClick={handleCancel} disabled={cancelLoading} className="w-10 h-10 bg-slate-800/80 backdrop-blur-md rounded-full flex items-center justify-center text-white border border-slate-700 hover:bg-slate-700 transition-colors disabled:opacity-50">
          <span className="material-symbols-outlined">{cancelLoading ? 'hourglass_empty' : 'close'}</span>
        </button>
      </div>

      <div className="absolute bottom-10 left-0 w-full px-6 z-20 text-center animate-[slideUp_0.5s_ease-out]">
        <h2 className="text-2xl font-bold mb-2">Đang tìm tài xế...</h2>
        <p className="text-slate-400 text-sm mb-6">Đã liên hệ 3 tài xế gần bạn nhất</p>
        
        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div className="h-full bg-blue-500 w-1/3 animate-[slideRight_1.5s_infinite_ease-in-out] rounded-full"></div>
        </div>
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes slideRight { 0% { transform: translateX(-100%); } 100% { transform: translateX(300%); } }
        @keyframes slideUp { from { transform: translateY(50px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      `}} />
    </div>
  );
};

export default CustomerSearchingPage;
