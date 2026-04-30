import React, { useState, useEffect } from 'react';
import LeafletMap from '../../components/LeafletMap';

// Hook đọc token từ localStorage
const useAdminToken = () => localStorage.getItem('token') || '';

const Dashboard = ({ onNavigate }) => {
  const token = useAdminToken();
  const [stats, setStats] = useState(null);
  const [recentUsers, setRecentUsers] = useState([]);
  const [recentRides, setRecentRides] = useState([]);
  const [surge, setSurge] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      const headers = { Authorization: `Bearer ${token}` };
      try {
        const [usersRes, ridesRes, surgeRes] = await Promise.all([
          fetch('/auth/admin/users', { headers }),
          fetch('/rides/admin/all?limit=5', { headers }),
          fetch('/pricing/surge?lat=10.77&lng=106.7'),
        ]);

        if (usersRes.ok) {
          const ud = await usersRes.json();
          const users = ud.users || [];
          const drivers = users.filter(u => u.role === 'DRIVER');
          const customers = users.filter(u => u.role === 'USER');
          setStats({
            totalUsers: customers.length,
            totalDrivers: drivers.length,
            totalAccounts: users.length,
            activeDrivers: drivers.filter(d => d.status === 'ACTIVE').length,
          });
          setRecentUsers(users.slice(0, 5));
        }

        if (ridesRes.ok) {
          const rd = await ridesRes.json();
          setRecentRides((rd.rides || rd || []).slice(0, 5));
        }

        if (surgeRes.ok) {
          setSurge(await surgeRes.json());
        }
      } catch (e) {
        console.error('Dashboard fetch error:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  const modules = [
    { id: 'users',      label: 'Users',      color: '#3498db', icon: '👥' },
    { id: 'drivers',    label: 'Drivers',    color: '#e67e22', icon: '🚕' },
    { id: 'rides',      label: 'Rides',      color: '#1abc9c', icon: '🗺️' },
    { id: 'pricing',    label: 'Pricing',    color: '#f1c40f', icon: '💰' },
    { id: 'monitoring', label: 'Monitoring', color: '#9b59b6', icon: '📊' },
  ];

  const HCMC_CENTER = [10.7769, 106.7009];

  return (
    <div className="dashboard-container">
      <div className="page-header">
        <h1 className="page-title">Dashboard Hub</h1>
        <div className="page-actions">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="user-avatar" style={{ width: '32px', height: '32px', fontSize: '12px' }}>AD</div>
            <span style={{ fontSize: '14px', fontWeight: 600 }}>Admin</span>
          </div>
        </div>
      </div>

      {/* Module Hub */}
      <div style={{ marginBottom: '24px' }}>
        <h3 style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px', letterSpacing: '1px' }}>HỆ THỐNG MODULES</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
          {modules.map(m => (
            <div key={m.id} className="card" style={{ padding: '18px', textAlign: 'center', cursor: 'pointer', borderBottom: `3px solid ${m.color}`, transition: 'transform 0.15s' }}
              onClick={() => onNavigate(m.id)}
              onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseLeave={e => e.currentTarget.style.transform = ''}
            >
              <div style={{ fontSize: '22px', marginBottom: '8px' }}>{m.icon}</div>
              <div style={{ fontWeight: 700, fontSize: '13px' }}>{m.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        {loading ? (
          Array(4).fill(0).map((_, i) => (
            <div key={i} className="card" style={{ padding: '20px', height: '80px', background: 'var(--bg-dark)' }}>
              <div style={{ height: '12px', background: 'var(--border-color)', borderRadius: '4px', marginBottom: '12px', animation: 'pulse 1.5s infinite' }}></div>
              <div style={{ height: '24px', background: 'var(--border-color)', borderRadius: '4px', width: '60%', animation: 'pulse 1.5s infinite' }}></div>
            </div>
          ))
        ) : stats ? [
          { label: 'TỔNG TÀI KHOẢN', value: stats.totalAccounts, icon: '🧑‍💼', color: '#3498db' },
          { label: 'KHÁCH HÀNG', value: stats.totalUsers, icon: '👤', color: '#1abc9c' },
          { label: 'TÀI XẾ', value: stats.totalDrivers, icon: '🚕', color: '#e67e22' },
          { label: 'SURGE MULTIPLIER', value: surge ? `×${surge.surge_multiplier}` : '×1', icon: '⚡', color: '#f1c40f' },
        ].map((kpi, i) => (
          <div key={i} className="card" style={{ padding: '20px', borderLeft: `3px solid ${kpi.color}` }}>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '8px' }}>{kpi.label}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '20px' }}>{kpi.icon}</span>
              <span style={{ fontSize: '28px', fontWeight: 800, color: kpi.color }}>{kpi.value ?? '—'}</span>
            </div>
          </div>
        )) : null}
      </div>

      {/* Main Content: Map + Tables */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginBottom: '20px' }}>
        {/* Live Map */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '15px' }}>Live Map — TP. Hồ Chí Minh</h3>
            <span style={{ fontSize: '12px', color: 'var(--accent-teal)' }}>● OpenStreetMap</span>
          </div>
          <div style={{ height: '340px', minHeight: '340px', position: 'relative' }}>
            <LeafletMap
              center={HCMC_CENTER}
              zoom={13}
              markers={[
                { lat: 10.7950, lng: 106.7220, color: '#14b8a6', label: 'Landmark 81' },
                { lat: 10.7726, lng: 106.6980, color: '#f59e0b', label: 'Bến Thành' },
                { lat: 10.8231, lng: 106.6297, color: '#ef4444', label: 'Tân Sơn Nhất' },
                { lat: 10.7769, lng: 106.7009, color: '#3b82f6', label: 'Q.1 Center' },
              ]}
              className="w-full h-full"
              style={{ width: '100%', height: '100%' }}
            />
          </div>
        </div>

        {/* Recent Rides */}
        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between' }}>
            <h3 style={{ margin: 0, fontSize: '15px' }}>Chuyến gần đây</h3>
            <button className="btn btn-outline" style={{ fontSize: '11px', padding: '4px 10px' }} onClick={() => onNavigate('rides')}>Xem tất cả</button>
          </div>
          <div style={{ overflowY: 'auto', maxHeight: '300px' }}>
            {loading ? (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>Đang tải...</div>
            ) : recentRides.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>Chưa có chuyến nào</div>
            ) : (
              <table className="admin-table">
                <thead><tr><th>ID</th><th>TRẠNG THÁI</th><th>GIÁ</th></tr></thead>
                <tbody>
                  {recentRides.map((r, i) => (
                    <tr key={i}>
                      <td style={{ fontSize: '11px', fontFamily: 'monospace' }}>{(r.id || r.ride_id || '').slice(0, 8)}…</td>
                      <td><span className={`badge ${r.status === 'COMPLETED' ? 'badge-success' : r.status === 'CANCELLED' ? 'badge-danger' : 'badge-medium'}`}>{r.status || '—'}</span></td>
                      <td style={{ fontWeight: 600 }}>{r.fare ? `${Number(r.fare).toLocaleString('vi-VN')}đ` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Recent Accounts */}
      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0, fontSize: '15px' }}>Tài khoản gần đây</h3>
          <button className="btn btn-outline" style={{ fontSize: '11px', padding: '4px 10px' }} onClick={() => onNavigate('users')}>Xem tất cả</button>
        </div>
        {loading ? (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>Đang tải...</div>
        ) : (
          <table className="admin-table">
            <thead><tr><th>TÀI KHOẢN</th><th>ROLE</th><th>TRẠNG THÁI</th><th>NGÀY TẠO</th></tr></thead>
            <tbody>
              {recentUsers.map((u, i) => (
                <tr key={i}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div className="user-avatar" style={{ width: '30px', height: '30px', fontSize: '11px' }}>{(u.full_name || u.identifier || '?')[0]}</div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '13px' }}>{u.full_name || u.identifier}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{u.identifier}</div>
                      </div>
                    </div>
                  </td>
                  <td><span className={`badge ${u.role === 'ADMIN' ? 'badge-danger' : u.role === 'DRIVER' ? 'badge-medium' : 'badge-success'}`}>{u.role}</span></td>
                  <td><span className={`badge ${u.status === 'ACTIVE' ? 'badge-success' : 'badge-medium'}`}>{u.status}</span></td>
                  <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{u.created_at ? new Date(u.created_at).toLocaleDateString('vi-VN') : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <style dangerouslySetInnerHTML={{__html: `@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }`}} />
    </div>
  );
};

export default Dashboard;
