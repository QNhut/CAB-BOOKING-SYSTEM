import React, { useState, useEffect } from 'react';

const Users = () => {
  const token = localStorage.getItem('token') || '';
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [actionLoading, setActionLoading] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    fetch('/auth/admin/users', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { setUsers(d.users || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const filtered = users.filter(u => {
    const matchSearch = !search || (u.identifier + ' ' + (u.full_name || '') + ' ' + (u.phone || '')).toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === 'ALL' || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  const handleStatusToggle = async (u) => {
    setActionLoading(true);
    const newStatus = u.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    try {
      const res = await fetch(`/auth/admin/users/${u.id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setUsers(prev => prev.map(x => x.id === u.id ? { ...x, status: newStatus } : x));
        setSelected(prev => prev?.id === u.id ? { ...prev, status: newStatus } : prev);
        setMsg(`✅ Đã ${newStatus === 'ACTIVE' ? 'kích hoạt' : 'đình chỉ'} tài khoản`);
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
          <h1 className="page-title" style={{ color: '#3498db', margin: 0 }}>Quản lý Users</h1>
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{filtered.length} tài khoản</span>
        </div>

        {msg && <div style={{ background: 'rgba(26,188,156,0.1)', border: '1px solid var(--accent-teal)', borderRadius: '8px', padding: '10px 16px', marginBottom: '16px', fontSize: '13px', color: 'var(--accent-teal)' }}>{msg}</div>}

        {/* Search + Filter */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
          <div className="search-input-wrapper" style={{ flex: 1 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="text" className="search-input" placeholder="Tìm email, tên, số điện thoại..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} style={{ background: 'var(--bg-dark)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '8px', padding: '0 12px', fontSize: '13px', cursor: 'pointer' }}>
            <option value="ALL">Tất cả role</option>
            <option value="USER">USER</option>
            <option value="DRIVER">DRIVER</option>
            <option value="ADMIN">ADMIN</option>
          </select>
        </div>

        <div className="card" style={{ padding: 0 }}>
          <table className="admin-table">
            <thead>
              <tr><th>TÀI KHOẢN</th><th>ROLE</th><th>TRẠNG THÁI</th><th>NGÀY TẠO</th></tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>Đang tải dữ liệu...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={4} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>Không tìm thấy tài khoản nào</td></tr>
              ) : filtered.map((u) => (
                <tr key={u.id} onClick={() => setSelected(u)} style={{ cursor: 'pointer', background: selected?.id === u.id ? 'rgba(26,188,156,0.05)' : '' }}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div className="user-avatar" style={{ width: '36px', height: '36px', fontSize: '13px' }}>{(u.full_name || u.identifier || '?')[0].toUpperCase()}</div>
                      <div>
                        <div style={{ fontWeight: 600 }}>{u.full_name || '—'}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{u.identifier}</div>
                      </div>
                    </div>
                  </td>
                  <td><span className={`badge ${u.role === 'ADMIN' ? 'badge-danger' : u.role === 'DRIVER' ? 'badge-medium' : 'badge-success'}`}>{u.role}</span></td>
                  <td><span className={`badge ${u.status === 'ACTIVE' ? 'badge-success' : 'badge-danger'}`}>{u.status}</span></td>
                  <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{u.created_at ? new Date(u.created_at).toLocaleDateString('vi-VN') : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ padding: '12px 24px', fontSize: '12px', color: 'var(--text-secondary)', borderTop: '1px solid var(--border-color)' }}>
            Hiển thị {filtered.length} / {users.length} tài khoản
          </div>
        </div>
      </div>

      {/* Detail Sidebar */}
      <div style={{ width: '380px', background: 'var(--bg-panel)', borderLeft: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}>
        {selected ? (
          <>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '16px' }}>Chi tiết tài khoản</h3>
              <button style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '18px' }} onClick={() => setSelected(null)}>×</button>
            </div>
            <div style={{ padding: '24px', flex: 1, overflowY: 'auto' }}>
              <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                <div style={{ width: '72px', height: '72px', borderRadius: '14px', border: '2px solid #3498db', background: 'rgba(52,152,219,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', fontSize: '28px', fontWeight: 800, color: '#3498db' }}>
                  {(selected.full_name || selected.identifier || '?')[0].toUpperCase()}
                </div>
                <h2 style={{ margin: '0 0 4px', fontSize: '18px' }}>{selected.full_name || 'Không có tên'}</h2>
                <span className={`badge ${selected.role === 'ADMIN' ? 'badge-danger' : selected.role === 'DRIVER' ? 'badge-medium' : 'badge-success'}`}>{selected.role}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                {[
                  { label: 'EMAIL', value: selected.identifier },
                  { label: 'SỐ ĐIỆN THOẠI', value: selected.phone || '—' },
                  { label: 'TRẠNG THÁI', value: selected.status },
                  { label: 'NGÀY TẠO', value: selected.created_at ? new Date(selected.created_at).toLocaleDateString('vi-VN') : '—' },
                  { label: 'ID', value: selected.id?.slice(0, 12) + '…' },
                  { label: 'DRIVER ID', value: selected.driver_id || '—' },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: 700 }}>{label}</div>
                    <div style={{ fontSize: '13px', fontWeight: 500, wordBreak: 'break-all' }}>{value}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ padding: '20px 24px', borderTop: '1px solid var(--border-color)', display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
              <button
                className={`btn ${selected.status === 'ACTIVE' ? 'btn-outline' : 'btn-primary'}`}
                style={{ padding: '12px', color: selected.status === 'ACTIVE' ? 'var(--status-danger)' : '', borderColor: selected.status === 'ACTIVE' ? 'var(--status-danger)' : '' }}
                onClick={() => handleStatusToggle(selected)}
                disabled={actionLoading}
              >
                {actionLoading ? '...' : selected.status === 'ACTIVE' ? 'Đình chỉ' : 'Kích hoạt'}
              </button>
              <button className="btn btn-outline" style={{ padding: '12px' }} onClick={() => setSelected(null)}>Đóng</button>
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', gap: '12px' }}>
            <span style={{ fontSize: '40px' }}>👆</span>
            <p style={{ fontSize: '14px', textAlign: 'center' }}>Chọn một tài khoản<br />để xem chi tiết</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Users;
