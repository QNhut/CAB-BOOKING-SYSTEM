import React, { useEffect } from 'react';

const CustomerOnboardingPage = () => {
  useEffect(() => {
    const nextPath = localStorage.getItem('token')
      ? '/customer/home'
      : '/customer/login';

    const timer = setTimeout(() => {
      window.navigateTo(nextPath);
    }, 2500);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="mx-auto w-full max-w-[400px] h-[100dvh] bg-blue-600 text-white font-sans relative overflow-hidden flex flex-col items-center justify-center shadow-2xl sm:border-x sm:border-blue-700">
      <div className="absolute inset-0 z-0 opacity-20">
        <div className="absolute top-[-10%] left-[-20%] w-[140%] h-[60%] bg-blue-400 rounded-[100%] animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-20%] w-[140%] h-[60%] bg-indigo-500 rounded-[100%] animate-pulse" style={{animationDelay: '1s'}}></div>
      </div>
      
      <div className="z-10 flex flex-col items-center animate-[slideIn_0.8s_ease-out]">
        <div className="w-24 h-24 bg-white text-blue-600 rounded-3xl flex items-center justify-center shadow-[0_0_40px_rgba(255,255,255,0.3)] mb-6 transform rotate-12">
          <span className="material-symbols-outlined text-[60px]" style={{fontVariationSettings: "'FILL' 1"}}>local_taxi</span>
        </div>
        <h1 className="text-4xl font-black tracking-tight mb-2">X-Ride</h1>
        <p className="text-blue-100 font-medium text-lg">Đi muôn nơi, không lo nghĩ</p>
      </div>

      <div className="absolute bottom-12 flex justify-center w-full z-10">
        <div className="flex gap-2">
          <div className="w-2 h-2 rounded-full bg-white animate-bounce"></div>
          <div className="w-2 h-2 rounded-full bg-white animate-bounce" style={{animationDelay: '0.2s'}}></div>
          <div className="w-2 h-2 rounded-full bg-white animate-bounce" style={{animationDelay: '0.4s'}}></div>
        </div>
      </div>
    </div>
  );
};

export default CustomerOnboardingPage;
