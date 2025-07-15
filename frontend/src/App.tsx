import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Sidebar from './components/layout/Sidebar';
import Dashboard from './pages/Dashboard';
import Scanner from './pages/Scanner';
import Analysis from './pages/Analysis';
import Backtest from './pages/Backtest';
import HistoricalData from './pages/HistoricalData';
import Admin from './pages/Admin';

const App: React.FC = () => {
  return (
    <Router>
      <div className="app-container">
        <Sidebar />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/scanner" element={<Scanner />} />
            <Route path="/analysis" element={<Analysis />} />
            <Route path="/backtest" element={<Backtest />} />
            <Route path="/historical" element={<HistoricalData />} />
            <Route path="/admin" element={<Admin />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
};

export default App; 