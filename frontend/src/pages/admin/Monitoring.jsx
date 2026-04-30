import React, { useState, useEffect } from 'react';
import LeafletMap from '../../components/LeafletMap';

const Monitoring = () => {
  const [surge, setSurge] = useState(null);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const token = localStorage.getItem('token') || '';

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [surgeRes, usersRes] = await Promise.all([
          fetch('/pricing/surge?lat=10.77&lng=106.7'),
          fetch('/auth/admin/users', { headers: { Authorization: `Bearer ${token}` } }),
        ]);

        if (surgeRes.ok) setSurge(await surgeRes.json());
        if (usersRes.ok) {
          const d = await usersRes.json();
          setDrivers((d.users || []).filter(u => u.role === 'DRIVER'));
        }
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    fetchData();
    const interval = setInterval(fetchData, 30000); // refresh 30s
    return () => clearInterval(interval);
  }, []);

  // Giả lập vị trí tài xế trong khu vực HCM
  const driverMarkers = drivers.slice(0, 8).map((d, i) => ({
    lat: 10.7769 + (Math.sin(i * 1.2) * 0.04),
    lng: 106.7009 + (Math.cos(i * 0.9) * 0.05),
    color: d.status === 'ACTIVE' ? '#14b8a6' : '#94a3b8',
    label: d.full_name || d.identifier,
  }));

  const HCMC = [10.7769, 106.7009];

  return (
    <div className="dashboard-container">
      <div className="page-header">
        <h1 className="page-title" style={{ color: '#9b59b6' }}>Live Monitoring</h1>
        <span style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '8px', height: '8px', background: 'var(--accent-teal)', borderRadius: '50%', display: 'inline-block', animation: 'ping 1s infinite' }}></span>
          Tự động cập nhật mỗi 30 giây
        </span>
      </div>

      {/* Surge + Driver Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        {[
          { label: 'SURGE MULTIPLIER', value: surge ? `×${surge.surge_multiplier}` : '…', color: '#f1c40f', icon: '⚡' },
          { label: 'ZONE', value: surge?.zone || '—', color: '#9b59b6', icon: '📍' },
          { label: 'DEMAND INDEX', value: surge?.demand_index ?? '—', color: '#e74c3c', icon: '📈' },
          { label: 'TÀI XẾ ACTIVE', value: loading ? '…' : drivers.filter(d => d.status === 'ACTIVE').length, color: '#1abc9c', icon: '🚕' },
        ].map((k, i) => (
          <div key={i} className="card" style={{ padding: '20px', borderLeft: `3px solid ${k.color}` }}>
            <div style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 700, marginBottom: '8px' }}>{k.label}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '20px' }}>{k.icon}</span>
              <span style={{ fontSize: '26px', fontWeight: 800, color: k.color }}>{k.value}</span>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        {/* Live Map */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '15px' }}>Bản đồ tài xế — TP.HCM</h3>
            <div style={{ display: 'flex', gap: '16px', fontSize: '12px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#14b8a6', display: 'inline-block' }}></span>Online</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#94a3b8', display: 'inline-block' }}></span>Offline</span>
            </div>
          </div>
          <div style={{ height: '400px', minHeight: '400px', position: 'relative' }}>
            <LeafletMap center={HCMC} zoom={13} markers={driverMarkers} className="w-full h-full" style={{ width: '100%', height: '100%' }} />
          </div>
        </div>

        {/* Driver List */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-color)' }}>
            <h3 style={{ margin: 0, fontSize: '15px' }}>Danh sách tài xế ({drivers.length})</h3>
          </div>
          <div style={{ overflowY: 'auto', maxHeight: '420px' }}>
            {loading ? (
              <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-secondary)' }}>Đang tải...</div>
            ) : drivers.length === 0 ? (
              <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-secondary)' }}>Chưa có tài xế</div>
            ) : drivers.map((d, i) => (
              <div key={i} style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: d.status === 'ACTIVE' ? '#14b8a6' : '#64748b', flexShrink: 0 }}></div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '14px' }}>{d.full_name || d.identifier}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{d.driver_id || d.identifier}</div>
                </div>
                <span className={`badge ${d.status === 'ACTIVE' ? 'badge-success' : 'badge-medium'}`} style={{ fontSize: '10px' }}>{d.status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <style dangerouslySetInnerHTML={{__html: `@keyframes ping { 0%,100%{opacity:1} 50%{opacity:0.3} }`}} />
    </div>
  );
};

export default Monitoring;
