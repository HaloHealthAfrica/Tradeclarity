import React, { useState, useEffect } from 'react';
import { api } from '../services/api';

const Admin: React.FC = () => {
  const [apiKeys, setApiKeys] = useState({
    twelvedata: '',
    alpaca: '',
    alpacaSecret: ''
  });
  const [keyStatus, setKeyStatus] = useState({
    twelvedata: 'not configured',
    alpaca: 'not configured',
    alpacaSecret: 'not configured'
  });
  const [systemInfo, setSystemInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [demoMode, setDemoMode] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState({
    twelvedata: '',
    alpaca: '',
    alpacaSecret: ''
  });
  const [message, setMessage] = useState<string|null>(null);

  useEffect(() => {
    const fetchAdminData = async () => {
      setLoading(true);
      try {
        // Fetch API key status
        const keysRes = await fetch('/api/admin/keys');
        const keysData = await keysRes.json();
        setKeyStatus({
          twelvedata: keysData.keys.twelvedata === '***configured***' ? 'configured' : 'not configured',
          alpaca: keysData.keys.alpaca === '***configured***' ? 'configured' : 'not configured',
          alpacaSecret: keysData.keys.alpacaSecret === '***configured***' ? 'configured' : 'not configured',
        });
        setDemoMode(
          keysData.keys.twelvedata !== '***configured***' ||
          keysData.keys.alpaca !== '***configured***' ||
          keysData.keys.alpacaSecret !== '***configured***'
        );
        // Fetch system info
        const sysRes = await fetch('/api/admin/system');
        const sysData = await sysRes.json();
        setSystemInfo(sysData.system);
      } catch (error) {
        setMessage('Error fetching admin data.');
      }
      setLoading(false);
    };
    fetchAdminData();
  }, []);

  const handleEdit = () => {
    setEditMode(true);
    setForm({ ...apiKeys });
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSave = async () => {
    try {
      const res = await fetch('/api/admin/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (res.ok) {
        setMessage('API keys updated successfully. Please restart the backend for changes to take effect.');
        setEditMode(false);
      } else {
        setMessage(data.error || 'Failed to update keys.');
      }
    } catch (error) {
      setMessage('Failed to update keys.');
    }
  };

  if (loading) {
    return <div className="loading">Loading admin panel...</div>;
  }

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1 className="page-title">Admin Panel</h1>
        <p className="page-subtitle">System configuration and monitoring</p>
      </div>

      {demoMode && (
        <div className="alert alert-warning">
          <b>Warning:</b> The backend is running in <b>demo mode</b> because one or more API keys are not configured.<br/>
          Please set your API keys below and restart the backend to enable live data.
        </div>
      )}

      {message && (
        <div className="alert alert-info">{message}</div>
      )}

      {/* API Keys Configuration */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">
            <i className="fas fa-key"></i> API Keys Configuration
          </h2>
        </div>
        <div className="grid grid-cols-1">
          {editMode ? (
            <>
              <div className="status-item">
                <label>TwelveData API Key</label>
                <input type="text" name="twelvedata" value={form.twelvedata} onChange={handleFormChange} className="input" />
              </div>
              <div className="status-item">
                <label>Alpaca API Key</label>
                <input type="text" name="alpaca" value={form.alpaca} onChange={handleFormChange} className="input" />
              </div>
              <div className="status-item">
                <label>Alpaca Secret Key</label>
                <input type="text" name="alpacaSecret" value={form.alpacaSecret} onChange={handleFormChange} className="input" />
              </div>
              <button className="btn btn-success" onClick={handleSave}><i className="fas fa-save"></i> Save</button>
              <button className="btn btn-secondary" onClick={()=>setEditMode(false)}>Cancel</button>
            </>
          ) : (
            <>
              <div className="status-item d-flex justify-content-between align-items-center">
                <div>
                  <div className="status-label">TwelveData API Key</div>
                  <div className="status-value">{keyStatus.twelvedata === 'configured' ? 'Configured' : 'Not Configured'}</div>
                </div>
                <span className={`badge ${keyStatus.twelvedata === 'configured' ? 'success' : 'danger'}`}>{keyStatus.twelvedata === 'configured' ? 'Configured' : 'Not Configured'}</span>
              </div>
              <div className="status-item d-flex justify-content-between align-items-center">
                <div>
                  <div className="status-label">Alpaca API Key</div>
                  <div className="status-value">{keyStatus.alpaca === 'configured' ? 'Configured' : 'Not Configured'}</div>
                </div>
                <span className={`badge ${keyStatus.alpaca === 'configured' ? 'success' : 'danger'}`}>{keyStatus.alpaca === 'configured' ? 'Configured' : 'Not Configured'}</span>
              </div>
              <div className="status-item d-flex justify-content-between align-items-center">
                <div>
                  <div className="status-label">Alpaca Secret Key</div>
                  <div className="status-value">{keyStatus.alpacaSecret === 'configured' ? 'Configured' : 'Not Configured'}</div>
                </div>
                <span className={`badge ${keyStatus.alpacaSecret === 'configured' ? 'success' : 'danger'}`}>{keyStatus.alpacaSecret === 'configured' ? 'Configured' : 'Not Configured'}</span>
              </div>
              <button className="btn btn-primary" onClick={handleEdit}><i className="fas fa-edit"></i> Edit Keys</button>
            </>
          )}
        </div>
      </div>

      {/* System Information */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">
            <i className="fas fa-server"></i> System Information
          </h2>
        </div>
        {systemInfo && (
          <div className="grid grid-cols-2">
            <div className="status-item">
              <div className="status-label">Node Version</div>
              <div className="status-value">{systemInfo.nodeVersion}</div>
            </div>
            <div className="status-item">
              <div className="status-label">Platform</div>
              <div className="status-value">{systemInfo.platform}</div>
            </div>
            <div className="status-item">
              <div className="status-label">Uptime</div>
              <div className="status-value">{Math.floor(systemInfo.uptime/60)} min</div>
            </div>
            <div className="status-item">
              <div className="status-label">Memory Usage</div>
              <div className="status-value">{Math.round(systemInfo.memory.rss/1024/1024)} MB</div>
            </div>
            <div className="status-item">
              <div className="status-label">Environment</div>
              <div className="status-value">{systemInfo.environment}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Admin; 