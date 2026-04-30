import React, { useState, useEffect } from 'react';
import BottomNav from './BottomNav';

const DriverHistoryPage = ({ toggleTheme, isDarkMode }) => {
  const [activeTab, setActiveTab] = useState('all');
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch('/drivers/me/rides/history', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setHistory(data.rides || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, []);

  const getStatusColor = (status) => {
    switch (status) {
      case 'COMPLETED': return 'bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400';
      case 'CANCELLED': return 'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400';
      default: return 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'COMPLETED': return 'Hoàn thành';
      case 'CANCELLED': return 'Khách hủy';
      default: return status;
    }
  };

  const filteredHistory = history.filter(h => {
    if (activeTab === 'all') return true;
    if (activeTab === 'completed' && h.status === 'COMPLETED') return true;
    if (activeTab === 'cancelled' && h.status === 'CANCELLED') return true;
    return false;
  });

  return (
    <div className="mx-auto w-full max-w-[400px] h-[100dvh] bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white font-sans relative overflow-hidden flex flex-col shadow-2xl sm:border-x sm:border-slate-200 dark:border-slate-800">
      
      {/* Header */}
      <div className="pt-12 pb-4 px-6 bg-white dark:bg-slate-900 shadow-sm z-10 sticky top-0 border-b border-slate-100 dark:border-slate-800">
        <h1 className="text-2xl font-bold mb-4">Lịch sử chạy xe</h1>
        
        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
          {['all', 'completed', 'cancelled'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-full whitespace-nowrap text-sm font-bold transition-colors ${activeTab === tab ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}
            >
              {tab === 'all' ? 'Tất cả' : tab === 'completed' ? 'Đã hoàn thành' : 'Đã hủy'}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-24">
        {loading ? (
           <div className="text-center text-slate-500 mt-10">Đang tải...</div>
        ) : filteredHistory.length === 0 ? (
          <div className="text-center mt-20 flex flex-col items-center">
             <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4 text-4xl">📭</div>
             <p className="text-slate-500 dark:text-slate-400 font-medium">Chưa có chuyến đi nào</p>
          </div>
        ) : (
          filteredHistory.map((item, idx) => (
            <div key={idx} className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-800 active:scale-[0.98] transition-transform cursor-pointer">
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-2">
                  <div className={`p-2 rounded-xl ${getStatusColor(item.status)}`}>
                    <span className="material-symbols-outlined text-[18px]">
                      {item.status === 'COMPLETED' ? 'check_circle' : 'cancel'}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 dark:text-slate-200">X-Ride {item.vehicleType === 'BIKE' ? 'Bike' : 'Car'}</h3>
                    <p className="text-[11px] text-slate-400 font-medium">{new Date(item.completedAt).toLocaleString('vi-VN')}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-black text-slate-900 dark:text-white text-lg">{(item.fare || 0).toLocaleString('vi-VN')}đ</p>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${getStatusColor(item.status)}`}>
                    {getStatusText(item.status)}
                  </span>
                </div>
              </div>
              
              <div className="pl-2 space-y-2 relative border-l-2 border-dashed border-slate-200 dark:border-slate-700 ml-4 mt-2">
                <div className="relative">
                  <div className="absolute -left-[13px] top-1 w-2.5 h-2.5 bg-blue-500 rounded-full border-2 border-white dark:border-slate-900"></div>
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-300 ml-3 truncate">{item.pickup?.address || 'Điểm đón'}</p>
                </div>
                <div className="relative">
                  <div className="absolute -left-[13px] top-1 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-white dark:border-slate-900"></div>
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-300 ml-3 truncate">{item.dropoff?.address || 'Điểm đến'}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <BottomNav />
    </div>
  );
};

export default DriverHistoryPage;
