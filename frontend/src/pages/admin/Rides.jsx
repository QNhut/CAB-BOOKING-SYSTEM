import React, { useState, useEffect } from 'react';

const Rides = () => {
  const token = localStorage.getItem('token') || '';
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    fetch('/rides/admin/all?limit=50', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { setRides(d.rides || d || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const filtered = rides.filter(r => {
    const matchSearch = !search || (r.id || r.ride_id || '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'ALL' || r.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const statusBadge = (s) => {
    const map = { COMPLETED: 'badge-success', CANCELLED: 'badge-danger', IN_PROGRESS: 'badge-medium', PENDING: 'badge-medium', SEARCHING: 'badge-medium' };
    return map[s] || 'badge-medium';
  };

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 48px)', margin: '-24px -32px' }}>
      <div style={{ flex: 1, padding: '24px 32px', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h1 className="page-title" style={{ color: 'var(--accent-teal)', margin: 0 }}>Quản lý Chuyến đi</h1>
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{filtered.length} chuyến</span>
        </div>

        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
          <div className="search-input-wrapper" style={{ flex: 1 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="text" className="search-input" placeholder="Tìm theo Ride ID..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ background: 'var(--bg-dark)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '8px', padding: '0 12px', fontSize: '13px', cursor: 'pointer' }}>
            <option value="ALL">Tất cả trạng thái</option>
            <option value="COMPLETED">COMPLETED</option>
            <option value="CANCELLED">CANCELLED</option>
            <option value="IN_PROGRESS">IN_PROGRESS</option>
            <option value="SEARCHING">SEARCHING</option>
          </select>
        </div>

        <div className="card" style={{ padding: 0 }}>
          <table className="admin-table">
            <thead>
              <tr><th>RIDE ID</th><th>TRẠNG THÁI</th><th>GIÁ</th><th>LOẠI XE</th><th>THỜI GIAN</th></tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>Đang tải dữ liệu...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>Chưa có chuyến đi nào</td></tr>
              ) : filtered.map((r, i) => (
                <tr key={i} onClick={() => setSelected(r)} style={{ cursor: 'pointer', background: selected?.id === r.id ? 'rgba(26,188,156,0.05)' : '' }}>
                  <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>{(r.id || r.ride_id || '—').slice(0, 14)}…</td>
                  <td><span className={`badge ${statusBadge(r.status)}`}>{r.status || '—'}</span></td>
                  <td style={{ fontWeight: 600 }}>{r.fare ? `${Number(r.fare).toLocaleString('vi-VN')}đ` : '—'}</td>
                  <td>{r.vehicle_type || r.vehicleType || '—'}</td>
                  <td style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{r.created_at ? new Date(r.created_at).toLocaleString('vi-VN') : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ padding: '12px 24px', fontSize: '12px', color: 'var(--text-secondary)', borderTop: '1px solid var(--border-color)' }}>
            {filtered.length} / {rides.length} chuyến
          </div>
        </div>
      </div>

      {/* Sidebar Detail */}
      <div style={{ width: '360px', background: 'var(--bg-panel)', borderLeft: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}>
        {selected ? (
          <>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '16px' }}>Chi tiết chuyến đi</h3>
              <button style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '18px' }} onClick={() => setSelected(null)}>×</button>
            </div>
            <div style={{ padding: '24px', flex: 1, overflowY: 'auto' }}>
              <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                <span className={`badge ${statusBadge(selected.status)}`} style={{ fontSize: '14px', padding: '6px 14px' }}>{selected.status}</span>
                {selected.fare && <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--accent-teal)', marginTop: '10px' }}>{Number(selected.fare).toLocaleString('vi-VN')}đ</div>}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {[
                  { label: 'RIDE ID', value: selected.id || selected.ride_id },
                  { label: 'LOẠI XE', value: selected.vehicle_type || selected.vehicleType || '—' },
                  { label: 'TÀI XẾ ID', value: selected.driver_id || '—' },
                  { label: 'KHÁCH HÀNG ID', value: selected.user_id || selected.customer_id || '—' },
                  { label: 'THỜI GIAN TẠO', value: selected.created_at ? new Date(selected.created_at).toLocaleString('vi-VN') : '—' },
                  { label: 'KHOẢNG CÁCH', value: selected.distanceM ? `${(selected.distanceM / 1000).toFixed(1)} km` : '—' },
                ].map(({ label, value }) => (
                  <div key={label} style={{ padding: '12px', background: 'var(--bg-dark)', borderRadius: '8px' }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: 700 }}>{label}</div>
                    <div style={{ fontSize: '13px', wordBreak: 'break-all' }}>{value}</div>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', gap: '12px' }}>
            <span style={{ fontSize: '40px' }}>🗺️</span>
            <p style={{ fontSize: '14px', textAlign: 'center' }}>Chọn một chuyến đi<br />để xem chi tiết</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Rides;
