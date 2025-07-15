import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { toast } from 'react-hot-toast';

interface HistoricalDataset {
  symbol: string;
  interval: string;
  startDate: string;
  endDate: string;
  dataPoints: number;
  fileSize: string;
}

interface Strategy {
  id: string;
  name: string;
  description: string;
  category: string;
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

const HistoricalData: React.FC = () => {
  const [datasets, setDatasets] = useState<HistoricalDataset[]>([]);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [downloading, setDownloading] = useState(false);
  const [runningBacktest, setRunningBacktest] = useState(false);
  const [backtestResult, setBacktestResult] = useState<BacktestResult | null>(null);
  const [selectedDataset, setSelectedDataset] = useState<HistoricalDataset | null>(null);

  // Download form state
  const [downloadForm, setDownloadForm] = useState({
    symbol: 'AAPL',
    interval: '1day',
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });

  // Backtest form state
  const [backtestForm, setBacktestForm] = useState({
    strategy: '',
    initialCapital: 10000,
    commission: 0.01
  });

  useEffect(() => {
    fetchDatasets();
    fetchStrategies();
  }, []);

  const fetchDatasets = async () => {
    try {
      const response = await api.get('/api/historical/metadata');
      // The backend returns { success: true, data: [...], count: number }
      setDatasets(response.data.data || []);
    } catch (error) {
      console.error('Error fetching datasets:', error);
      toast.error('Failed to fetch datasets');
    }
  };

  const fetchStrategies = async () => {
    try {
      const response = await api.get('/api/trading/strategies');
      const strategyList = [
        { id: 'EMAConfluence', name: 'EMA Confluence', description: 'EMA-based trend following strategy', category: 'trend' },
        { id: 'SqueezeStrategy', name: 'Squeeze Strategy', description: 'Bollinger Band squeeze momentum strategy', category: 'momentum' },
        { id: 'ICTStrategy', name: 'ICT Strategy', description: 'Inner Circle Trader methodology', category: 'trend' },
        { id: 'ABCDFibinachiStrategy', name: 'ABCD Fibonacci', description: 'Fibonacci retracement strategy', category: 'mean-reversion' },
        { id: 'BreakAndHoldStrategy', name: 'Break and Hold', description: 'Breakout and hold strategy', category: 'breakout' },
        { id: 'RevStratStrategy', name: 'Reversal Strategy', description: 'Market reversal detection', category: 'mean-reversion' },
        { id: 'OptimizedRevStratStrategy', name: 'Optimized Reversal', description: 'Optimized reversal strategy', category: 'mean-reversion' },
        { id: 'SATYSignalGenerator', name: 'SATY Signal', description: 'SATY signal generation', category: 'momentum' },
        { id: 'FVGStrategy', name: 'Fair Value Gap', description: 'Fair value gap trading strategy', category: 'trend' },
      ];
      setStrategies(strategyList);
    } catch (error) {
      console.error('Error fetching strategies:', error);
      toast.error('Failed to fetch strategies');
    }
  };

  const handleDownload = async () => {
    if (!downloadForm.symbol || !downloadForm.startDate || !downloadForm.endDate) {
      toast.error('Please fill in all required fields');
      return;
    }

    setDownloading(true);
    try {
      await api.post('/api/historical/download', {
        symbol: downloadForm.symbol,
        startDate: downloadForm.startDate,
        endDate: downloadForm.endDate
      });
      toast.success('Historical data downloaded successfully');
      fetchDatasets();
    } catch (error) {
      console.error('Error downloading data:', error);
      toast.error('Failed to download historical data');
    } finally {
      setDownloading(false);
    }
  };

  const handleDeleteDataset = async (symbol: string, interval: string) => {
    try {
      await api.delete(`/api/historical/data/${symbol}/${interval}`);
      toast.success('Dataset deleted successfully');
      fetchDatasets();
    } catch (error) {
      console.error('Error deleting dataset:', error);
      toast.error('Failed to delete dataset');
    }
  };

  const handleRunBacktest = async () => {
    if (!selectedDataset || !backtestForm.strategy) {
      toast.error('Please select a dataset and strategy');
      return;
    }

    setRunningBacktest(true);
    try {
      const response = await api.post('/api/backtest/run', {
        symbol: selectedDataset.symbol,
        interval: selectedDataset.interval,
        strategy: backtestForm.strategy,
        initialCapital: backtestForm.initialCapital,
        commission: backtestForm.commission
      });
      
      setBacktestResult(response.data);
      toast.success('Backtest completed successfully');
    } catch (error) {
      console.error('Error running backtest:', error);
      toast.error('Failed to run backtest');
    } finally {
      setRunningBacktest(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const formatFileSize = (size: string) => {
    const bytes = parseInt(size);
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getStrategyCategory = (category: string) => {
    const categories: { [key: string]: string } = {
      'trend': 'Trend Following',
      'mean-reversion': 'Mean Reversion',
      'breakout': 'Breakout',
      'momentum': 'Momentum',
      'volatility': 'Volatility'
    };
    return categories[category] || category;
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Backtest System</h1>
          <p className="text-gray-600">Download historical data and run backtests on your trading strategies</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Data Management Section */}
          <div className="space-y-6">
            {/* Download New Data */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Download Historical Data</h2>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Symbol
                    </label>
                    <input
                      type="text"
                      value={downloadForm.symbol}
                      onChange={(e) => setDownloadForm({...downloadForm, symbol: e.target.value.toUpperCase()})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g., AAPL"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Interval
                    </label>
                    <select
                      value={downloadForm.interval}
                      onChange={(e) => setDownloadForm({...downloadForm, interval: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="1min">1 Minute</option>
                      <option value="5min">5 Minutes</option>
                      <option value="15min">15 Minutes</option>
                      <option value="30min">30 Minutes</option>
                      <option value="1hour">1 Hour</option>
                      <option value="1day">1 Day</option>
                      <option value="1week">1 Week</option>
                      <option value="1month">1 Month</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={downloadForm.startDate}
                      onChange={(e) => setDownloadForm({...downloadForm, startDate: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      End Date
                    </label>
                    <input
                      type="date"
                      value={downloadForm.endDate}
                      onChange={(e) => setDownloadForm({...downloadForm, endDate: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <button
                  onClick={handleDownload}
                  disabled={downloading}
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {downloading ? 'Downloading...' : 'Download Historical Data'}
                </button>
              </div>
            </div>

            {/* Stored Datasets */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Stored Datasets</h2>
              
              {datasets.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No datasets available. Download some data to get started.</p>
              ) : (
                <div className="space-y-3">
                  {datasets.map((dataset, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h3 className="font-semibold text-gray-900">{dataset.symbol}</h3>
                          <p className="text-sm text-gray-600">{dataset.interval} • {dataset.dataPoints} data points</p>
                          <p className="text-sm text-gray-500">
                            {formatDate(dataset.startDate)} - {formatDate(dataset.endDate)}
                          </p>
                        </div>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => setSelectedDataset(dataset)}
                            className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
                          >
                            Select
                          </button>
                          <button
                            onClick={() => handleDeleteDataset(dataset.symbol, dataset.interval)}
                            className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Backtest Section */}
          <div className="space-y-6">
            {/* Strategy Selection */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Backtest Configuration</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Strategy
                  </label>
                  <select
                    value={backtestForm.strategy}
                    onChange={(e) => setBacktestForm({...backtestForm, strategy: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select a strategy</option>
                    {strategies.map(strategy => (
                      <option key={strategy.id} value={strategy.id}>
                        {strategy.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Initial Capital
                    </label>
                    <input
                      type="number"
                      value={backtestForm.initialCapital}
                      onChange={(e) => setBacktestForm({...backtestForm, initialCapital: parseFloat(e.target.value)})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      min="1000"
                      step="1000"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Commission (%)
                    </label>
                    <input
                      type="number"
                      value={backtestForm.commission}
                      onChange={(e) => setBacktestForm({...backtestForm, commission: parseFloat(e.target.value)})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      min="0"
                      max="0.1"
                      step="0.001"
                    />
                  </div>
                </div>

                {selectedDataset && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h3 className="font-semibold text-blue-900 mb-2">Selected Dataset</h3>
                    <p className="text-blue-800">
                      {selectedDataset.symbol} ({selectedDataset.interval}) • {selectedDataset.dataPoints} data points
                    </p>
                    <p className="text-blue-700 text-sm">
                      {formatDate(selectedDataset.startDate)} - {formatDate(selectedDataset.endDate)}
                    </p>
                  </div>
                )}

                <button
                  onClick={handleRunBacktest}
                  disabled={!selectedDataset || !backtestForm.strategy || runningBacktest}
                  className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {runningBacktest ? 'Running Backtest...' : 'Run Backtest'}
                </button>
              </div>
            </div>

            {/* Backtest Results */}
            {backtestResult && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Backtest Results</h2>
                
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="bg-gray-50 p-3 rounded">
                    <p className="text-sm text-gray-600">Total Return</p>
                    <p className={`text-lg font-semibold ${backtestResult.totalReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {(backtestResult.totalReturn * 100).toFixed(2)}%
                    </p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded">
                    <p className="text-sm text-gray-600">Sharpe Ratio</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {backtestResult.sharpeRatio.toFixed(2)}
                    </p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded">
                    <p className="text-sm text-gray-600">Max Drawdown</p>
                    <p className="text-lg font-semibold text-red-600">
                      {(backtestResult.maxDrawdown * 100).toFixed(2)}%
                    </p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded">
                    <p className="text-sm text-gray-600">Win Rate</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {(backtestResult.winRate * 100).toFixed(1)}%
                    </p>
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  <p><span className="font-medium">Strategy:</span> {backtestResult.strategy}</p>
                  <p><span className="font-medium">Total Trades:</span> {backtestResult.totalTrades}</p>
                  <p><span className="font-medium">Profit Factor:</span> {backtestResult.profitFactor.toFixed(2)}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HistoricalData; 