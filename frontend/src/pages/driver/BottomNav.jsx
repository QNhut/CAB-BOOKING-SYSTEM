import React from 'react';

const BottomNav = ({ onLogout }) => {
  const path = window.location.pathname;

  const isActive = (routePattern) => {
    return path.includes(routePattern);
  };

  return (
    <nav className="absolute bottom-0 left-0 w-full z-50 flex justify-around items-center px-2 py-2 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 pb-safe h-[68px]">
      <div 
        onClick={() => window.navigateTo('/driver/login')} 
        className={`flex flex-col items-center justify-center w-16 cursor-pointer relative transition-colors ${isActive('/driver/login') || isActive('/driver/online') ? 'text-teal-600' : 'text-slate-400 hover:text-teal-600 dark:text-slate-300 dark:hover:text-teal-400'}`}
      >
        {(isActive('/driver/login') || isActive('/driver/online')) && (
          <div className="absolute -top-[9px] w-8 h-1 bg-teal-600 rounded-full shadow-[0_2px_8px_rgba(13,148,136,0.5)]"></div>
        )}
        <span className="material-symbols-outlined text-[24px]" style={{fontVariationSettings: isActive('/driver/login') || isActive('/driver/online') ? "'FILL' 1" : "'FILL' 0"}}>home</span>
        <span className={`text-[10px] mt-1 uppercase tracking-tight ${isActive('/driver/login') || isActive('/driver/online') ? 'font-bold' : 'font-medium'}`}>Trang chủ</span>
      </div>
      
      <div 
        onClick={() => window.navigateTo('/driver/history')} 
        className={`flex flex-col items-center justify-center w-16 cursor-pointer relative transition-colors ${isActive('/driver/history') ? 'text-teal-600' : 'text-slate-400 hover:text-teal-600 dark:text-slate-300 dark:hover:text-teal-400'}`}
      >
        {isActive('/driver/history') && (
          <div className="absolute -top-[9px] w-8 h-1 bg-teal-600 rounded-full shadow-[0_2px_8px_rgba(13,148,136,0.5)]"></div>
        )}
        <span className="material-symbols-outlined text-[24px]" style={{fontVariationSettings: isActive('/driver/history') ? "'FILL' 1" : "'FILL' 0"}}>history</span>
        <span className={`text-[10px] mt-1 uppercase tracking-tight ${isActive('/driver/history') ? 'font-bold' : 'font-medium'}`}>Hoạt động</span>
      </div>

      <div 
        onClick={() => window.navigateTo('/driver/wallet')} 
        className={`flex flex-col items-center justify-center w-16 cursor-pointer relative transition-colors ${isActive('/driver/wallet') ? 'text-teal-600' : 'text-slate-400 hover:text-teal-600 dark:text-slate-300 dark:hover:text-teal-400'}`}
      >
        {isActive('/driver/wallet') && (
          <div className="absolute -top-[9px] w-8 h-1 bg-teal-600 rounded-full shadow-[0_2px_8px_rgba(13,148,136,0.5)]"></div>
        )}
        <span className="material-symbols-outlined text-[24px]" style={{fontVariationSettings: isActive('/driver/wallet') ? "'FILL' 1" : "'FILL' 0"}}>account_balance_wallet</span>
        <span className={`text-[10px] mt-1 uppercase tracking-tight ${isActive('/driver/wallet') ? 'font-bold' : 'font-medium'}`}>Ví tiền</span>
      </div>

      <div 
        onClick={() => window.navigateTo('/driver/profile')} 
        className={`flex flex-col items-center justify-center w-16 cursor-pointer relative transition-colors ${isActive('/driver/profile') ? 'text-teal-600' : 'text-slate-400 hover:text-teal-600 dark:text-slate-300 dark:hover:text-teal-400'}`}
      >
        {isActive('/driver/profile') && (
          <div className="absolute -top-[9px] w-8 h-1 bg-teal-600 rounded-full shadow-[0_2px_8px_rgba(13,148,136,0.5)]"></div>
        )}
        <span className="material-symbols-outlined text-[24px]" style={{fontVariationSettings: isActive('/driver/profile') ? "'FILL' 1" : "'FILL' 0"}}>person</span>
        <span className={`text-[10px] mt-1 uppercase tracking-tight ${isActive('/driver/profile') ? 'font-bold' : 'font-medium'}`}>Tài khoản</span>
      </div>
    </nav>
  );
};

export default BottomNav;
