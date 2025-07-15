import React, { useState, useEffect } from 'react';
import { api } from '../services/api';

interface TradingMetrics {
  totalPnL: number;
  dailyPnL: number;
  winRate: number;
  totalTrades: number;
  avgTradeSize: number;
  maxDrawdown: number;
}

interface Trade {
  id: string;
  symbol: string;
  type: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  timestamp: string;
  pnl: number;
  strategy: string;
}

interface StrategyDetail {
  name: string;
  pnl: number;
  winRate: number;
  totalTrades: number;
  trades: Trade[];
  alerts: Alert[];
}

interface Alert {
  id: string;
  symbol: string;
  type: 'BUY' | 'SELL';
  price: number;
  timestamp: string;
  confidence: number;
  status: 'active' | 'executed' | 'cancelled';
  strategy: string;
}

const Analysis: React.FC = () => {
  const [metrics, setMetrics] = useState<TradingMetrics>({
    totalPnL: 0,
    dailyPnL: 0,
    winRate: 0,
    totalTrades: 0,
    avgTradeSize: 0,
    maxDrawdown: 0
  });
  const [recentTrades, setRecentTrades] = useState<Trade[]>([]);
  const [performance, setPerformance] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedStrategy, setSelectedStrategy] = useState<StrategyDetail | null>(null);
  const [showStrategyModal, setShowStrategyModal] = useState(false);

  useEffect(() => {
    const fetchAnalysisData = async () => {
      try {
        setLoading(true);
        
        // Fetch analysis data from API
        const [metricsData, tradesData, performanceData] = await Promise.all([
          api.getAnalysisMetrics(),
          api.getRecentTrades(),
          api.getAnalysisPerformance()
        ]);

        setMetrics(metricsData);
        setRecentTrades(tradesData.trades || []);
        setPerformance(performanceData);
        
        setLoading(false);
      } catch (error) {
        console.error('Error fetching analysis data:', error);
        setLoading(false);
      }
    };

    fetchAnalysisData();
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatPercentage = (value: number) => {
    return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  const handleStrategyClick = async (strategyName: string) => {
    try {
      const strategyData = await api.getStrategyDetails(strategyName);
      setSelectedStrategy(strategyData);
      setShowStrategyModal(true);
    } catch (error) {
      console.error('Error fetching strategy details:', error);
    }
  };

  const closeStrategyModal = () => {
    setShowStrategyModal(false);
    setSelectedStrategy(null);
  };

  if (loading) {
    return (
      <div className="loading">
        <span className="loading-spinner"></span>
        Loading analysis...
      </div>
    );
  }

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1 className="page-title">Trading Analysis</h1>
        <p className="page-subtitle">Performance metrics and trade history</p>
      </div>

      {/* Performance Metrics */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">
            <i className="fas fa-chart-line"></i> Performance Metrics
          </h2>
        </div>
        
        <div className="grid grid-cols-3">
          <div className="status-item">
            <div className="status-label">Total P&L</div>
            <div className={`status-value ${metrics.totalPnL >= 0 ? 'success' : 'danger'}`}>
              {formatCurrency(metrics.totalPnL)}
            </div>
          </div>
          <div className="status-item">
            <div className="status-label">Daily P&L</div>
            <div className={`status-value ${metrics.dailyPnL >= 0 ? 'success' : 'danger'}`}>
              {formatCurrency(metrics.dailyPnL)}
            </div>
          </div>
          <div className="status-item">
            <div className="status-label">Win Rate</div>
            <div className="status-value">{metrics.winRate.toFixed(1)}%</div>
          </div>
          <div className="status-item">
            <div className="status-label">Total Trades</div>
            <div className="status-value">{metrics.totalTrades}</div>
          </div>
          <div className="status-item">
            <div className="status-label">Avg Trade Size</div>
            <div className="status-value">{formatCurrency(metrics.avgTradeSize)}</div>
          </div>
          <div className="status-item">
            <div className="status-label">Max Drawdown</div>
            <div className="status-value danger">{formatCurrency(metrics.maxDrawdown)}</div>
          </div>
        </div>
      </div>

      {/* Recent Trades */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">
            <i className="fas fa-history"></i> Recent Trades
          </h2>
          <div className="card-actions">
            <button className="btn btn-primary btn-sm">
              <i className="fas fa-download"></i> Export
            </button>
          </div>
        </div>
        
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Type</th>
                <th>Quantity</th>
                <th>Price</th>
                <th>P&L</th>
                <th>Strategy</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {recentTrades.map((trade) => (
                <tr key={trade.id}>
                  <td><strong>{trade.symbol}</strong></td>
                  <td>
                    <span className={`badge ${trade.type === 'BUY' ? 'success' : 'danger'}`}>
                      {trade.type}
                    </span>
                  </td>
                  <td>{trade.quantity}</td>
                  <td>{formatCurrency(trade.price)}</td>
                  <td className={trade.pnl >= 0 ? 'success' : 'danger'}>
                    {formatCurrency(trade.pnl)}
                  </td>
                  <td>{trade.strategy}</td>
                  <td>{new Date(trade.timestamp).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Strategy Performance */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">
            <i className="fas fa-chart-pie"></i> Strategy Performance
          </h2>
        </div>
        
        {performance && performance.strategies && (
          <div className="grid grid-cols-2">
            {performance.strategies.map((strategy: any, index: number) => (
              <div 
                key={index} 
                className="status-item clickable" 
                onClick={() => handleStrategyClick(strategy.name)}
                style={{ cursor: 'pointer', transition: 'all 0.2s ease' }}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
              >
                <div className="status-label">{strategy.name}</div>
                <div className={`status-value ${strategy.pnl >= 0 ? 'success' : 'danger'}`}>
                  {formatCurrency(strategy.pnl)}
                </div>
                <div className="status-hint" style={{ fontSize: '0.8em', opacity: 0.7, marginTop: '4px' }}>
                  Click to view details
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Risk Analysis */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">
            <i className="fas fa-shield-alt"></i> Risk Analysis
          </h2>
        </div>
        
        {performance && performance.riskMetrics && (
          <div className="grid grid-cols-2">
            <div className="status-item">
              <div className="status-label">Sharpe Ratio</div>
              <div className="status-value success">{performance.riskMetrics.sharpeRatio}</div>
            </div>
            <div className="status-item">
              <div className="status-label">Max Drawdown</div>
              <div className="status-value danger">{performance.riskMetrics.maxDrawdown}%</div>
            </div>
            <div className="status-item">
              <div className="status-label">Volatility</div>
              <div className="status-value warning">{performance.riskMetrics.volatility}%</div>
            </div>
            <div className="status-item">
              <div className="status-label">Beta</div>
              <div className="status-value info">{performance.riskMetrics.beta}</div>
            </div>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">
            <i className="fas fa-tools"></i> Analysis Tools
          </h2>
        </div>
        
        <div className="d-flex gap-3" style={{ flexWrap: 'wrap' }}>
          <button className="btn btn-primary">
            <i className="fas fa-chart-bar"></i> Generate Report
          </button>
          <button className="btn btn-success">
            <i className="fas fa-download"></i> Export Data
          </button>
          <button className="btn btn-info">
            <i className="fas fa-chart-line"></i> Performance Chart
          </button>
          <button className="btn btn-warning">
            <i className="fas fa-cog"></i> Analysis Settings
          </button>
        </div>
      </div>

      {/* Strategy Detail Modal */}
      {showStrategyModal && selectedStrategy && (
        <div className="modal-overlay" onClick={closeStrategyModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">
                <i className="fas fa-chart-line"></i> {selectedStrategy.name} Details
              </h2>
              <button className="modal-close" onClick={closeStrategyModal}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            
            <div className="modal-body">
              {/* Strategy Summary */}
              <div className="strategy-summary">
                <div className="grid grid-cols-3">
                  <div className="summary-item">
                    <div className="summary-label">Total P&L</div>
                    <div className={`summary-value ${selectedStrategy.pnl >= 0 ? 'success' : 'danger'}`}>
                      {formatCurrency(selectedStrategy.pnl)}
                    </div>
                  </div>
                  <div className="summary-item">
                    <div className="summary-label">Win Rate</div>
                    <div className="summary-value">{selectedStrategy.winRate.toFixed(1)}%</div>
                  </div>
                  <div className="summary-item">
                    <div className="summary-label">Total Trades</div>
                    <div className="summary-value">{selectedStrategy.totalTrades}</div>
                  </div>
                </div>
              </div>

              {/* Alerts Section */}
              <div className="modal-section">
                <h3 className="section-title">
                  <i className="fas fa-bell"></i> Recent Alerts
                </h3>
                <div className="table-responsive">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Symbol</th>
                        <th>Type</th>
                        <th>Price</th>
                        <th>Confidence</th>
                        <th>Status</th>
                        <th>Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedStrategy.alerts && selectedStrategy.alerts.map((alert: Alert) => (
                        <tr key={alert.id}>
                          <td><strong>{alert.symbol}</strong></td>
                          <td>
                            <span className={`badge ${alert.type === 'BUY' ? 'success' : 'danger'}`}>
                              {alert.type}
                            </span>
                          </td>
                          <td>{formatCurrency(alert.price)}</td>
                          <td>{alert.confidence.toFixed(1)}%</td>
                          <td>
                            <span className={`badge ${alert.status === 'executed' ? 'success' : alert.status === 'active' ? 'warning' : 'danger'}`}>
                              {alert.status}
                            </span>
                          </td>
                          <td>{new Date(alert.timestamp).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Trades Section */}
              <div className="modal-section">
                <h3 className="section-title">
                  <i className="fas fa-history"></i> Recent Trades
                </h3>
                <div className="table-responsive">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Symbol</th>
                        <th>Type</th>
                        <th>Quantity</th>
                        <th>Entry Price</th>
                        <th>Exit Price</th>
                        <th>P&L</th>
                        <th>Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedStrategy.trades && selectedStrategy.trades.map((trade: Trade) => (
                        <tr key={trade.id}>
                          <td><strong>{trade.symbol}</strong></td>
                          <td>
                            <span className={`badge ${trade.type === 'BUY' ? 'success' : 'danger'}`}>
                              {trade.type}
                            </span>
                          </td>
                          <td>{trade.quantity}</td>
                          <td>{formatCurrency(trade.price)}</td>
                          <td>{formatCurrency(trade.price + (trade.pnl / trade.quantity))}</td>
                          <td className={trade.pnl >= 0 ? 'success' : 'danger'}>
                            {formatCurrency(trade.pnl)}
                          </td>
                          <td>{new Date(trade.timestamp).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Analysis; 