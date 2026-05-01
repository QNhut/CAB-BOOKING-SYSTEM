import React, { useState, useEffect } from 'react';
import BottomNav from './BottomNav';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const statusColor = (status) => {
  switch (status) {
    case 'COMPLETED': return 'bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400';
    case 'CANCELLED': return 'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400';
    default:          return 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400';
  }
};

const statusText = (status) => {
  switch (status) {
    case 'COMPLETED': return 'Hoàn thành';
    case 'CANCELLED': return 'Khách hủy';
    case 'DRIVER_ASSIGNED': return 'Đã nhận chuyến';
    case 'PICKED_UP': return 'Đang chở';
    default: return status;
  }
};

const vehicleLabel = (type) => {
  if (type === 'CAR_7') return 'Chuyến Car 7 chỗ';
  if (type === 'CAR_4') return 'Chuyến Car 4 chỗ';
  return `Chuyến ${type || 'Car'}`;
};

const fmt = (n) => (Number(n) || 0).toLocaleString('vi-VN');
const fmtDate = (d) => d ? new Date(d).toLocaleString('vi-VN') : '—';
const fmtDateShort = (d) => d ? new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

// ─── Detail Row ───────────────────────────────────────────────────────────────
const DetailRow = ({ icon, label, value, accent }) => (
  <div className="flex items-start gap-3 py-2.5 border-b border-slate-100 dark:border-slate-800 last:border-0">
    <span className={`material-symbols-outlined text-[18px] mt-0.5 shrink-0 ${accent || 'text-slate-400'}`}>{icon}</span>
    <div className="flex-1 min-w-0">
      <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">{label}</p>
      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 break-words">{value || '—'}</p>
    </div>
  </div>
);

// ─── Trip Detail Sheet ─────────────────────────────────────────────────────────
const TripDetailSheet = ({ item, onClose }) => {
  if (!item) return null;

  const earnings = item.fare || 0;
  const commission = Math.round(earnings * 0.2);
  const net = earnings - commission;

  return (
    <div className="absolute inset-0 z-50 flex items-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Sheet */}
      <div className="relative w-full max-h-[90%] bg-white dark:bg-slate-900 rounded-t-3xl shadow-2xl flex flex-col overflow-hidden">
        {/* Handle */}
        <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full mx-auto mt-3 mb-1 shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 pb-3 pt-1 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div>
            <h2 className="font-bold text-lg text-slate-900 dark:text-white">{vehicleLabel(item.vehicleType)}</h2>
            <p className="text-xs text-slate-400">{fmtDate(item.completedAt || item.createdAt)}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${statusColor(item.status)}`}>
              {statusText(item.status)}
            </span>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500">
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
        </div>

        {/* Earnings breakdown hero */}
        <div className="px-5 py-4 bg-teal-50 dark:bg-teal-900/20 shrink-0">
          <p className="text-xs text-slate-500 font-medium mb-2">Thu nhập chuyến đi</p>
          <div className="flex items-end justify-between">
            <div>
              <p className="text-3xl font-black text-teal-600 dark:text-teal-400">{fmt(net)}<span className="text-base font-semibold ml-1">đ</span></p>
              <p className="text-xs text-slate-400 mt-0.5">Thực nhận (sau hoa hồng)</p>
            </div>
            <div className="text-right text-xs text-slate-500 space-y-0.5">
              <p>Tổng thu: <span className="font-bold text-slate-700 dark:text-slate-300">{fmt(earnings)}đ</span></p>
              <p>Hoa hồng 20%: <span className="font-bold text-rose-500">-{fmt(commission)}đ</span></p>
            </div>
          </div>
        </div>

        {/* Details scroll */}
        <div className="flex-1 overflow-y-auto px-5 py-2">
          {/* Route */}
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1 mt-2">Hành trình</p>
          <div className="relative pl-4">
            <div className="absolute left-1.5 top-2 bottom-2 w-0.5 bg-slate-200 dark:bg-slate-700" />
            <div className="mb-3 relative">
              <div className="absolute -left-[17px] top-1.5 w-2.5 h-2.5 bg-blue-500 rounded-full border-2 border-white dark:border-slate-900" />
              <p className="text-[10px] text-slate-400 font-medium">Điểm đón</p>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{item.pickup?.address || item.pickup?.name || '—'}</p>
            </div>
            <div className="relative">
              <div className="absolute -left-[17px] top-1.5 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-white dark:border-slate-900" />
              <p className="text-[10px] text-slate-400 font-medium">Điểm đến</p>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{item.dropoff?.address || item.dropoff?.name || '—'}</p>
            </div>
          </div>

          {/* Info rows */}
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1 mt-4">Chi tiết chuyến</p>
          <DetailRow icon="confirmation_number" label="Mã booking" value={item.bookingId || item.id} />
          <DetailRow icon="directions_car" label="Loại xe" value={item.vehicleType} />
          {item.distanceM > 0 && (
            <DetailRow icon="straighten" label="Khoảng cách" value={`${(item.distanceM / 1000).toFixed(1)} km`} />
          )}
          <DetailRow icon="person_pin" label="Mã khách hàng" value={item.userId} />
          <DetailRow icon="schedule" label="Nhận chuyến lúc" value={fmtDate(item.createdAt)} accent="text-amber-400" />
          <DetailRow icon="check_circle" label="Hoàn thành lúc" value={fmtDate(item.completedAt)} accent="text-teal-400" />
          <DetailRow
            icon={item.paymentMethod === 'VNPAY' ? 'account_balance' : 'payments'}
            label="Thanh toán"
            value={item.paymentMethod === 'VNPAY' ? 'VNPay (Online)' : 'Tiền mặt'}
            accent={item.paymentMethod === 'VNPAY' ? 'text-blue-500' : 'text-emerald-500'}
          />
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-100 dark:border-slate-800 shrink-0">
          <button
            onClick={onClose}
            className="w-full py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-2xl text-sm active:scale-95 transition-transform"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Main Page ─────────────────────────────────────────────────────────────────
const DriverHistoryPage = ({ toggleTheme, isDarkMode }) => {
  const [activeTab, setActiveTab] = useState('all');
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTrip, setSelectedTrip] = useState(null);

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

  const filteredHistory = history.filter(h => {
    if (activeTab === 'all') return true;
    if (activeTab === 'completed' && h.status === 'COMPLETED') return true;
    if (activeTab === 'cancelled' && h.status === 'CANCELLED') return true;
    return false;
  });

  // Summary stats
  const totalEarnings = history.filter(h => h.status === 'COMPLETED').reduce((s, h) => s + (Number(h.fare) || 0), 0);
  const totalTrips = history.filter(h => h.status === 'COMPLETED').length;

  return (
    <div className="mx-auto w-full max-w-[400px] h-[100dvh] bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white font-sans relative overflow-hidden flex flex-col shadow-2xl sm:border-x sm:border-slate-200 dark:border-slate-800">

      {/* Header */}
      <div className="pt-12 pb-4 px-6 bg-white dark:bg-slate-900 shadow-sm z-10 border-b border-slate-100 dark:border-slate-800">
        <h1 className="text-2xl font-bold mb-3">Lịch sử chạy xe</h1>

        {/* Stats strip */}
        {!loading && history.length > 0 && (
          <div className="flex gap-3 mb-3">
            <div className="flex-1 bg-teal-50 dark:bg-teal-900/20 rounded-xl px-3 py-2 text-center">
              <p className="text-xs text-slate-500">Tổng chuyến</p>
              <p className="font-black text-teal-600 text-lg">{totalTrips}</p>
            </div>
            <div className="flex-1 bg-amber-50 dark:bg-amber-900/20 rounded-xl px-3 py-2 text-center">
              <p className="text-xs text-slate-500">Thực nhận</p>
              <p className="font-black text-amber-600 text-lg">{fmt(Math.round(totalEarnings * 0.8))}đ</p>
            </div>
          </div>
        )}

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
      <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-24">
        {loading ? (
          <div className="text-center text-slate-500 mt-10">Đang tải...</div>
        ) : filteredHistory.length === 0 ? (
          <div className="text-center mt-20 flex flex-col items-center">
            <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4 text-4xl">📭</div>
            <p className="text-slate-500 dark:text-slate-400 font-medium">Chưa có chuyến đi nào</p>
          </div>
        ) : (
          filteredHistory.map((item, idx) => (
            <div
              key={idx}
              onClick={() => setSelectedTrip(item)}
              className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-800 active:scale-[0.98] transition-transform cursor-pointer hover:border-teal-200 dark:hover:border-teal-800"
            >
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-2">
                  <div className={`p-2 rounded-xl ${statusColor(item.status)}`}>
                    <span className="material-symbols-outlined text-[18px]">
                      {item.status === 'COMPLETED' ? 'check_circle' : 'cancel'}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm">{vehicleLabel(item.vehicleType)}</h3>
                    <p className="text-[11px] text-slate-400 font-medium">{fmtDateShort(item.completedAt || item.createdAt)}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-black text-teal-600 dark:text-teal-400 text-lg">{fmt(Math.round((item.fare || 0) * 0.8))}đ</p>
                  <p className="text-[10px] text-slate-400">Tổng: {fmt(item.fare)}đ</p>
                </div>
              </div>

              {/* Status badge */}
              <div className="flex items-center justify-between mb-2">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${statusColor(item.status)}`}>
                  {statusText(item.status)}
                </span>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-slate-400">Xem chi tiết</span>
                  <span className="material-symbols-outlined text-[14px] text-slate-400">chevron_right</span>
                </div>
              </div>

              {/* Mini route */}
              <div className="pl-2 space-y-1.5 relative border-l-2 border-dashed border-slate-200 dark:border-slate-700 ml-4">
                <div className="relative">
                  <div className="absolute -left-[13px] top-1 w-2.5 h-2.5 bg-blue-500 rounded-full border-2 border-white dark:border-slate-900" />
                  <p className="text-xs text-slate-600 dark:text-slate-300 ml-3 truncate">{item.pickup?.address || item.pickup?.name || 'Điểm đón'}</p>
                </div>
                <div className="relative">
                  <div className="absolute -left-[13px] top-1 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-white dark:border-slate-900" />
                  <p className="text-xs text-slate-600 dark:text-slate-300 ml-3 truncate">{item.dropoff?.address || item.dropoff?.name || 'Điểm đến'}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Detail sheet */}
      {selectedTrip && (
        <TripDetailSheet item={selectedTrip} onClose={() => setSelectedTrip(null)} />
      )}

      <BottomNav />
    </div>
  );
};

export default DriverHistoryPage;
