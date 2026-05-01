import React from 'react';
import BottomNav from './BottomNav';

const DriverWalletPage = ({ toggleMenu, toggleTheme, isDarkMode }) => {
  return (
    <div className="mx-auto w-full max-w-[400px] h-[100dvh] bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white font-sans relative overflow-hidden flex flex-col shadow-2xl sm:border-x sm:border-slate-200 dark:border-slate-800">
      <header className="absolute top-0 w-full z-50 flex justify-between items-center px-4 h-16 bg-teal-500 text-white shadow-sm">
        <div className="flex items-center gap-3">
          <h1 className="font-bold text-lg tracking-tight">Ví X-Ride</h1>
        </div>
        <button onClick={toggleTheme} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors">
          <span className="material-symbols-outlined">{isDarkMode ? 'light_mode' : 'dark_mode'}</span>
        </button>
      </header>

      <main className="flex-grow overflow-y-auto no-scrollbar pt-16 pb-[88px] bg-slate-50 dark:bg-slate-950">
        <div className="bg-teal-500 pt-4 pb-12 px-6 rounded-b-3xl shadow-md text-white text-center">
          <p className="text-sm text-teal-100 font-medium uppercase tracking-widest mb-2">Số dư khả dụng</p>
          <h2 className="text-4xl font-black tracking-tight">1.250.000đ</h2>
          
          <div className="flex gap-4 mt-8">
            <button className="flex-1 bg-white text-teal-600 py-3 rounded-xl font-bold text-sm shadow-lg hover:bg-slate-50 active:scale-95 transition-all flex items-center justify-center gap-2">
              <span className="material-symbols-outlined text-[18px]">account_balance</span>
              Rút tiền
            </button>
            <button className="flex-1 bg-teal-600 text-white border border-teal-400 py-3 rounded-xl font-bold text-sm shadow-lg hover:bg-teal-700 active:scale-95 transition-all flex items-center justify-center gap-2">
              <span className="material-symbols-outlined text-[18px]">add_circle</span>
              Nạp tiền
            </button>
          </div>
        </div>

        <div className="px-4 -mt-6">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-lg border border-slate-100 dark:border-slate-800">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-slate-800 dark:text-white">Giao dịch gần đây</h3>
              <span className="text-teal-500 text-xs font-bold cursor-pointer hover:underline">Xem tất cả</span>
            </div>
            
            <div className="space-y-4">
              {[
                { name: 'Rút tiền về ngân hàng', time: 'Hôm nay, 14:20', amount: '-500.000đ', isPositive: false, icon: 'account_balance' },
                { name: 'Thu nhập chuyến đi', time: 'Hôm qua, 18:45', amount: '+45.000đ', isPositive: true, icon: 'local_taxi' },
                { name: 'Thu nhập chuyến đi', time: 'Hôm qua, 17:10', amount: '+62.000đ', isPositive: true, icon: 'local_taxi' },
                { name: 'Thưởng hoàn thành mốc', time: '12 Thg 5, 09:00', amount: '+100.000đ', isPositive: true, icon: 'stars' },
              ].map((tx, idx) => (
                <div key={idx} className="flex justify-between items-center pb-4 border-b border-slate-100 dark:border-slate-800 last:border-0 last:pb-0">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${tx.isPositive ? 'bg-teal-50 dark:bg-teal-900/40 text-teal-600' : 'bg-rose-50 dark:bg-rose-900/40 text-rose-600'}`}>
                      <span className="material-symbols-outlined text-[20px]">{tx.icon}</span>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{tx.name}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{tx.time}</p>
                    </div>
                  </div>
                  <span className={`text-sm font-bold ${tx.isPositive ? 'text-teal-600' : 'text-slate-800 dark:text-white'}`}>
                    {tx.amount}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      <BottomNav />
    </div>
  );
};
export default DriverWalletPage;
