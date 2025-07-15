import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { toast } from 'react-hot-toast';

interface Strategy {
  id: string;
  name: string;
  description: string;
}

interface BacktestResult {
  strategy: string;
  totalReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  totalTrades: number;
  profitFactor: number;
  trades: Array<{
    date: string;
    action: 'BUY' | 'SELL';
    price: number;
    quantity: number;
    pnl: number;
  }>;
}

const intervals = [
  '1min', '5min', '15min', '30min', '1hour', '4hour', '1day', '1week', '1month'
];

const Backtest: React.FC = () => {
  const [symbol, setSymbol] = useState('AAPL');
  const [interval, setInterval] = useState('1day');
  const [startDate, setStartDate] = useState(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [strategy, setStrategy] = useState('');
  const [initialCapital, setInitialCapital] = useState(10000);
  const [commission, setCommission] = useState(0);
  const [slippage, setSlippage] = useState(0);
  const [positionSize, setPositionSize] = useState(1);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dataDownloaded, setDataDownloaded] = useState(false);

  useEffect(() => {
    api.get('/api/trading/strategies')
      .then(res => setStrategies(res.data.data || res.data.strategies || []))
      .catch(() => toast.error('Failed to load strategies'));
  }, []);

  const downloadData = async () => {
    setIsDownloading(true);
    setError(null);
    setDataDownloaded(false);
    try {
      await api.post('/api/historical/download', {
        symbol,
        interval,
        startDate,
        endDate
      });
      setDataDownloaded(true);
      toast.success('Historical data downloaded!');
    } catch (e) {
      setError('Failed to download data');
      toast.error('Failed to download data');
    } finally {
      setIsDownloading(false);
    }
  };

  const runBacktest = async () => {
    if (!dataDownloaded) {
      setError('Please download data first');
      toast.error('Please download data first');
      return;
    }
    if (!strategy) {
      setError('Please select a strategy');
      toast.error('Please select a strategy');
      return;
    }
    setIsRunning(true);
    setError(null);
    setResult(null);
    try {
      const payload = {
        symbol,
        strategy,
        interval,
        startDate,
        endDate,
        config: {
          initialCapital,
          commission,
          slippage,
          positionSize
        }
      };
      const res = await api.post('/api/backtest/run', payload);
      setResult(res.data.results || res.data.result);
      toast.success('Backtest complete!');
    } catch (e) {
      setError('Backtest failed');
      toast.error('Backtest failed');
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="container" style={{ maxWidth: 700, margin: '0 auto', padding: 32 }}>
      <h1>Backtest System</h1>
      <p>Download historical data and run a strategy backtest in one place.</p>
      <div style={{ background: '#fff', borderRadius: 8, boxShadow: '0 2px 8px #0001', padding: 24, marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 120 }}>
            <label>Symbol</label>
            <input value={symbol} onChange={e => setSymbol(e.target.value.toUpperCase())} className="input" />
          </div>
          <div style={{ flex: 1, minWidth: 120 }}>
            <label>Interval</label>
            <select value={interval} onChange={e => setInterval(e.target.value)} className="input">
              {intervals.map(i => <option key={i} value={i}>{i}</option>)}
            </select>
          </div>
          <div style={{ flex: 2, minWidth: 180 }}>
            <label>Strategy</label>
            <select value={strategy} onChange={e => setStrategy(e.target.value)} className="input">
              <option value="">Select strategy</option>
              {strategies.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 16, marginTop: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 120 }}>
            <label>Date From</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="input" />
          </div>
          <div style={{ flex: 1, minWidth: 120 }}>
            <label>Date To</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="input" />
          </div>
          <div style={{ flex: 1, minWidth: 120 }}>
            <label>Initial Capital</label>
            <input type="number" value={initialCapital} onChange={e => setInitialCapital(Number(e.target.value))} className="input" />
          </div>
          <div style={{ flex: 1, minWidth: 120 }}>
            <label>Commission</label>
            <input type="number" value={commission} onChange={e => setCommission(Number(e.target.value))} className="input" />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 16, marginTop: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 120 }}>
            <label>Slippage</label>
            <input type="number" value={slippage} onChange={e => setSlippage(Number(e.target.value))} className="input" />
          </div>
          <div style={{ flex: 1, minWidth: 120 }}>
            <label>Position Size</label>
            <input type="number" value={positionSize} onChange={e => setPositionSize(Number(e.target.value))} className="input" />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 16, marginTop: 24 }}>
          <button onClick={downloadData} disabled={isDownloading} className="btn btn-primary">
            {isDownloading ? 'Downloading...' : 'Download Data'}
          </button>
          <button onClick={runBacktest} disabled={isRunning || !dataDownloaded} className="btn btn-success">
            {isRunning ? 'Running...' : 'Run Backtest'}
          </button>
        </div>
        {error && <div style={{ color: 'red', marginTop: 12 }}>{error}</div>}
        {dataDownloaded && <div style={{ color: 'green', marginTop: 12 }}>Data downloaded for {symbol} ({interval}) from {startDate} to {endDate}</div>}
      </div>
      {result && (
        <div style={{ background: '#f9f9f9', borderRadius: 8, boxShadow: '0 1px 4px #0001', padding: 24, marginTop: 24 }}>
          <h2>Backtest Results</h2>
          <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
            <div><strong>Total Return:</strong> {result.totalReturn?.toFixed(2)}%</div>
            <div><strong>Sharpe Ratio:</strong> {result.sharpeRatio?.toFixed(2)}</div>
            <div><strong>Max Drawdown:</strong> {result.maxDrawdown?.toFixed(2)}%</div>
            <div><strong>Win Rate:</strong> {result.winRate?.toFixed(2)}%</div>
            <div><strong>Total Trades:</strong> {result.totalTrades}</div>
            <div><strong>Profit Factor:</strong> {result.profitFactor?.toFixed(2)}</div>
          </div>
          <h3 style={{ marginTop: 24 }}>Trades</h3>
          <div style={{ maxHeight: 200, overflow: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Action</th>
                  <th>Price</th>
                  <th>Quantity</th>
                  <th>PnL</th>
                </tr>
              </thead>
              <tbody>
                {result.trades.map((t, i) => (
                  <tr key={i}>
                    <td>{t.date}</td>
                    <td>{t.action}</td>
                    <td>{t.price}</td>
                    <td>{t.quantity}</td>
                    <td>{t.pnl}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default Backtest; 