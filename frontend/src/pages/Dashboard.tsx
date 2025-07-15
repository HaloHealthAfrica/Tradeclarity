import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api, DashboardData } from '../services/api';

const Dashboard: React.FC = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        setError(null);
        const dashboardData = await api.getDashboard();
        setData(dashboardData);
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
        setError('Failed to load dashboard data. Please check your connection.');
        // Use mock data as fallback
        setData({
          metrics: {
            totalValue: 125000,
            dailyPnL: 1250,
            totalPnL: 8500,
            activePositions: 8
          },
          portfolio: [
            { symbol: 'AAPL', quantity: 100, avgPrice: 150.25, currentPrice: 155.80, pnl: 555, pnlPercent: 3.69 },
            { symbol: 'MSFT', quantity: 50, avgPrice: 280.00, currentPrice: 295.50, pnl: 775, pnlPercent: 5.54 },
            { symbol: 'GOOGL', quantity: 25, avgPrice: 120.00, currentPrice: 118.75, pnl: -31.25, pnlPercent: -1.04 }
          ],
          systemStatus: {
            scanner: true,
            strategies: true,
            marketData: true
          }
        });
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();

    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchDashboardData, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="loading">
        <span className="loading-spinner"></span>
        Loading dashboard...
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="loading">
        <i className="fas fa-exclamation-triangle" style={{ fontSize: '2rem', marginBottom: 'var(--spacing-md)', display: 'block', color: 'var(--danger)' }}></i>
        {error}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="loading">
        <i className="fas fa-exclamation-triangle" style={{ fontSize: '2rem', marginBottom: 'var(--spacing-md)', display: 'block', color: 'var(--danger)' }}></i>
        Failed to load dashboard data
      </div>
    );
  }

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">Trading overview and system status</p>
        {error && (
          <div className="alert alert-warning" style={{ marginTop: 'var(--spacing-sm)' }}>
            <i className="fas fa-exclamation-triangle"></i>
            {error}
          </div>
        )}
      </div>

      {/* Trading Metrics */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">
            <i className="fas fa-chart-line"></i> Trading Metrics
          </h2>
        </div>
        
        <div className="grid grid-cols-4">
          <div className="status-item">
            <div className="status-label">Portfolio Value</div>
            <div className="status-value">${data.metrics.totalValue.toLocaleString()}</div>
          </div>
          <div className="status-item">
            <div className="status-label">Daily P&L</div>
            <div className={`status-value ${data.metrics.dailyPnL >= 0 ? 'success' : 'danger'}`}>
              {data.metrics.dailyPnL >= 0 ? '+' : ''}${data.metrics.dailyPnL.toLocaleString()}
            </div>
          </div>
          <div className="status-item">
            <div className="status-label">Total P&L</div>
            <div className={`status-value ${data.metrics.totalPnL >= 0 ? 'success' : 'danger'}`}>
              {data.metrics.totalPnL >= 0 ? '+' : ''}${data.metrics.totalPnL.toLocaleString()}
            </div>
          </div>
          <div className="status-item">
            <div className="status-label">Active Positions</div>
            <div className="status-value">{data.metrics.activePositions}</div>
          </div>
        </div>
      </div>

      {/* Portfolio Positions */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">
            <i className="fas fa-briefcase"></i> Portfolio Positions
          </h2>
          <div className="card-actions">
            <Link to="/analysis" className="btn btn-primary">
              <i className="fas fa-chart-bar"></i> View Analysis
            </Link>
          </div>
        </div>
        
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Quantity</th>
                <th>Avg Price</th>
                <th>Current Price</th>
                <th>P&L</th>
                <th>P&L %</th>
              </tr>
            </thead>
            <tbody>
              {data.portfolio.map((position) => (
                <tr key={position.symbol}>
                  <td><strong>{position.symbol}</strong></td>
                  <td>{position.quantity}</td>
                  <td>${position.avgPrice.toFixed(2)}</td>
                  <td>${position.currentPrice.toFixed(2)}</td>
                  <td className={position.pnl >= 0 ? 'success' : 'danger'}>
                    {position.pnl >= 0 ? '+' : ''}${position.pnl.toFixed(2)}
                  </td>
                  <td className={position.pnlPercent >= 0 ? 'success' : 'danger'}>
                    {position.pnlPercent >= 0 ? '+' : ''}{position.pnlPercent.toFixed(2)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* System Status */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">
            <i className="fas fa-cogs"></i> System Status
          </h2>
        </div>
        
        <div className="grid grid-cols-3">
          <div className="status-item">
            <div className="status-label">Scanner</div>
            <div className={`status-value ${data.systemStatus.scanner ? 'success' : 'danger'}`}>
              <i className={`fas fa-${data.systemStatus.scanner ? 'check' : 'times'}`}></i>
              {data.systemStatus.scanner ? 'Running' : 'Stopped'}
            </div>
          </div>
          <div className="status-item">
            <div className="status-label">Strategies</div>
            <div className={`status-value ${data.systemStatus.strategies ? 'success' : 'danger'}`}>
              <i className={`fas fa-${data.systemStatus.strategies ? 'check' : 'times'}`}></i>
              {data.systemStatus.strategies ? 'Active' : 'Inactive'}
            </div>
          </div>
          <div className="status-item">
            <div className="status-label">Market Data</div>
            <div className={`status-value ${data.systemStatus.marketData ? 'success' : 'danger'}`}>
              <i className={`fas fa-${data.systemStatus.marketData ? 'check' : 'times'}`}></i>
              {data.systemStatus.marketData ? 'Connected' : 'Disconnected'}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">
            <i className="fas fa-bolt"></i> Quick Actions
          </h2>
        </div>
        
        <div className="grid grid-cols-3">
          <Link to="/scanner" className="btn btn-outline-primary">
            <i className="fas fa-search"></i> Market Scanner
          </Link>
          <Link to="/analysis" className="btn btn-outline-primary">
            <i className="fas fa-chart-bar"></i> Analysis
          </Link>
          <Link to="/settings" className="btn btn-outline-primary">
            <i className="fas fa-cog"></i> Settings
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Dashboard; 