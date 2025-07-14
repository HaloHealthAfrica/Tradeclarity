import React, { useState, useEffect } from 'react';
import { 
  MagnifyingGlassIcon,
  FunnelIcon,
  PlayIcon,
  PauseIcon,
  BellIcon,
  ChartBarIcon,
  ClockIcon
} from '@heroicons/react/24/outline';

interface ScannerSignal {
  id: string;
  symbol: string;
  pattern: string;
  direction: 'BUY' | 'SELL';
  confidence: number;
  price: number;
  volume: number;
  timestamp: string;
  status: 'new' | 'confirmed' | 'expired';
}

const Scanner: React.FC = () => {
  const [isScanning, setIsScanning] = useState(false);
  const [signals, setSignals] = useState<ScannerSignal[]>([]);
  const [filters, setFilters] = useState({
    pattern: 'all',
    direction: 'all',
    confidence: 0,
    status: 'all'
  });

  // Mock signals data
  useEffect(() => {
    const mockSignals: ScannerSignal[] = [
      {
        id: '1',
        symbol: 'SPY',
        pattern: 'Inside Bar Breakout',
        direction: 'BUY',
        confidence: 85,
        price: 150.25,
        volume: 1250000,
        timestamp: '2 min ago',
        status: 'new'
      },
      {
        id: '2',
        symbol: 'QQQ',
        pattern: 'Gap Down',
        direction: 'SELL',
        confidence: 78,
        price: 125.80,
        volume: 890000,
        timestamp: '5 min ago',
        status: 'confirmed'
      },
      {
        id: '3',
        symbol: 'TSLA',
        pattern: 'Outside Bar',
        direction: 'BUY',
        confidence: 92,
        price: 245.60,
        volume: 2100000,
        timestamp: '8 min ago',
        status: 'new'
      },
      {
        id: '4',
        symbol: 'AAPL',
        pattern: 'EMA Confluence',
        direction: 'BUY',
        confidence: 88,
        price: 175.40,
        volume: 1560000,
        timestamp: '12 min ago',
        status: 'confirmed'
      }
    ];
    setSignals(mockSignals);
  }, []);

  const toggleScanning = () => {
    setIsScanning(!isScanning);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new':
        return 'status-info';
      case 'confirmed':
        return 'status-success';
      case 'expired':
        return 'status-error';
      default:
        return 'status-muted';
    }
  };

  const getDirectionColor = (direction: string) => {
    return direction === 'BUY' ? 'text-success' : 'text-error';
  };

  const filteredSignals = signals.filter(signal => {
    if (filters.pattern !== 'all' && signal.pattern !== filters.pattern) return false;
    if (filters.direction !== 'all' && signal.direction !== filters.direction) return false;
    if (signal.confidence < filters.confidence) return false;
    if (filters.status !== 'all' && signal.status !== filters.status) return false;
    return true;
  });

  return (
    <div className="scanner-page">
      {/* Header */}
      <div className="scanner-header">
        <div className="header-content">
          <h1 className="page-title">Market Scanner</h1>
          <p className="page-subtitle">Real-time pattern detection and signal generation</p>
        </div>
        <div className="header-actions">
          <button 
            className={`btn ${isScanning ? 'btn-danger' : 'btn-success'}`}
            onClick={toggleScanning}
          >
            {isScanning ? (
              <>
                <PauseIcon className="w-4 h-4 mr-2" />
                Stop Scanner
              </>
            ) : (
              <>
                <PlayIcon className="w-4 h-4 mr-2" />
                Start Scanner
              </>
            )}
          </button>
        </div>
      </div>

      {/* Scanner Stats */}
      <div className="scanner-stats">
        <div className="stat-card">
          <div className="stat-icon">
            <MagnifyingGlassIcon className="w-6 h-6" />
          </div>
          <div className="stat-content">
            <h3 className="stat-value">1,247</h3>
            <p className="stat-label">Symbols Scanned</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">
            <BellIcon className="w-6 h-6" />
          </div>
          <div className="stat-content">
            <h3 className="stat-value">24</h3>
            <p className="stat-label">Signals Today</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">
            <ChartBarIcon className="w-6 h-6" />
          </div>
          <div className="stat-content">
            <h3 className="stat-value">78.5%</h3>
            <p className="stat-label">Accuracy Rate</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">
            <ClockIcon className="w-6 h-6" />
          </div>
          <div className="stat-content">
            <h3 className="stat-value">2.3s</h3>
            <p className="stat-label">Avg Response</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="scanner-filters">
        <div className="filters-header">
          <h3 className="filters-title">
            <FunnelIcon className="w-5 h-5 mr-2" />
            Filters
          </h3>
          <button className="btn btn-sm btn-outline">Clear All</button>
        </div>
        <div className="filters-grid">
          <div className="filter-group">
            <label className="filter-label">Pattern</label>
            <select 
              className="input"
              value={filters.pattern}
              onChange={(e) => setFilters({...filters, pattern: e.target.value})}
            >
              <option value="all">All Patterns</option>
              <option value="Inside Bar Breakout">Inside Bar Breakout</option>
              <option value="Gap Down">Gap Down</option>
              <option value="Outside Bar">Outside Bar</option>
              <option value="EMA Confluence">EMA Confluence</option>
            </select>
          </div>
          <div className="filter-group">
            <label className="filter-label">Direction</label>
            <select 
              className="input"
              value={filters.direction}
              onChange={(e) => setFilters({...filters, direction: e.target.value})}
            >
              <option value="all">All Directions</option>
              <option value="BUY">Buy Only</option>
              <option value="SELL">Sell Only</option>
            </select>
          </div>
          <div className="filter-group">
            <label className="filter-label">Min Confidence</label>
            <input 
              type="range"
              min="0"
              max="100"
              value={filters.confidence}
              onChange={(e) => setFilters({...filters, confidence: parseInt(e.target.value)})}
              className="range-slider"
            />
            <span className="range-value">{filters.confidence}%</span>
          </div>
          <div className="filter-group">
            <label className="filter-label">Status</label>
            <select 
              className="input"
              value={filters.status}
              onChange={(e) => setFilters({...filters, status: e.target.value})}
            >
              <option value="all">All Status</option>
              <option value="new">New</option>
              <option value="confirmed">Confirmed</option>
              <option value="expired">Expired</option>
            </select>
          </div>
        </div>
      </div>

      {/* Signals Table */}
      <div className="signals-section">
        <div className="signals-header">
          <h3 className="signals-title">Recent Signals</h3>
          <div className="signals-actions">
            <span className="signals-count">{filteredSignals.length} signals</span>
            <button className="btn btn-sm btn-outline">Export</button>
          </div>
        </div>
        
        <div className="signals-table">
          <div className="table-header">
            <div className="table-cell">Symbol</div>
            <div className="table-cell">Pattern</div>
            <div className="table-cell">Direction</div>
            <div className="table-cell">Confidence</div>
            <div className="table-cell">Price</div>
            <div className="table-cell">Volume</div>
            <div className="table-cell">Status</div>
            <div className="table-cell">Time</div>
            <div className="table-cell">Actions</div>
          </div>
          
          <div className="table-body">
            {filteredSignals.map((signal) => (
              <div key={signal.id} className="table-row">
                <div className="table-cell">
                  <span className="symbol mono">{signal.symbol}</span>
                </div>
                <div className="table-cell">
                  <span className="pattern">{signal.pattern}</span>
                </div>
                <div className="table-cell">
                  <span className={`direction ${getDirectionColor(signal.direction)}`}>
                    {signal.direction}
                  </span>
                </div>
                <div className="table-cell">
                  <div className="confidence-bar">
                    <div 
                      className="confidence-fill"
                      style={{ width: `${signal.confidence}%` }}
                    ></div>
                    <span className="confidence-text">{signal.confidence}%</span>
                  </div>
                </div>
                <div className="table-cell">
                  <span className="price mono">${signal.price.toFixed(2)}</span>
                </div>
                <div className="table-cell">
                  <span className="volume mono">{signal.volume.toLocaleString()}</span>
                </div>
                <div className="table-cell">
                  <span className={`status ${getStatusColor(signal.status)}`}>
                    {signal.status}
                  </span>
                </div>
                <div className="table-cell">
                  <span className="timestamp">{signal.timestamp}</span>
                </div>
                <div className="table-cell">
                  <div className="actions">
                    <button className="btn btn-sm btn-outline">View</button>
                    <button className="btn btn-sm btn-primary">Trade</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style jsx>{`
        .scanner-page {
          padding: 0;
        }

        .scanner-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: var(--spacing-xl);
        }

        .page-title {
          font-size: 2rem;
          font-weight: 700;
          color: var(--text-primary);
          margin: 0 0 var(--spacing-xs) 0;
        }

        .page-subtitle {
          color: var(--text-muted);
          margin: 0;
        }

        .header-actions {
          display: flex;
          gap: var(--spacing-md);
        }

        .scanner-stats {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: var(--spacing-lg);
          margin-bottom: var(--spacing-xl);
        }

        .stat-card {
          background: var(--card-bg);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          padding: var(--spacing-lg);
          display: flex;
          align-items: center;
          gap: var(--spacing-md);
          transition: all var(--transition-normal);
        }

        .stat-card:hover {
          background: var(--card-hover);
          box-shadow: var(--shadow-lg);
        }

        .stat-icon {
          width: 48px;
          height: 48px;
          background: var(--gradient-primary);
          border-radius: var(--radius-lg);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
        }

        .stat-value {
          font-size: 1.5rem;
          font-weight: 700;
          color: var(--text-primary);
          margin: 0;
        }

        .stat-label {
          font-size: 0.875rem;
          color: var(--text-muted);
          margin: 0;
        }

        .scanner-filters {
          background: var(--card-bg);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          padding: var(--spacing-lg);
          margin-bottom: var(--spacing-xl);
        }

        .filters-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: var(--spacing-lg);
        }

        .filters-title {
          font-size: 1.125rem;
          font-weight: 600;
          color: var(--text-primary);
          margin: 0;
          display: flex;
          align-items: center;
        }

        .filters-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: var(--spacing-lg);
        }

        .filter-group {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-sm);
        }

        .filter-label {
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--text-primary);
        }

        .range-slider {
          width: 100%;
          height: 6px;
          background: var(--border-color);
          border-radius: 3px;
          outline: none;
          -webkit-appearance: none;
        }

        .range-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 18px;
          height: 18px;
          background: var(--primary-blue);
          border-radius: 50%;
          cursor: pointer;
        }

        .range-value {
          font-size: 0.875rem;
          color: var(--text-muted);
          text-align: center;
        }

        .signals-section {
          background: var(--card-bg);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          overflow: hidden;
        }

        .signals-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: var(--spacing-lg);
          border-bottom: 1px solid var(--border-color);
        }

        .signals-title {
          font-size: 1.125rem;
          font-weight: 600;
          color: var(--text-primary);
          margin: 0;
        }

        .signals-actions {
          display: flex;
          align-items: center;
          gap: var(--spacing-md);
        }

        .signals-count {
          font-size: 0.875rem;
          color: var(--text-muted);
        }

        .signals-table {
          overflow-x: auto;
        }

        .table-header {
          display: grid;
          grid-template-columns: 1fr 2fr 1fr 1.5fr 1fr 1fr 1fr 1fr 1.5fr;
          gap: var(--spacing-md);
          padding: var(--spacing-md) var(--spacing-lg);
          background: var(--secondary-bg);
          border-bottom: 1px solid var(--border-color);
          font-weight: 600;
          font-size: 0.875rem;
          color: var(--text-muted);
        }

        .table-body {
          max-height: 600px;
          overflow-y: auto;
        }

        .table-row {
          display: grid;
          grid-template-columns: 1fr 2fr 1fr 1.5fr 1fr 1fr 1fr 1fr 1.5fr;
          gap: var(--spacing-md);
          padding: var(--spacing-md) var(--spacing-lg);
          border-bottom: 1px solid var(--border-light);
          transition: background var(--transition-fast);
        }

        .table-row:hover {
          background: var(--card-hover);
        }

        .table-cell {
          display: flex;
          align-items: center;
          font-size: 0.875rem;
        }

        .symbol {
          font-weight: 600;
          color: var(--text-primary);
        }

        .pattern {
          color: var(--text-secondary);
        }

        .direction {
          font-weight: 600;
          text-transform: uppercase;
        }

        .confidence-bar {
          width: 100%;
          height: 8px;
          background: var(--border-color);
          border-radius: 4px;
          position: relative;
          overflow: hidden;
        }

        .confidence-fill {
          height: 100%;
          background: var(--gradient-success);
          border-radius: 4px;
          transition: width var(--transition-fast);
        }

        .confidence-text {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          font-size: 0.75rem;
          font-weight: 600;
          color: white;
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
        }

        .price {
          font-weight: 600;
          color: var(--text-primary);
        }

        .volume {
          color: var(--text-secondary);
        }

        .timestamp {
          color: var(--text-muted);
          font-size: 0.75rem;
        }

        .actions {
          display: flex;
          gap: var(--spacing-xs);
        }

        @media (max-width: 1200px) {
          .table-header,
          .table-row {
            grid-template-columns: 1fr 1.5fr 1fr 1fr 1fr 1fr 1fr;
          }

          .table-cell:nth-child(6),
          .table-cell:nth-child(8) {
            display: none;
          }
        }

        @media (max-width: 768px) {
          .scanner-header {
            flex-direction: column;
            gap: var(--spacing-md);
          }

          .scanner-stats {
            grid-template-columns: repeat(2, 1fr);
          }

          .filters-grid {
            grid-template-columns: 1fr;
          }

          .table-header,
          .table-row {
            grid-template-columns: 1fr 1fr 1fr 1fr;
          }

          .table-cell:nth-child(n+5) {
            display: none;
          }
        }
      `}</style>
    </div>
  );
};

export default Scanner; 