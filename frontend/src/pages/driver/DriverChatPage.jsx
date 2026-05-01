import React from 'react';

const DriverChatPage = () => {
  return (
    <div className="mx-auto w-full max-w-[400px] h-[100dvh] bg-slate-50 text-slate-900 font-sans relative overflow-hidden flex flex-col shadow-2xl sm:border-x sm:border-slate-200">
      <nav className="absolute top-0 left-0 w-full z-50 flex justify-between items-center px-4 h-16 bg-white border-b border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => window.navigateTo('/driver/pickup')}
            className="text-teal-600 p-1 hover:opacity-80 transition-opacity"
          >
            <span className="material-symbols-outlined text-[24px]">arrow_back</span>
          </button>
          <div className="flex items-center gap-3">
            <div className="relative">
              <img src="https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=100&q=80" alt="Avatar" className="w-10 h-10 rounded-full border border-slate-200 object-cover" />
              <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white"></div>
            </div>
            <div>
              <h1 className="font-bold text-[15px] text-slate-900 leading-tight">Trần Thị B</h1>
              <div className="flex items-center text-[11px] font-medium text-slate-500 mt-0.5">
                <span className="material-symbols-outlined text-amber-500 text-[12px] mr-1" style={{fontVariationSettings: "'FILL' 1"}}>star</span>
                5.0 • Khách hàng
              </div>
            </div>
          </div>
        </div>
        <button className="w-10 h-10 flex items-center justify-center rounded-full bg-teal-50 text-teal-600 hover:bg-teal-100 transition-colors">
          <span className="material-symbols-outlined text-[20px]">call</span>
        </button>
      </nav>

      <main className="flex-grow pt-16 pb-[120px] px-4 flex flex-col gap-4 overflow-y-auto no-scrollbar">
        <div className="flex justify-center my-3">
          <span className="px-3 py-1 rounded-full bg-slate-200 text-slate-600 text-[10px] font-bold tracking-widest uppercase border border-slate-300 shadow-sm">Hôm nay</span>
        </div>
        
        <div className="flex flex-col gap-1 max-w-[85%] self-start">
          <div className="bg-white text-slate-800 p-3.5 rounded-tr-[16px] rounded-br-[16px] rounded-bl-[16px] border border-slate-200 shadow-sm">
            <p className="text-[14px] leading-relaxed">Tôi đang đến điểm đón, khoảng 2 phút nữa ạ.</p>
          </div>
          <div className="flex items-center gap-1.5 px-1">
            <span className="text-[10px] text-slate-400">14:20</span>
            <span className="material-symbols-outlined text-[14px] text-emerald-500" style={{fontVariationSettings: "'FILL' 1"}}>done_all</span>
          </div>
        </div>

        <div className="flex flex-col gap-1 max-w-[85%] self-end">
          <div className="bg-teal-500 text-white p-3.5 rounded-tl-[16px] rounded-bl-[16px] rounded-br-[16px] shadow-sm">
            <p className="text-[14px] font-medium leading-relaxed">Vâng, tôi đang đứng trước cổng tòa nhà.</p>
          </div>
          <div className="flex items-center gap-1.5 px-1 justify-end">
            <span className="text-[10px] text-slate-400">14:21</span>
            <span className="material-symbols-outlined text-[14px] text-teal-600" style={{fontVariationSettings: "'FILL' 1"}}>done_all</span>
          </div>
        </div>
        <div className="flex flex-col gap-1 max-w-[85%] self-start">
          <div className="bg-white text-slate-800 p-3.5 rounded-tr-[16px] rounded-br-[16px] rounded-bl-[16px] border border-slate-200 shadow-sm">
            <p className="text-[14px] leading-relaxed">Dạ vâng, tôi thấy bạn rồi.</p>
          </div>
          <div className="flex items-center gap-1.5 px-1">
            <span className="text-[10px] text-slate-400">14:22</span>
            <span className="material-symbols-outlined text-[14px] text-emerald-500" style={{fontVariationSettings: "'FILL' 1"}}>done_all</span>
          </div>
        </div>
        
        {/* Map Snippet */}
        <div className="w-full h-[120px] rounded-xl overflow-hidden relative border border-slate-200 shadow-sm mt-1">
          <img src="https://images.unsplash.com/photo-1524661135-423995f22d0b?q=80&w=600&auto=format&fit=crop" alt="Location Map" className="w-full h-full object-cover grayscale opacity-80" />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent"></div>
          <div className="absolute bottom-3 left-3 flex items-center gap-2 bg-white/90 backdrop-blur px-3 py-1.5 rounded-full shadow-sm">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
            <span className="text-[10px] font-bold text-slate-800 uppercase tracking-tight">Tài xế đang đến gần</span>
          </div>
        </div>
      </main>

      <div className="absolute bottom-0 left-0 w-full z-50 bg-white border-t border-slate-200">
        <div className="flex gap-2 overflow-x-auto px-4 py-2.5 no-scrollbar border-b border-slate-100">
          <button className="flex-shrink-0 bg-slate-100 text-slate-700 text-[13px] px-4 py-2 rounded-full border border-slate-200 hover:bg-slate-200 transition-colors">Tôi đang đến</button>
          <button className="flex-shrink-0 bg-slate-100 text-slate-700 text-[13px] px-4 py-2 rounded-full border border-slate-200 hover:bg-slate-200 transition-colors">Đợi tôi một chút</button>
          <button className="flex-shrink-0 bg-slate-100 text-slate-700 text-[13px] px-4 py-2 rounded-full border border-slate-200 hover:bg-slate-200 transition-colors">Bạn đang ở đâu?</button>
        </div>
        <div className="flex items-center gap-3 px-4 py-3 bg-white">
          <button className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:text-slate-800 hover:bg-slate-200 transition-colors">
            <span className="material-symbols-outlined text-[24px]">add</span>
          </button>
          <div className="flex-grow">
            <input type="text" placeholder="Gửi tin nhắn..." className="w-full bg-slate-100 border-none text-slate-900 text-[14px] rounded-xl py-2.5 px-4 focus:ring-1 focus:ring-teal-500 placeholder-slate-500 outline-none transition-shadow" />
          </div>
          <button className="w-10 h-10 flex items-center justify-center rounded-xl bg-teal-500 text-white shadow-md hover:bg-teal-600 active:scale-95 transition-all">
            <span className="material-symbols-outlined text-[20px]" style={{fontVariationSettings: "'FILL' 1"}}>send</span>
          </button>
        </div>
      </div>
    </div>
  );
};
export default DriverChatPage;
