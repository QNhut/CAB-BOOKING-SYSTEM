import React from 'react';
import BottomNav from './BottomNav';

const DriverLoginKycPage = ({ toggleMenu, toggleTheme, isDarkMode }) => {
  return (
    <div className="mx-auto w-full max-w-[400px] h-[100dvh] bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white font-sans relative overflow-hidden flex flex-col shadow-2xl sm:border-x sm:border-slate-200 dark:border-slate-800">
      <div className="flex-grow overflow-y-auto no-scrollbar pb-24">
        <div className="p-4 z-10 relative">
          <header className="mb-6 pt-4 flex justify-between items-start">
            <div className="flex items-start gap-3">
              <div>
                <h1 className="text-[28px] font-bold text-teal-600 mb-1 tracking-tight leading-none">Hoàn tất hồ sơ</h1>
                <p className="text-slate-500 dark:text-slate-400 text-sm">Cần thực hiện các bước sau</p>
              </div>
            </div>
            <button onClick={toggleTheme} className="w-10 h-10 flex items-center justify-center bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors">
              <span className="material-symbols-outlined">{isDarkMode ? 'light_mode' : 'dark_mode'}</span>
            </button>
          </header>
          <div className="space-y-3">
            <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center text-emerald-600">
                  <span className="material-symbols-outlined" style={{fontVariationSettings: "'FILL' 1"}}>badge</span>
                </div>
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white text-[15px]">Chứng minh nhân dân</p>
                  <span className="text-emerald-600 font-bold text-[10px] uppercase tracking-wider">Đã tải lên</span>
                </div>
              </div>
              <span className="material-symbols-outlined text-emerald-600">check_circle</span>
            </div>
            <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center text-amber-600">
                  <span className="material-symbols-outlined" style={{fontVariationSettings: "'FILL' 1"}}>license</span>
                </div>
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white text-[15px]">Bằng lái xe</p>
                  <span className="text-amber-600 font-bold text-[10px] uppercase tracking-wider">Đang chờ duyệt</span>
                </div>
              </div>
              <span className="material-symbols-outlined text-amber-600">pending</span>
            </div>
            <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-between shadow-sm hover:border-teal-500 cursor-pointer transition-colors">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400">
                  <span className="material-symbols-outlined">directions_car</span>
                </div>
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white text-[15px]">Đăng ký xe</p>
                  <span className="text-slate-500 dark:text-slate-400 font-bold text-[10px] uppercase tracking-wider">Chưa hoàn thành</span>
                </div>
              </div>
              <span className="material-symbols-outlined text-slate-400">add_a_photo</span>
            </div>
          </div>
          <div className="mt-6 p-4 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-800">
            <p className="font-bold text-slate-500 dark:text-slate-400 mb-1 text-[11px] uppercase tracking-wider">Ghi chú</p>
            <p className="text-[13px] text-slate-600 dark:text-slate-300 leading-relaxed">
              Hồ sơ sẽ được duyệt trong vòng 24-48 giờ. Vui lòng đảm bảo hình ảnh rõ nét và không bị lóa sáng.
            </p>
          </div>
        </div>
      </div>
      <div className="absolute bottom-[68px] left-0 w-full z-20 pointer-events-none flex flex-col justify-end">
        <div className="absolute inset-0 z-0">
          <img src="https://images.unsplash.com/photo-1524661135-423995f22d0b?q=80&w=600&auto=format&fit=crop" alt="Map" className="w-full h-full object-cover opacity-60 grayscale" />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-800/70 to-transparent"></div>
        </div>
        <div className="absolute right-4 bottom-20 flex flex-col gap-3 pointer-events-auto">
          <button className="w-10 h-10 bg-white dark:bg-slate-900 rounded-full flex items-center justify-center text-slate-700 dark:text-slate-200 shadow-lg">
            <span className="material-symbols-outlined text-[20px]">layers</span>
          </button>
          <button className="w-10 h-10 bg-white dark:bg-slate-900 rounded-full flex items-center justify-center text-slate-700 dark:text-slate-200 shadow-lg">
            <span className="material-symbols-outlined text-[20px]">my_location</span>
          </button>
        </div>
        <div className="relative z-10 px-4 pb-4 pointer-events-auto w-full">
          <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-2xl p-4 text-center shadow-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
            <div className="text-left">
              <h2 className="text-[15px] font-bold text-slate-900 dark:text-white">Bạn đang Ngoại tuyến</h2>
              <p className="text-slate-500 dark:text-slate-400 text-[12px]">Bật để nhận đơn</p>
            </div>
            <button 
              onClick={() => window.navigateTo('/driver/online')}
              className="px-5 py-2.5 bg-teal-500 text-white font-bold rounded-xl shadow-md hover:bg-teal-600 active:scale-95 transition-all flex items-center gap-1.5 shrink-0 text-[13px]"
            >
              <span className="material-symbols-outlined text-[18px]" style={{fontVariationSettings: "'FILL' 1"}}>bolt</span>
              BẬT
            </button>
          </div>
        </div>
      </div>
      <BottomNav />
    </div>
  );
};
export default DriverLoginKycPage;
