import React, { useState, useEffect } from 'react';
import BottomNav from './BottomNav';
import ProfileActionSheet from '../../components/ProfileActionSheet';

const DRIVER_PROFILE_ITEMS = [
  { key: 'profile', icon: 'person', label: 'Thông tin cá nhân', color: 'text-blue-500' },
  { key: 'vehicle', icon: 'directions_car', label: 'Phương tiện & Giấy tờ', color: 'text-amber-500' },
  { key: 'bank', icon: 'account_balance', label: 'Tài khoản ngân hàng', color: 'text-emerald-500' },
];

const DRIVER_SYSTEM_ITEMS = [
  { key: 'support', icon: 'help', label: 'Trợ giúp & Hỗ trợ' },
  { key: 'settings', icon: 'settings', label: 'Cài đặt' },
];

const InfoRow = ({ label, value }) => (
  <div className="flex items-start justify-between gap-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 px-4 py-3">
    <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</span>
    <span className="text-right text-sm font-semibold text-slate-800 dark:text-slate-100">{value || 'Chưa có dữ liệu'}</span>
  </div>
);

const DriverProfilePage = ({ toggleTheme, isDarkMode, onLogout }) => {
  const [user, setUser] = useState(null);
  const [driverInfo, setDriverInfo] = useState(null);
  const [stats, setStats] = useState({ totalTrips: 0, totalIncome: 0 });
  const [activeSheet, setActiveSheet] = useState(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const token = localStorage.getItem('token');
        const [authRes, driverRes, historyRes] = await Promise.all([
          fetch('/auth/me', { headers: { 'Authorization': `Bearer ${token}` } }),
          fetch('/drivers/me', { headers: { 'Authorization': `Bearer ${token}` } }),
          fetch('/drivers/me/rides/history', { headers: { 'Authorization': `Bearer ${token}` } })
        ]);
        
        if (authRes.ok) {
          const data = await authRes.json();
          setUser(data.account || data.user || data);
        }
        if (driverRes.ok) {
           setDriverInfo(await driverRes.json());
        }
        if (historyRes.ok) {
          const data = await historyRes.json();
          const rides = Array.isArray(data.rides) ? data.rides : [];
          setStats({
            totalTrips: rides.length,
            totalIncome: rides.reduce((total, ride) => total + Number(ride.fare || 0), 0),
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

  const renderSheetContent = () => {
    switch (activeSheet) {
      case 'profile':
        return {
          title: 'Thông tin tài xế',
          subtitle: 'Thông tin đang đồng bộ từ auth-service và driver-service.',
          content: (
            <div className="space-y-3">
              <InfoRow label="Họ tên" value={user?.full_name || 'Tài xế'} />
              <InfoRow label="Tài khoản" value={user?.identifier} />
              <InfoRow label="Vai trò" value={user?.role || 'DRIVER'} />
              <InfoRow label="Trạng thái" value={user?.status || 'ACTIVE'} />
              <InfoRow label="Mã tài xế" value={driverInfo?.driverId || driverInfo?.id || user?.id} />
            </div>
          )
        };
      case 'vehicle':
        return {
          title: 'Phương tiện & Giấy tờ',
          subtitle: 'Dữ liệu đang đọc từ /drivers/me.',
          content: (
            <div className="space-y-3">
              <InfoRow label="Loại xe" value={driverInfo?.vehicleType || 'Chưa cập nhật'} />
              <InfoRow label="Biển số" value={driverInfo?.plateNumber || driverInfo?.licensePlate || 'Chưa cập nhật'} />
              <InfoRow label="Trạng thái hồ sơ" value={driverInfo?.status || 'Đang chờ cập nhật'} />
              <div className="rounded-2xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
                Nếu driver-service chưa trả đủ hồ sơ, màn này sẽ hiển thị trạng thái thiếu thay vì render giả dữ liệu đẹp mắt nhưng sai.
              </div>
            </div>
          )
        };
      case 'bank':
        return {
          title: 'Tài khoản ngân hàng',
          subtitle: 'Chưa có endpoint backend riêng cho payout.',
          content: (
            <div className="space-y-3">
              <InfoRow label="Tổng thu nhập đã ghi nhận" value={`${stats.totalIncome.toLocaleString('vi-VN')}đ`} />
              <InfoRow label="Số chuyến hoàn thành" value={String(stats.totalTrips)} />
              <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                Khi backend payout/bank account được bổ sung, mục này có thể nối sang endpoint thật. Hiện tại app chỉ hiển thị doanh thu đã đồng bộ từ lịch sử chuyến.
              </div>
            </div>
          )
        };
      case 'support':
        return {
          title: 'Trợ giúp & Hỗ trợ',
          subtitle: 'Thông tin vận hành dành cho tài xế.',
          content: (
            <div className="space-y-3">
              <InfoRow label="Ride history" value="Đang lấy từ /drivers/me/rides/history." />
              <InfoRow label="Trạng thái online" value="Trang /driver/online lấy vị trí thực từ trình duyệt." />
              <InfoRow label="Sự cố nhận cuốc" value="Kiểm tra driver-service và ride-service khi không có chuyến mới." />
            </div>
          )
        };
      case 'settings':
        return {
          title: 'Cài đặt',
          subtitle: 'Cấu hình giao diện và phiên làm việc hiện tại.',
          content: (
            <div className="space-y-3">
              <InfoRow label="Giao diện" value={isDarkMode ? 'Dark mode' : 'Light mode'} />
              <InfoRow label="Vai trò phiên hiện tại" value={localStorage.getItem('role') || 'DRIVER'} />
              <InfoRow label="Điều hướng sau đăng nhập" value="Driver đăng nhập xong sẽ đi vào màn driver flow, không dùng customer shell." />
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
      
      {/* Header Profile */}
      <div className="bg-teal-600 dark:bg-slate-900 pt-16 pb-20 px-6 rounded-b-[40px] shadow-lg relative z-10 border-b border-transparent dark:border-slate-800">
        <div className="absolute top-6 right-6 flex gap-3">
          <button onClick={toggleTheme} className="w-10 h-10 bg-white/20 dark:bg-slate-800 backdrop-blur-md rounded-full flex items-center justify-center text-white transition-colors hover:bg-white/30 dark:hover:bg-slate-700">
            <span className="material-symbols-outlined">{isDarkMode ? 'light_mode' : 'dark_mode'}</span>
          </button>
        </div>

        <div className="flex items-center gap-5 mt-4">
          <div className="relative">
            <div className="w-20 h-20 bg-white dark:bg-slate-800 rounded-full shadow-xl overflow-hidden border-4 border-teal-400 dark:border-slate-700 p-1">
              <div className="w-full h-full bg-slate-200 dark:bg-slate-700 rounded-full flex items-center justify-center text-3xl font-bold text-slate-500">
                {user ? (user.full_name || user.identifier).charAt(0).toUpperCase() : 'TX'}
              </div>
            </div>
            <div className="absolute bottom-0 right-0 w-6 h-6 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-900 flex items-center justify-center">
              <span className="material-symbols-outlined text-[14px] text-white">verified</span>
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-black text-white mb-1">{user?.full_name || 'Tài Xế'}</h1>
            <p className="text-teal-200 dark:text-slate-400 font-medium text-sm">{user?.identifier || '...'}</p>
            <div className="flex items-center gap-1 mt-2 bg-black/20 dark:bg-slate-800 w-fit px-2 py-1 rounded-lg backdrop-blur-sm">
              <span className="material-symbols-outlined text-amber-400 text-[14px]" style={{fontVariationSettings: "'FILL' 1"}}>star</span>
              <span className="text-white text-xs font-bold">4.9 đánh giá</span>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 -mt-10 relative z-20 pb-24 space-y-4">
        
        {/* Stats Grid */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-4">
          <div className="text-center p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
            <span className="material-symbols-outlined text-teal-500 mb-1">local_taxi</span>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">Số chuyến</p>
            <p className="text-lg font-black">{stats.totalTrips}</p>
          </div>
          <div className="text-center p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
            <span className="material-symbols-outlined text-emerald-500 mb-1">payments</span>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">Tổng thu nhập</p>
            <p className="text-lg font-black">{stats.totalIncome.toLocaleString('vi-VN')}đ</p>
          </div>
        </div>

        {/* Menu List */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
          {DRIVER_PROFILE_ITEMS.map((item) => (
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

        {/* System Menu */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
          {DRIVER_SYSTEM_ITEMS.map((item) => (
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

        {/* Logout */}
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

      <BottomNav />
    </div>
  );
};

export default DriverProfilePage;
