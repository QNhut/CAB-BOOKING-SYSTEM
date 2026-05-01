import React, { useEffect, useState } from 'react';

// ─── Cancel Confirm Sheet ─────────────────────────────────────────────────────
const CancelSheet = ({ onConfirm, onClose, loading }) => (
  <div className="absolute inset-0 z-50 flex items-end">
    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
    <div className="relative w-full bg-white dark:bg-slate-900 rounded-t-3xl shadow-2xl px-6 pt-4 pb-8">
      <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full mx-auto mb-5" />
      <div className="flex flex-col items-center text-center mb-6">
        <div className="w-16 h-16 bg-rose-100 dark:bg-rose-900/30 rounded-full flex items-center justify-center mb-3">
          <span className="material-symbols-outlined text-rose-500 text-[32px]">cancel</span>
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1">Hủy chuyến đi?</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Tài xế đang trên đường đến. Bạn có chắc chắn muốn hủy không?
        </p>
      </div>
      <div className="flex gap-3">
        <button
          onClick={onClose}
          disabled={loading}
          className="flex-1 py-3.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-2xl text-sm hover:bg-slate-200 transition-colors disabled:opacity-50"
        >
          Không, tiếp tục
        </button>
        <button
          onClick={onConfirm}
          disabled={loading}
          className="flex-1 py-3.5 bg-rose-500 text-white font-bold rounded-2xl text-sm hover:bg-rose-600 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <span className="material-symbols-outlined text-[18px] animate-spin">refresh</span>
              Đang hủy...
            </>
          ) : (
            'Xác nhận hủy'
          )}
        </button>
      </div>
    </div>
  </div>
);

// ─── Main Page ────────────────────────────────────────────────────────────────
const CustomerSearchingPage = () => {
  const [showCancelSheet, setShowCancelSheet] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [driverCount, setDriverCount] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Elapsed timer
  useEffect(() => {
    const t = setInterval(() => setElapsedSeconds(s => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // Animated driver count
  useEffect(() => {
    const counts = [2, 3, 1, 4, 2, 3];
    let i = 0;
    const t = setInterval(() => {
      setDriverCount(counts[i % counts.length]);
      i++;
    }, 2500);
    return () => clearInterval(t);
  }, []);

  // Poll booking status
  useEffect(() => {
    const bookingId = sessionStorage.getItem('currentBookingId');
    if (!bookingId) {
      const timer = setTimeout(() => window.navigateTo('/customer/tracking'), 4000);
      return () => clearTimeout(timer);
    }

    let intervalId;
    const checkBookingStatus = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`/bookings/${bookingId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const b = await res.json();
          if (b.status === 'MATCHED' || b.status === 'DRIVER_ASSIGNED') {
            clearInterval(intervalId);
            window.navigateTo('/customer/tracking');
          } else if (b.status === 'CANCELLED' || b.status === 'NO_DRIVER_FOUND') {
            clearInterval(intervalId);
            sessionStorage.removeItem('currentBookingId');
            alert('Không tìm được tài xế phù hợp. Vui lòng thử lại.');
            window.navigateTo('/customer/home');
          }
        }
      } catch (err) {
        console.error('Poll booking status error', err);
      }
    };

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
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/bookings/${bookingId}/cancel`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        sessionStorage.removeItem('currentBookingId');
        sessionStorage.removeItem('currentPaymentMethod');
        window.navigateTo('/customer/home');
      } else {
        const data = await res.json().catch(() => ({}));
        alert(`Không thể hủy: ${data.error || 'Vui lòng thử lại.'}`);
        setCancelLoading(false);
        setShowCancelSheet(false);
      }
    } catch (err) {
      console.error(err);
      sessionStorage.removeItem('currentBookingId');
      window.navigateTo('/customer/home');
    }
  };

  const fmtElapsed = (s) => {
    if (s < 60) return `${s}s`;
    return `${Math.floor(s / 60)}m ${s % 60}s`;
  };

  return (
    <div className="mx-auto w-full max-w-[400px] h-[100dvh] bg-slate-900 text-white font-sans relative overflow-hidden flex flex-col shadow-2xl sm:border-x sm:border-slate-800">
      {/* Background animated map */}
      <div className="absolute inset-0 z-0">
        <img
          src="https://images.unsplash.com/photo-1524661135-423995f22d0b?q=80&w=600&auto=format&fit=crop"
          alt="Map"
          className="w-full h-full object-cover opacity-25 grayscale"
        />
        {/* Radar pulse rings */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[60%]">
          <div className="absolute w-72 h-72 -translate-x-1/2 -translate-y-1/2 bg-blue-500 rounded-full opacity-10 animate-ping" style={{ animationDuration: '2.5s' }} />
          <div className="absolute w-48 h-48 -translate-x-1/2 -translate-y-1/2 bg-blue-500 rounded-full opacity-15 animate-ping" style={{ animationDuration: '2.5s', animationDelay: '0.5s' }} />
          <div className="absolute w-24 h-24 -translate-x-1/2 -translate-y-1/2 bg-blue-500 rounded-full opacity-20 animate-ping" style={{ animationDuration: '2.5s', animationDelay: '1s' }} />
          <div className="relative w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(37,99,235,0.9)] -translate-x-1/2 -translate-y-1/2">
            <span className="material-symbols-outlined text-[30px] animate-pulse">person_pin_circle</span>
          </div>
        </div>
        {/* Fake nearby taxis */}
        <span className="material-symbols-outlined absolute top-[40%] left-[25%] text-slate-400 text-[22px] animate-pulse" style={{ animationDelay: '0.3s' }}>local_taxi</span>
        <span className="material-symbols-outlined absolute top-[55%] right-[18%] text-slate-400 text-[22px] animate-pulse" style={{ animationDelay: '1s' }}>local_taxi</span>
        <span className="material-symbols-outlined absolute top-[30%] right-[28%] text-slate-400 text-[22px] animate-pulse" style={{ animationDelay: '0.7s' }}>local_taxi</span>
      </div>

      {/* Top info bar */}
      <div className="absolute top-12 left-0 w-full px-4 z-10 flex justify-between items-center">
        <div className="bg-slate-800/80 backdrop-blur-md rounded-2xl px-4 py-2 flex items-center gap-2 border border-slate-700">
          <span className="material-symbols-outlined text-blue-400 text-[18px]">timer</span>
          <span className="text-sm font-bold text-white">{fmtElapsed(elapsedSeconds)}</span>
        </div>
        <div className="bg-slate-800/80 backdrop-blur-md rounded-2xl px-4 py-2 flex items-center gap-2 border border-slate-700">
          <span className="material-symbols-outlined text-amber-400 text-[18px]">local_taxi</span>
          <span className="text-sm font-bold text-white">{driverCount} tài xế gần bạn</span>
        </div>
      </div>

      {/* Bottom card */}
      <div className="absolute bottom-0 w-full z-20 bg-slate-800/95 backdrop-blur-md rounded-t-3xl border-t border-slate-700 px-6 pt-4 pb-8">
        <div className="w-12 h-1.5 bg-slate-600 rounded-full mx-auto mb-4" />

        <div className="text-center mb-5">
          <h2 className="text-2xl font-bold mb-1">Đang tìm tài xế...</h2>
          <p className="text-slate-400 text-sm">Hệ thống đang ghép tài xế phù hợp cho bạn</p>
        </div>

        {/* Animated progress bar */}
        <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden mb-6">
          <div className="h-full bg-blue-500 rounded-full animate-[searchBar_1.8s_ease-in-out_infinite]" />
        </div>

        {/* Steps */}
        <div className="space-y-3 mb-6">
          {[
            { icon: 'check_circle', text: 'Đơn đặt xe đã gửi thành công', done: true },
            { icon: 'radio_button_checked', text: 'Đang liên hệ tài xế gần nhất', done: false, active: true },
            { icon: 'radio_button_unchecked', text: 'Xác nhận và ghép tài xế', done: false },
          ].map((step, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className={`material-symbols-outlined text-[20px] ${step.done ? 'text-emerald-400' : step.active ? 'text-blue-400 animate-pulse' : 'text-slate-600'}`}>
                {step.icon}
              </span>
              <span className={`text-sm font-medium ${step.done ? 'text-emerald-400' : step.active ? 'text-white' : 'text-slate-500'}`}>
                {step.text}
              </span>
            </div>
          ))}
        </div>

        {/* Cancel button */}
        <button
          onClick={() => setShowCancelSheet(true)}
          className="w-full py-3.5 bg-slate-700 hover:bg-rose-600/80 text-white font-bold rounded-2xl text-sm transition-all active:scale-95 flex items-center justify-center gap-2 border border-slate-600 hover:border-rose-500"
        >
          <span className="material-symbols-outlined text-[18px]">cancel</span>
          Hủy chuyến
        </button>
      </div>

      {/* Cancel confirm sheet */}
      {showCancelSheet && (
        <CancelSheet
          onConfirm={handleCancel}
          onClose={() => !cancelLoading && setShowCancelSheet(false)}
          loading={cancelLoading}
        />
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes searchBar {
          0%   { width: 0%;   margin-left: 0; }
          50%  { width: 60%;  margin-left: 20%; }
          100% { width: 0%;   margin-left: 100%; }
        }
      ` }} />
    </div>
  );
};

export default CustomerSearchingPage;
