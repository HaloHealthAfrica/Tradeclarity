import React from 'react';

const App: React.FC = () => {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#18181b', color: '#fff', flexDirection: 'column' }}>
      <h1 style={{ fontSize: '2.5rem', fontWeight: 700 }}>Paper Trading System</h1>
      <p style={{ fontSize: '1.2rem', marginTop: '1rem' }}>Welcome! The frontend is running successfully.</p>
    </div>
  );
};

export default App; 