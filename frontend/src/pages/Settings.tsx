import React from 'react';

const Settings: React.FC = () => {
  return (
    <div className="settings-page">
      <div className="page-header">
        <h1>Settings</h1>
        <p className="text-muted">User preferences and system configuration</p>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">User Preferences</h2>
        </div>
        <div className="settings-content">
          <p className="text-muted">Settings functionality coming soon...</p>
        </div>
      </div>
    </div>
  );
};

export default Settings; 