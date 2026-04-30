import React, { useState, useEffect } from 'react';
import CustomerBottomNav from './CustomerBottomNav';
import ProfileActionSheet from '../../components/ProfileActionSheet';
import { clearRecentDestinations, getRecentDestinations, getStoredPickup } from '../../lib/customerStorage';

const CUSTOMER_PROFILE_ITEMS = [
  { key: 'profile', icon: 'person', label: 'Thông tin cá nhân', color: 'text-blue-500' },
  { key: 'saved-addresses', icon: 'location_on', label: 'Địa chỉ đã lưu', color: 'text-emerald-500' },
  { key: 'payment', icon: 'payment', label: 'Thanh toán', color: 'text-amber-500' },
  { key: 'safety', icon: 'security', label: 'Trung tâm an toàn', color: 'text-rose-500' },
];

const CUSTOMER_SYSTEM_ITEMS = [
  { key: 'support', icon: 'help', label: 'Trợ giúp & Hỗ trợ' },
  { key: 'settings', icon: 'settings', label: 'Cài đặt' },
];

const InfoRow = ({ label, value }) => (
  <div className="flex items-start justify-between gap-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 px-4 py-3">
    <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</span>
    <span className="text-right text-sm font-semibold text-slate-800 dark:text-slate-100">{value || 'Chưa có dữ liệu'}</span>
  </div>
);

const CustomerProfilePage = ({ toggleTheme, isDarkMode, onLogout }) => {
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState({ totalTrips: 0, totalSpent: 0 });
  const [activeSheet, setActiveSheet] = useState(null);
  const [recentDestinations, setRecentDestinations] = useState(() => getRecentDestinations());
  const pickup = getStoredPickup();

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const token = localStorage.getItem('token');
        const [profileResponse, historyResponse] = await Promise.all([
          fetch('/auth/me', {
            headers: { 'Authorization': `Bearer ${token}` }
          }),
          fetch('/bookings/me/history', {
            headers: { 'Authorization': `Bearer ${token}` }
          })
        ]);

        if (profileResponse.ok) {
          const data = await profileResponse.json();
          setUser(data.account || data.user || data);
        }

        if (historyResponse.ok) {
          const data = await historyResponse.json();
          const rides = Array.isArray(data.rides) ? data.rides : [];

          setStats({
            totalTrips: rides.length,
            totalSpent: rides.reduce((total, ride) => total + Number(ride.fare || 0), 0),
          });
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchUser();
  }, []);

  const handleLogout = () => {
    if (confirm("Bạn có chắc chắn muốn đăng xuất?")) {
      if (onLogout) onLogout();
      else {
        localStorage.removeItem('token');
        localStorage.removeItem('role');
        window.location.href = '/';
      }
    }
  };

  const handleClearSearchHistory = () => {
    clearRecentDestinations();
    setRecentDestinations([]);
  };

  const renderSheetContent = () => {
    switch (activeSheet) {
      case 'profile':
        return {
          title: 'Thông tin cá nhân',
          subtitle: 'Thông tin tài khoản đang lấy từ backend auth.',
          content: (
            <div className="space-y-3">
              <InfoRow label="Họ tên" value={user?.full_name || 'Khách hàng'} />
              <InfoRow label="Tài khoản" value={user?.identifier} />
              <InfoRow label="Vai trò" value={user?.role || 'USER'} />
              <InfoRow label="Mã người dùng" value={user?.id} />
              <InfoRow label="Trạng thái" value={user?.status || 'ACTIVE'} />
            </div>
          )
        };
      case 'saved-addresses':
        return {
          title: 'Địa chỉ đã lưu',
          subtitle: 'Bao gồm điểm đón hiện tại và lịch sử tìm kiếm gần đây trên thiết bị này.',
          content: (
            <div className="space-y-3">
              <InfoRow label="Điểm đón hiện tại" value={pickup.address || pickup.name} />
              <div className="rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
                {recentDestinations.length > 0 ? recentDestinations.map((place, index) => (
                  <div key={`${place.lat}-${place.lng}-${index}`} className="px-4 py-3 bg-white dark:bg-slate-900 border-b last:border-b-0 border-slate-100 dark:border-slate-800">
                    <p className="font-semibold text-slate-800 dark:text-slate-100">{place.name}</p>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{place.address}</p>
                  </div>
                )) : (
                  <div className="px-4 py-6 text-sm text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900">
                    Chưa có địa chỉ đã lưu hoặc lịch sử tìm kiếm gần đây.
                  </div>
                )}
              </div>
            </div>
          ),
          footer: recentDestinations.length > 0 ? (
            <button
              type="button"
              onClick={handleClearSearchHistory}
              className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-200"
            >
              Xóa lịch sử tìm kiếm trên thiết bị này
            </button>
          ) : null,
        };
      case 'payment':
        return {
          title: 'Thanh toán',
          subtitle: 'Frontend hiện đang đặt xe với phương thức mặc định là tiền mặt.',
          content: (
            <div className="space-y-3">
              <InfoRow label="Phương thức mặc định" value="Tiền mặt" />
              <InfoRow label="Tổng chi tiêu" value={`${stats.totalSpent.toLocaleString('vi-VN')}đ`} />
              <div className="rounded-2xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
                Ví X-Pay và quản lý thẻ vẫn chưa có endpoint backend riêng, nên màn này đang hiển thị đúng trạng thái tích hợp hiện tại thay vì số liệu giả.
              </div>
            </div>
          )
        };
      case 'safety':
        return {
          title: 'Trung tâm an toàn',
          subtitle: 'Thông tin hỗ trợ khẩn cấp trong app.',
          content: (
            <div className="space-y-3">
              <InfoRow label="Khuyến nghị" value="Luôn kiểm tra biển số và tên tài xế trước khi lên xe." />
              <InfoRow label="Báo cáo sự cố" value="Liên hệ hỗ trợ hoặc hủy chuyến ngay nếu có dấu hiệu bất thường." />
              <InfoRow label="Theo dõi chuyến đi" value="Trang tracking sẽ cập nhật khi backend gán tài xế hoặc thay đổi trạng thái chuyến." />
            </div>
          )
        };
      case 'support':
        return {
          title: 'Trợ giúp & Hỗ trợ',
          subtitle: 'Các kênh hỗ trợ trong môi trường dev hiện tại.',
          content: (
            <div className="space-y-3">
              <InfoRow label="Hỗ trợ kỹ thuật" value="Kiểm tra API gateway tại /health khi app không tải được dữ liệu." />
              <InfoRow label="Auth" value="Đăng xuất sẽ gọi /auth/logout rồi xóa session local." />
              <InfoRow label="Booking" value="Lịch sử và trạng thái chuyến đang đọc từ /bookings/me/history và /bookings/:id." />
            </div>
          )
        };
      case 'settings':
        return {
          title: 'Cài đặt',
          subtitle: 'Các cấu hình phía client đang dùng.',
          content: (
            <div className="space-y-3">
              <InfoRow label="Giao diện" value={isDarkMode ? 'Dark mode' : 'Light mode'} />
              <InfoRow label="Vai trò phiên hiện tại" value={localStorage.getItem('role') || 'USER'} />
              <InfoRow label="Thiết bị" value="Session storage lưu pickup/dropoff, local storage lưu token và lịch sử tìm kiếm." />
            </div>
          ),
          footer: (
            <button
              type="button"
              onClick={toggleTheme}
              className="w-full rounded-2xl bg-slate-900 dark:bg-white px-4 py-3 text-sm font-semibold text-white dark:text-slate-900"
            >
              Chuyển sang {isDarkMode ? 'light mode' : 'dark mode'}
            </button>
          )
        };
      default:
        return null;
    }
  };

  const sheet = renderSheetContent();

  return (
    <div className="mx-auto w-full max-w-[400px] h-[100dvh] bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white font-sans relative overflow-hidden flex flex-col shadow-2xl sm:border-x sm:border-slate-200 dark:border-slate-800">
      
      <div className="bg-blue-600 dark:bg-slate-900 pt-16 pb-20 px-6 rounded-b-[40px] shadow-lg relative z-10 border-b border-transparent dark:border-slate-800">
        <div className="absolute top-6 right-6 flex gap-3">
          <button onClick={toggleTheme} className="w-10 h-10 bg-white/20 dark:bg-slate-800 backdrop-blur-md rounded-full flex items-center justify-center text-white transition-colors hover:bg-white/30 dark:hover:bg-slate-700">
            <span className="material-symbols-outlined">{isDarkMode ? 'light_mode' : 'dark_mode'}</span>
          </button>
        </div>

        <div className="flex items-center gap-5 mt-4">
          <div className="relative">
            <div className="w-20 h-20 bg-white dark:bg-slate-800 rounded-full shadow-xl overflow-hidden border-4 border-blue-400 dark:border-slate-700 p-1">
              <div className="w-full h-full bg-slate-200 dark:bg-slate-700 rounded-full flex items-center justify-center text-3xl font-bold text-slate-500">
                {user ? (user.full_name || user.identifier).charAt(0).toUpperCase() : 'U'}
              </div>
            </div>
            <div className="absolute bottom-0 right-0 w-6 h-6 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-900 flex items-center justify-center">
              <span className="material-symbols-outlined text-[14px] text-white">verified</span>
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-black text-white mb-1">{user?.full_name || 'Khách hàng'}</h1>
            <p className="text-blue-200 dark:text-slate-400 font-medium text-sm">{user?.identifier || '...'}</p>
            <div className="flex items-center gap-1 mt-2 bg-black/20 dark:bg-slate-800 w-fit px-2 py-1 rounded-lg backdrop-blur-sm">
              <span className="material-symbols-outlined text-amber-400 text-[14px]" style={{fontVariationSettings: "'FILL' 1"}}>star</span>
              <span className="text-white text-xs font-bold">5.0 đánh giá</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 -mt-10 relative z-20 pb-24 space-y-4">
        
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-4">
          <div className="text-center p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
            <span className="material-symbols-outlined text-blue-500 mb-1">local_taxi</span>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">Chuyến đi</p>
            <p className="text-xl font-black">{stats.totalTrips}</p>
          </div>
          <div className="text-center p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
            <span className="material-symbols-outlined text-emerald-500 mb-1">payments</span>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">Đã chi tiêu</p>
            <p className="text-xl font-black">{stats.totalSpent.toLocaleString('vi-VN')}đ</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
          {CUSTOMER_PROFILE_ITEMS.map((item, idx) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setActiveSheet(item.key)}
              className="w-full flex items-center justify-between p-4 border-b border-slate-50 dark:border-slate-800/50 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors active:bg-slate-100"
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center ${item.color}`}>
                  <span className="material-symbols-outlined">{item.icon}</span>
                </div>
                <span className="font-bold text-slate-700 dark:text-slate-300">{item.label}</span>
              </div>
              <span className="material-symbols-outlined text-slate-300 dark:text-slate-600">chevron_right</span>
            </button>
          ))}
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
          {CUSTOMER_SYSTEM_ITEMS.map((item, idx) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setActiveSheet(item.key)}
              className="w-full flex items-center justify-between p-4 border-b last:border-b-0 border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-500">
                  <span className="material-symbols-outlined">{item.icon}</span>
                </div>
                <span className="font-bold text-slate-700 dark:text-slate-300">{item.label}</span>
              </div>
              <span className="material-symbols-outlined text-slate-300 dark:text-slate-600">chevron_right</span>
            </button>
          ))}
        </div>

        <button onClick={handleLogout} className="w-full py-4 bg-white dark:bg-slate-900 text-rose-500 font-bold rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 flex items-center justify-center gap-2 hover:bg-rose-50 dark:hover:bg-slate-800 transition-colors active:scale-[0.98]">
          <span className="material-symbols-outlined">logout</span>
          Đăng xuất
        </button>
      </div>

      <ProfileActionSheet
        isOpen={Boolean(sheet)}
        title={sheet?.title}
        subtitle={sheet?.subtitle}
        onClose={() => setActiveSheet(null)}
        footer={sheet?.footer}
      >
        {sheet?.content}
      </ProfileActionSheet>

      <CustomerBottomNav />
    </div>
  );
};

export default CustomerProfilePage;
