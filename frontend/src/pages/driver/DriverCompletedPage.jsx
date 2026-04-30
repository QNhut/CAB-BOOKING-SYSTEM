import React from 'react';

const DriverCompletedPage = () => {
  const fare = parseFloat(sessionStorage.getItem('completedFare') || '0');
  const commission = Math.round(fare * 0.2);
  const earnings = fare - commission;

  return (
    <div className="mx-auto w-full max-w-[400px] h-[100dvh] bg-teal-500 text-white font-sans relative overflow-hidden flex flex-col shadow-2xl sm:border-x sm:border-teal-600">
      <div className="flex-grow flex flex-col items-center justify-center px-6 text-center z-10 relative">
         <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center text-teal-500 shadow-[0_0_40px_rgba(255,255,255,0.4)] mb-8 animate-[bounce_1s_ease-in-out_infinite]">
            <span className="material-symbols-outlined text-5xl" style={{fontVariationSettings: "'FILL' 1"}}>check_circle</span>
         </div>
         <h1 className="text-3xl font-black mb-2">Chuyến đi hoàn tất!</h1>
         <p className="text-teal-100 mb-10 text-lg">Bạn đã đưa khách đến nơi an toàn</p>

         <div className="bg-white w-full rounded-3xl p-6 text-slate-900 shadow-2xl">
            <p className="text-sm text-slate-500 font-bold uppercase tracking-wider mb-2">Thu nhập từ chuyến đi</p>
            <h2 className="text-4xl font-black text-teal-600 mb-6">{earnings.toLocaleString('vi-VN')}đ</h2>

            <div className="space-y-4 border-t border-slate-100 pt-4 text-left">
               <div className="flex justify-between text-sm">
                  <span className="text-slate-500 dark:text-slate-400">Cước phí</span>
                  <span className="font-semibold text-slate-800">{fare.toLocaleString('vi-VN')}đ</span>
               </div>
               <div className="flex justify-between text-sm">
                  <span className="text-slate-500 dark:text-slate-400">Chiết khấu (20%)</span>
                  <span className="font-semibold text-red-500">-{commission.toLocaleString('vi-VN')}đ</span>
               </div>
            </div>

            <button 
              onClick={() => { sessionStorage.removeItem('completedFare'); window.navigateTo('/driver/online'); }}
              className="w-full py-4 mt-8 bg-slate-900 text-white font-bold rounded-xl text-lg hover:bg-slate-800 active:scale-95 transition-all shadow-md"
            >
               TIẾP TỤC NHẬN ĐƠN
            </button>
         </div>
      </div>
      
      {/* Decorative background circle */}
      <div className="absolute top-[-10%] left-[-20%] w-[140%] h-[60%] bg-teal-400 rounded-[100%] z-0 opacity-50"></div>
    </div>
  );
};
export default DriverCompletedPage;
