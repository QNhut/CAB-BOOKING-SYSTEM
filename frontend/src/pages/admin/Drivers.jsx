import React, { useState, useEffect } from 'react';

const Drivers = () => {
  const token = localStorage.getItem('token') || '';
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    fetch('/auth/admin/users', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => {
        const driverList = (d.users || []).filter(u => u.role === 'DRIVER');
        setDrivers(driverList);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filtered = drivers.filter(d => {
    if (!search) return true;
    return (d.identifier + ' ' + (d.full_name || '') + ' ' + (d.phone || '') + ' ' + (d.driver_id || '')).toLowerCase().includes(search.toLowerCase());
  });

  const handleToggle = async (d) => {
    setActionLoading(true);
    const newStatus = d.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    try {
      const res = await fetch(`/auth/admin/users/${d.id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setDrivers(prev => prev.map(x => x.id === d.id ? { ...x, status: newStatus } : x));
        setSelected(prev => prev?.id === d.id ? { ...prev, status: newStatus } : prev);
        setMsg(`✅ Tài xế đã ${newStatus === 'ACTIVE' ? 'kích hoạt' : 'bị đình chỉ'}`);
        setTimeout(() => setMsg(''), 3000);
      }
    } catch (e) { console.error(e); }
    finally { setActionLoading(false); }
  };

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 48px)', margin: '-24px -32px' }}>
      {/* List */}
      <div style={{ flex: 1, padding: '24px 32px', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h1 className="page-title" style={{ color: '#e67e22', margin: 0 }}>Quản lý Tài xế</h1>
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{filtered.length} tài xế</span>
        </div>

        {msg && <div style={{ background: 'rgba(26,188,156,0.1)', border: '1px solid var(--accent-teal)', borderRadius: '8px', padding: '10px 16px', marginBottom: '16px', fontSize: '13px', color: 'var(--accent-teal)' }}>{msg}</div>}

        <div className="search-input-wrapper" style={{ marginBottom: '20px' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" className="search-input" placeholder="Tìm tên, email, driver ID..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        <div className="card" style={{ padding: 0 }}>
          <table className="admin-table">
            <thead>
              <tr><th>TÀI XẾ</th><th>DRIVER ID</th><th>TRẠNG THÁI</th><th>NGÀY TẠO</th></tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>Đang tải...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={4} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>Không tìm thấy tài xế</td></tr>
              ) : filtered.map((d) => (
                <tr key={d.id} onClick={() => setSelected(d)} style={{ cursor: 'pointer', background: selected?.id === d.id ? 'rgba(230,126,34,0.05)' : '' }}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div className="user-avatar" style={{ width: '36px', height: '36px', fontSize: '13px', background: 'rgba(230,126,34,0.2)', color: '#e67e22' }}>
                        {(d.full_name || d.identifier || 'D')[0].toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600 }}>{d.full_name || '—'}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{d.identifier}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ fontFamily: 'monospace', fontSize: '12px', color: 'var(--text-secondary)' }}>{d.driver_id || '—'}</td>
                  <td><span className={`badge ${d.status === 'ACTIVE' ? 'badge-success' : 'badge-danger'}`}>{d.status}</span></td>
                  <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{d.created_at ? new Date(d.created_at).toLocaleDateString('vi-VN') : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ padding: '12px 24px', fontSize: '12px', color: 'var(--text-secondary)', borderTop: '1px solid var(--border-color)' }}>
            {filtered.length} / {drivers.length} tài xế
          </div>
        </div>
      </div>

      {/* Sidebar */}
      <div style={{ width: '400px', background: 'var(--bg-panel)', borderLeft: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}>
        {selected ? (
          <>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>Chi tiết tài xế</h3>
              <button style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '18px' }} onClick={() => setSelected(null)}>×</button>
            </div>
            <div style={{ padding: '24px', flex: 1, overflowY: 'auto' }}>
              <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                <div style={{ width: '72px', height: '72px', borderRadius: '14px', border: '2px solid #e67e22', background: 'rgba(230,126,34,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', fontSize: '28px', fontWeight: 800, color: '#e67e22' }}>
                  {(selected.full_name || selected.identifier || 'D')[0].toUpperCase()}
                </div>
                <h2 style={{ margin: '0 0 4px', fontSize: '18px' }}>{selected.full_name || 'Không có tên'}</h2>
                <span className={`badge ${selected.status === 'ACTIVE' ? 'badge-success' : 'badge-danger'}`}>{selected.status}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '20px' }}>
                {[
                  { label: 'EMAIL', value: selected.identifier },
                  { label: 'ĐIỆN THOẠI', value: selected.phone || '—' },
                  { label: 'DRIVER ID', value: selected.driver_id || '—' },
                  { label: 'ACCOUNT ID', value: selected.id?.slice(0, 12) + '…' },
                  { label: 'NGÀY TẠO', value: selected.created_at ? new Date(selected.created_at).toLocaleDateString('vi-VN') : '—' },
                  { label: 'ROLE', value: selected.role },
                ].map(({ label, value }) => (
                  <div key={label} style={{ padding: '12px', background: 'var(--bg-dark)', borderRadius: '8px' }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: 700 }}>{label}</div>
                    <div style={{ fontSize: '13px', wordBreak: 'break-all' }}>{value}</div>
                  </div>
                ))}
              </div>
              {/* Giấy tờ */}
              <div style={{ marginBottom: '8px', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 700 }}>GIẤY TỜ PHÁP LÝ</div>
              {[{ label: 'Bằng lái xe (Hạng B2)', status: 'HỢP LỆ' }, { label: 'Đăng ký xe', status: 'HỢP LỆ' }].map((doc, i) => (
                <div key={i} style={{ padding: '12px', background: 'var(--bg-dark)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '13px' }}>{doc.label}</span>
                  <span style={{ fontSize: '11px', color: 'var(--status-success)', fontWeight: 700 }}>{doc.status}</span>
                </div>
              ))}
            </div>
            <div style={{ padding: '20px 24px', borderTop: '1px solid var(--border-color)', display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
              <button
                className="btn btn-outline"
                style={{ padding: '12px', color: selected.status === 'ACTIVE' ? 'var(--status-danger)' : 'var(--accent-teal)', borderColor: selected.status === 'ACTIVE' ? 'var(--status-danger)' : 'var(--accent-teal)' }}
                onClick={() => handleToggle(selected)}
                disabled={actionLoading}
              >
                {actionLoading ? '...' : selected.status === 'ACTIVE' ? 'Đình chỉ' : 'Kích hoạt'}
              </button>
              <button className="btn btn-outline" onClick={() => setSelected(null)}>Đóng</button>
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', gap: '12px' }}>
            <span style={{ fontSize: '40px' }}>🚕</span>
            <p style={{ fontSize: '14px', textAlign: 'center' }}>Chọn một tài xế<br />để xem chi tiết</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Drivers;
