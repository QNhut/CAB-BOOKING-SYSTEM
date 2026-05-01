import React from 'react';

const CustomerBottomNav = () => {
  const path = window.location.pathname;

  const isActive = (routePattern) => {
    return path.includes(routePattern);
  };

  return (
    <nav className="absolute bottom-0 left-0 w-full z-50 flex justify-around items-center px-2 py-2 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 pb-safe h-[68px]">
      <div 
        onClick={() => window.navigateTo('/customer/home')} 
        className={`flex flex-col items-center justify-center w-20 cursor-pointer relative transition-colors ${isActive('/customer/home') ? 'text-blue-600' : 'text-slate-400 hover:text-blue-600 dark:text-slate-300 dark:hover:text-blue-400'}`}
      >
        {isActive('/customer/home') && (
          <div className="absolute -top-[9px] w-8 h-1 bg-blue-600 rounded-full shadow-[0_2px_8px_rgba(37,99,235,0.5)]"></div>
        )}
        <span className="material-symbols-outlined text-[24px]" style={{fontVariationSettings: isActive('/customer/home') ? "'FILL' 1" : "'FILL' 0"}}>home</span>
        <span className={`text-[10px] mt-1 uppercase tracking-tight ${isActive('/customer/home') ? 'font-bold' : 'font-medium'}`}>Trang chủ</span>
      </div>
      
      <div 
        onClick={() => window.navigateTo('/customer/history')} 
        className={`flex flex-col items-center justify-center w-20 cursor-pointer relative transition-colors ${isActive('/customer/history') ? 'text-blue-600' : 'text-slate-400 hover:text-blue-600 dark:text-slate-300 dark:hover:text-blue-400'}`}
      >
        {isActive('/customer/history') && (
          <div className="absolute -top-[9px] w-8 h-1 bg-blue-600 rounded-full shadow-[0_2px_8px_rgba(37,99,235,0.5)]"></div>
        )}
        <span className="material-symbols-outlined text-[24px]" style={{fontVariationSettings: isActive('/customer/history') ? "'FILL' 1" : "'FILL' 0"}}>history</span>
        <span className={`text-[10px] mt-1 uppercase tracking-tight ${isActive('/customer/history') ? 'font-bold' : 'font-medium'}`}>Lịch sử</span>
      </div>

      <div 
        onClick={() => window.navigateTo('/customer/profile')} 
        className={`flex flex-col items-center justify-center w-20 cursor-pointer relative transition-colors ${isActive('/customer/profile') ? 'text-blue-600' : 'text-slate-400 hover:text-blue-600 dark:text-slate-300 dark:hover:text-blue-400'}`}
      >
        {isActive('/customer/profile') && (
          <div className="absolute -top-[9px] w-8 h-1 bg-blue-600 rounded-full shadow-[0_2px_8px_rgba(37,99,235,0.5)]"></div>
        )}
        <span className="material-symbols-outlined text-[24px]" style={{fontVariationSettings: isActive('/customer/profile') ? "'FILL' 1" : "'FILL' 0"}}>person</span>
        <span className={`text-[10px] mt-1 uppercase tracking-tight ${isActive('/customer/profile') ? 'font-bold' : 'font-medium'}`}>Tài khoản</span>
      </div>
    </nav>
  );
};

export default CustomerBottomNav;
