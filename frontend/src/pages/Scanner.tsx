import React, { useState, useEffect } from 'react';
import { api, ScannerResult, ScannerStatus } from '../services/api';

const Scanner: React.FC = () => {
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>(['AAPL', 'MSFT', 'GOOGL', 'TSLA']);
  const [scannerStatus, setScannerStatus] = useState<ScannerStatus | null>(null);
  const [scannerResults, setScannerResults] = useState<ScannerResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [scannerRunning, setScannerRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const availableSymbols = ['AAPL', 'MSFT', 'GOOGL', 'TSLA', 'NVDA', 'AMD', 'META', 'NFLX', 'AMZN', 'SPY', 'QQQ'];

  useEffect(() => {
    loadScannerStatus();
    loadScannerResults();
    
    // Auto-refresh every 5 seconds for status, 10 seconds for results
    const statusInterval = setInterval(loadScannerStatus, 5000);
    const resultsInterval = setInterval(loadScannerResults, 10000);
    
    return () => {
      clearInterval(statusInterval);
      clearInterval(resultsInterval);
    };
  }, []);

  const loadScannerStatus = async () => {
    try {
      const status = await api.getScannerStatus();
      setScannerStatus(status);
      setScannerRunning(status.isRunning);
      setError(null);
    } catch (err) {
      console.error('Error loading scanner status:', err);
      setError('Failed to load scanner status');
      setScannerStatus({ isRunning: false, activeSymbols: [], lastScan: '' });
    }
  };

  const loadScannerResults = async () => {
    try {
      setLoading(true);
      const results = await api.getScannerResults();
      setScannerResults(results);
      setError(null);
    } catch (err) {
      console.error('Error loading scanner results:', err);
      setError('Failed to load scanner results');
      setScannerResults([]);
    } finally {
      setLoading(false);
    }
  };

  const toggleSymbol = (symbol: string, checked: boolean) => {
    if (checked) {
      setSelectedSymbols(prev => [...prev, symbol]);
    } else {
      setSelectedSymbols(prev => prev.filter(s => s !== symbol));
    }
  };

  const startScanner = async () => {
    try {
      setError(null);
      await api.startScanner(selectedSymbols);
      setScannerRunning(true);
      await loadScannerStatus();
    } catch (err) {
      console.error('Error starting scanner:', err);
      setError('Failed to start scanner');
    }
  };

  const stopScanner = async () => {
    try {
      setError(null);
      await api.stopScanner();
      setScannerRunning(false);
      await loadScannerStatus();
    } catch (err) {
      console.error('Error stopping scanner:', err);
      setError('Failed to stop scanner');
    }
  };

  const getConfidenceClass = (confidence: number) => {
    if (confidence >= 80) return 'high';
    if (confidence >= 60) return 'medium';
    return 'low';
  };

  const getPatternBadgeClass = (pattern: string) => {
    if (pattern.toLowerCase().includes('bullish') || pattern.toLowerCase().includes('buy')) return 'success';
    if (pattern.toLowerCase().includes('bearish') || pattern.toLowerCase().includes('sell')) return 'danger';
    return 'info';
  };

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1 className="page-title">Market Scanner</h1>
        <p className="page-subtitle">Real-time market scanning and pattern detection</p>
        {error && (
          <div className="alert alert-warning" style={{ marginTop: 'var(--spacing-sm)' }}>
            <i className="fas fa-exclamation-triangle"></i>
            {error}
          </div>
        )}
      </div>

      {/* Scanner Control Panel */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">
            <i className="fas fa-cogs"></i> Scanner Control
          </h2>
        </div>
        
        <div className="grid grid-cols-2">
          <div>
            <h5 style={{ marginBottom: 'var(--spacing-md)', color: 'var(--text-primary)' }}>
              <i className="fas fa-list"></i> Symbol Selection
            </h5>
            <div className="symbol-grid">
              {availableSymbols.map(symbol => (
                <label key={symbol} className="symbol-checkbox">
                  <input
                    type="checkbox"
                    checked={selectedSymbols.includes(symbol)}
                    onChange={(e) => toggleSymbol(symbol, e.target.checked)}
                  />
                  <span className="symbol-label">{symbol}</span>
                </label>
              ))}
            </div>
          </div>
          
          <div>
            <h5 style={{ marginBottom: 'var(--spacing-md)', color: 'var(--text-primary)' }}>
              <i className="fas fa-info-circle"></i> Scanner Status
            </h5>
            <div className="status-grid">
              <div className="status-item">
                <span className="status-label">Status:</span>
                <span className={`status-value ${scannerRunning ? 'success' : 'danger'}`}>
                  <i className={`fas fa-${scannerRunning ? 'play' : 'stop'}`}></i>
                  {scannerRunning ? 'Running' : 'Stopped'}
                </span>
              </div>
              <div className="status-item">
                <span className="status-label">Active Symbols:</span>
                <span className="status-value">
                  <i className="fas fa-list"></i>
                  {scannerStatus?.activeSymbols?.length || 0}
                </span>
              </div>
              <div className="status-item">
                <span className="status-label">Last Scan:</span>
                <span className="status-value">
                  {scannerStatus?.lastScan ? new Date(scannerStatus.lastScan).toLocaleTimeString() : 'Never'}
                </span>
              </div>
            </div>
          </div>
        </div>
        
        <div style={{ marginTop: 'var(--spacing-lg)', paddingTop: 'var(--spacing-lg)', borderTop: '1px solid var(--border-primary)' }}>
          <button 
            className="btn btn-success" 
            onClick={startScanner}
            disabled={scannerRunning}
          >
            <i className="fas fa-play"></i> Start Scanner
          </button>
          <button 
            className="btn btn-danger" 
            onClick={stopScanner}
            disabled={!scannerRunning}
            style={{ marginLeft: 'var(--spacing-sm)' }}
          >
            <i className="fas fa-stop"></i> Stop Scanner
          </button>
        </div>
      </div>

      {/* Scan Results */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">
            <i className="fas fa-chart-line"></i> Scan Results
          </h2>
          <div className="card-actions">
            <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              {scannerResults.length} results
            </span>
          </div>
        </div>
        
        {loading ? (
          <div className="loading" style={{ padding: 'var(--spacing-xl)' }}>
            <span className="loading-spinner"></span>
            Loading scan results...
          </div>
        ) : scannerResults.length === 0 ? (
          <div style={{ padding: 'var(--spacing-xl)', textAlign: 'center', color: 'var(--text-muted)' }}>
            <i className="fas fa-search" style={{ fontSize: '3rem', marginBottom: 'var(--spacing-md)', display: 'block' }}></i>
            No scan results available
            <br />
            <small>Start the scanner to see real-time market patterns</small>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th>Pattern</th>
                  <th>Confidence</th>
                  <th>Price</th>
                  <th>Volume</th>
                  <th>RSI</th>
                  <th>MACD</th>
                  <th>EMA</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {scannerResults.map((result, index) => (
                  <tr key={`${result.symbol}-${index}`}>
                    <td>
                      <strong>{result.symbol}</strong>
                    </td>
                    <td>
                      <span className={`badge badge-${getPatternBadgeClass(result.pattern)}`}>
                        {result.pattern}
                      </span>
                    </td>
                    <td>
                      <div className="confidence-bar">
                        <div 
                          className={`confidence-fill confidence-${getConfidenceClass(result.confidence * 100)}`}
                          style={{ width: `${result.confidence * 100}%` }}
                        ></div>
                        <span className="confidence-text">{Math.round(result.confidence * 100)}%</span>
                      </div>
                    </td>
                    <td>${result.price.toFixed(2)}</td>
                    <td>{result.volume.toLocaleString()}</td>
                    <td>{result.indicators.rsi.toFixed(1)}</td>
                    <td>{result.indicators.macd.toFixed(3)}</td>
                    <td>${result.indicators.ema.toFixed(2)}</td>
                    <td>{new Date(result.timestamp).toLocaleTimeString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Scanner; 