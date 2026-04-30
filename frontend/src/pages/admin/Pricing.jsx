import React, { useState, useEffect } from 'react';

const Pricing = () => {
  const [surgeData, setSurgeData] = useState({
    zone: 'default',
    surge_multiplier: 1.0,
    demand_index: 1.0,
    supply_index: 1.0
  });

  const [formDemand, setFormDemand] = useState(1.0);
  const [formSupply, setFormSupply] = useState(1.0);
  const [loading, setLoading] = useState(false);

  // Fake audit logs for now as there's no backend audit log service
  const [auditLogs, setAuditLogs] = useState([
    { actor: 'Admin', action: 'System started', ip: '127.0.0.1', timestamp: new Date().toLocaleString(), severity: 'Low' },
  ]);

  const fetchSurge = async () => {
    try {
      const res = await fetch('/pricing/surge');
      if (res.ok) {
        const data = await res.json();
        setSurgeData(data);
        setFormDemand(data.demand_index || 1.0);
        setFormSupply(data.supply_index || 1.0);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchSurge();
    const interval = setInterval(fetchSurge, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleApplySurge = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('adminToken') || localStorage.getItem('token');
      const res = await fetch('/pricing/surge', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          demand_index: parseFloat(formDemand),
          supply_index: parseFloat(formSupply)
        })
      });
      
      if (res.ok) {
        const data = await res.json();
        setSurgeData(data);
        alert(`Đã cập nhật hệ số giá thành công! Surge: ${data.surge_multiplier.toFixed(2)}x`);
        
        // Add local audit log
        setAuditLogs(prev => [{
          actor: 'Current Admin',
          action: `Changed Surge (Demand: ${formDemand}, Supply: ${formSupply}) -> ${data.surge_multiplier.toFixed(2)}x`,
          ip: 'Local',
          timestamp: new Date().toLocaleString(),
          severity: 'Medium'
        }, ...prev]);
      } else {
        alert("Lỗi khi cập nhật");
      }
    } catch (e) {
      alert("Lỗi kết nối máy chủ");
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (severity) => {
    if (severity === 'Critical') return 'var(--status-danger)';
    if (severity === 'Medium') return 'var(--status-success)';
    return 'var(--status-warning)';
  };

  return (
    <div className="pricing-page-container">
      <div className="page-header">
        <h1 className="page-title">Pricing & Surge Control</h1>
        <div className="page-actions">
          <button className="btn btn-icon" onClick={fetchSurge}>
            <span className="material-symbols-outlined">refresh</span>
          </button>
        </div>
      </div>

      <div className="pricing-grid">
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="map-container">
            <div className="map-overlay">
              <div className="search-input-wrapper" style={{ width: '250px' }}>
                <span className="material-symbols-outlined" style={{position:'absolute', left: 10, top: 8}}>search</span>
                <input type="text" className="search-input" placeholder="Search District or Zone..." style={{ background: 'var(--bg-panel)', backdropFilter: 'blur(8px)', opacity: 0.9, paddingLeft: 40 }} />
              </div>
            </div>
            
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '250px', height: '250px', border: '2px dashed var(--status-danger)', borderRadius: '50%', opacity: 0.5 }}></div>
            
            <div className="map-info-box" style={{ background: 'var(--bg-panel)', opacity: 0.9 }}>
              <div className="map-info-title">Zone: {surgeData.zone === 'default' ? 'Toàn Thành Phố (Default)' : surgeData.zone}</div>
              <div className="map-info-row">
                <span>Current Surge:</span>
                <span className="text-success font-bold" style={{fontSize: '1.2rem'}}>{(surgeData.surge_multiplier || 1).toFixed(2)}x</span>
              </div>
              <div className="map-info-row">
                <span>Demand Index:</span>
                <span>{(surgeData.demand_index || 1).toFixed(2)}</span>
              </div>
              <div className="map-info-row">
                <span>Supply Index:</span>
                <span>{(surgeData.supply_index || 1).toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div className="card">
            <h3 className="card-title text-amber-500 mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined">warning</span> 
              Cấu hình cơ bản (Chỉ đọc)
            </h3>
            <p className="text-sm text-slate-400 mb-4">Giá cơ bản hiện được cấu hình cứng trong Microservice Pricing (pricing-service/index.js). Không thể thay đổi qua giao diện ở phiên bản hiện tại.</p>
            <div className="form-group opacity-50 pointer-events-none">
              <label className="form-label">BASE FARE (BIKE)</label>
              <input type="text" className="form-control" defaultValue="10000" readOnly />
            </div>
            <div className="form-group opacity-50 pointer-events-none">
              <label className="form-label">BASE FARE (CAR 4)</label>
              <input type="text" className="form-control" defaultValue="12000" readOnly />
            </div>
            <div className="form-group opacity-50 pointer-events-none">
              <label className="form-label">BASE FARE (CAR 7)</label>
              <input type="text" className="form-control" defaultValue="15000" readOnly />
            </div>
          </div>

          <div className="card" style={{ padding: '24px' }}>
            <h3 className="card-title text-teal-400">Surge Configuration (Thay đổi Demand / Supply)</h3>
            <p className="text-sm text-slate-400 mb-4">Surge được tính tự động: Surge = max(1.0, Demand / Supply). Việc điều chỉnh thủ công này sẽ ép hệ thống chạy theo thông số mới.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '10px' }}>
              
              <div className="config-item">
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>DEMAND INDEX (MỨC ĐỘ NHU CẦU ĐẶT XE)</label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input 
                    type="number" step="0.1" 
                    value={formDemand}
                    onChange={(e) => setFormDemand(e.target.value)}
                    style={{ flex: 1, background: 'var(--bg-dark)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '10px', borderRadius: '5px' }} 
                  />
                </div>
              </div>

              <div className="config-item">
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>SUPPLY INDEX (MỨC ĐỘ TÀI XẾ SẴN SÀNG)</label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input 
                    type="number" step="0.1" 
                    value={formSupply}
                    onChange={(e) => setFormSupply(e.target.value)}
                    style={{ flex: 1, background: 'var(--bg-dark)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '10px', borderRadius: '5px' }} 
                  />
                </div>
              </div>

              <button 
                onClick={handleApplySurge} 
                disabled={loading}
                className="btn btn-primary mt-2 flex justify-center items-center gap-2" 
                style={{ backgroundColor: 'var(--accent-teal)', color: 'var(--bg-panel)', padding: '12px', fontSize: '14px', fontWeight: 'bold' }}
              >
                {loading ? 'ĐANG LƯU...' : 'ÁP DỤNG THAY ĐỔI SURGE'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: '24px', padding: 0 }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)' }}>
          <h3 className="card-title" style={{ margin: 0 }}>System Audit Logs (Lịch sử phiên làm việc)</h3>
        </div>
        <table className="admin-table">
          <thead>
            <tr>
              <th>ACTOR</th>
              <th>ACTION</th>
              <th>IP ADDRESS</th>
              <th>TIMESTAMP</th>
              <th>SEVERITY</th>
            </tr>
          </thead>
          <tbody>
            {auditLogs.map((log, index) => (
              <tr key={index}>
                <td>{log.actor}</td>
                <td>{log.action}</td>
                <td>{log.ip}</td>
                <td>{log.timestamp}</td>
                <td>
                  <span className={`badge ${log.severity === 'Critical' ? 'badge-danger' : log.severity === 'Medium' ? 'badge-success' : 'badge-warning'}`}>
                    {log.severity}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Pricing;
