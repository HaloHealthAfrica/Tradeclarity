import React, { useState, useEffect } from 'react';
import { 
  TrendingUpIcon, 
  TrendingDownIcon, 
  CurrencyDollarIcon,
  ChartBarIcon,
  ClockIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import { useRealTimeData } from '../hooks/useRealTimeData';
import { useToast } from '../components/common/Toast';
import { LoadingSpinner, LoadingOverlay } from '../components/common/LoadingSpinner';
import { PriceChart } from '../components/charts/PriceChart';
import { PerformanceChart } from '../components/charts/PerformanceChart';

// Components
import MetricCard from '../components/dashboard/MetricCard';
import StrategyCard from '../components/dashboard/StrategyCard';
import SignalCard from '../components/dashboard/SignalCard';
import ChartCard from '../components/dashboard/ChartCard';
import WatchlistCard from '../components/dashboard/WatchlistCard';

// Types
interface Metric {
  title: string;
  value: string;
  change: number;
  changeType: 'positive' | 'negative' | 'neutral';
  icon: React.ComponentType<any>;
}

interface Strategy {
  id: string;
  name: string;
  status: 'active' | 'paused' | 'error';
  performance: number;
  trades: number;
  winRate: number;
  lastTrade: string;
}

interface Signal {
  id: string;
  symbol: string;
  direction: 'BUY' | 'SELL';
  pattern: string;
  confidence: number;
  price: number;
  timestamp: string;
}

const Dashboard: React.FC = () => {
  const toast = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Real-time data for major indices
  const { data: marketData, isConnected, error: dataError } = useRealTimeData({
    symbols: ['SPY', 'QQQ', 'IWM', 'DIA'],
    interval: 10000, // 10 seconds
    useWebSocket: false,
  });

  const [metrics, setMetrics] = useState<Metric[]>([
    {
      title: 'Total P&L',
      value: '$12,450.75',
      change: 8.5,
      changeType: 'positive',
      icon: CurrencyDollarIcon
    },
    {
      title: 'Win Rate',
      value: '68.5%',
      change: 2.3,
      changeType: 'positive',
      icon: TrendingUpIcon
    },
    {
      title: 'Active Trades',
      value: '24',
      change: -3,
      changeType: 'negative',
      icon: ChartBarIcon
    },
    {
      title: 'Daily Return',
      value: '+$1,245.30',
      change: 12.8,
      changeType: 'positive',
      icon: TrendingUpIcon
    }
  ]);

  const [strategies, setStrategies] = useState<Strategy[]>([
    {
      id: '1',
      name: 'EMA Confluence',
      status: 'active',
      performance: 15.2,
      trades: 45,
      winRate: 72.3,
      lastTrade: '2 min ago'
    },
    {
      id: '2',
      name: 'Squeeze Strategy',
      status: 'active',
      performance: 8.7,
      trades: 32,
      winRate: 65.8,
      lastTrade: '5 min ago'
    },
    {
      id: '3',
      name: 'ABCD Fibonacci',
      status: 'paused',
      performance: -2.1,
      trades: 18,
      winRate: 55.6,
      lastTrade: '1 hour ago'
    },
    {
      id: '4',
      name: 'Scanner Signals',
      status: 'active',
      performance: 22.4,
      trades: 67,
      winRate: 78.9,
      lastTrade: '30 sec ago'
    }
  ]);

  const [signals, setSignals] = useState<Signal[]>([
    {
      id: '1',
      symbol: 'SPY',
      direction: 'BUY',
      pattern: 'Inside Bar Breakout',
      confidence: 85,
      price: 150.25,
      timestamp: '2 min ago'
    },
    {
      id: '2',
      symbol: 'QQQ',
      direction: 'SELL',
      pattern: 'Gap Down',
      confidence: 78,
      price: 125.80,
      timestamp: '5 min ago'
    },
    {
      id: '3',
      symbol: 'TSLA',
      direction: 'BUY',
      pattern: 'Outside Bar',
      confidence: 92,
      price: 245.60,
      timestamp: '8 min ago'
    }
  ]);

  // Sample performance data for charts
  const performanceData = [
    { date: '2024-01-01', equity: 10000, drawdown: 0, trades: 0 },
    { date: '2024-01-02', equity: 10250, drawdown: 0, trades: 5 },
    { date: '2024-01-03', equity: 10100, drawdown: 1.46, trades: 8 },
    { date: '2024-01-04', equity: 10500, drawdown: 0, trades: 12 },
    { date: '2024-01-05', equity: 10800, drawdown: 0, trades: 15 },
    { date: '2024-01-06', equity: 10650, drawdown: 1.39, trades: 18 },
    { date: '2024-01-07', equity: 11200, drawdown: 0, trades: 22 },
  ];

  // Sample price data for SPY
  const spyPriceData = [
    { time: 1704067200, open: 150.25, high: 151.50, low: 149.80, close: 151.20, volume: 45000000 },
    { time: 1704153600, open: 151.20, high: 152.30, low: 150.90, close: 152.10, volume: 48000000 },
    { time: 1704240000, open: 152.10, high: 153.40, low: 151.60, close: 153.20, volume: 52000000 },
    { time: 1704326400, open: 153.20, high: 154.10, low: 152.80, close: 153.90, volume: 46000000 },
    { time: 1704412800, open: 153.90, high: 155.20, low: 153.50, close: 155.00, volume: 51000000 },
  ];

  useEffect(() => {
    // Simulate loading
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (dataError) {
      setError(dataError);
      toast.error('Failed to load market data');
    } else {
      setError(null);
    }
  }, [dataError, toast]);

  useEffect(() => {
    if (!isConnected) {
      toast.warning('Market data connection lost');
    }
  }, [isConnected, toast]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner size="xl" text="Loading Dashboard..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <ExclamationTriangleIcon className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Dashboard Error
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
          >
            Reload Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      {/* Header */}
      <div className="dashboard-header">
        <div className="header-content">
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Real-time trading overview and performance metrics</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-outline">
            <ClockIcon className="w-4 h-4 mr-2" />
            Last Updated: {isConnected ? 'Live' : 'Offline'}
          </button>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="metrics-grid">
        {metrics.map((metric, index) => (
          <MetricCard key={index} metric={metric} />
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="dashboard-grid">
        {/* Left Column */}
        <div className="dashboard-left">
          {/* Strategy Performance */}
          <div className="card">
            <div className="card-header">
              <div>
                <h3 className="card-title">Active Strategies</h3>
                <p className="card-subtitle">Real-time strategy performance</p>
              </div>
              <div className="card-actions">
                <button className="btn btn-sm btn-outline">View All</button>
              </div>
            </div>
            <div className="strategies-list">
              {strategies.map((strategy) => (
                <StrategyCard key={strategy.id} strategy={strategy} />
              ))}
            </div>
          </div>

          {/* Recent Signals */}
          <div className="card">
            <div className="card-header">
              <div>
                <h3 className="card-title">Recent Signals</h3>
                <p className="card-subtitle">Latest trading opportunities</p>
              </div>
              <div className="card-actions">
                <button className="btn btn-sm btn-outline">View All</button>
              </div>
            </div>
            <div className="signals-list">
              {signals.map((signal) => (
                <SignalCard key={signal.id} signal={signal} />
              ))}
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="dashboard-right">
          {/* Performance Chart */}
          <div className="card">
            <div className="card-header">
              <div>
                <h3 className="card-title">Portfolio Performance</h3>
                <p className="card-subtitle">Equity curve and drawdown</p>
              </div>
            </div>
            <div className="card-content">
              <PerformanceChart
                data={performanceData}
                type="equity"
                height={300}
                theme="dark"
              />
            </div>
          </div>

          {/* Market Overview */}
          <div className="card">
            <div className="card-header">
              <div>
                <h3 className="card-title">Market Overview</h3>
                <p className="card-subtitle">Major indices performance</p>
              </div>
            </div>
            <div className="card-content">
              <div className="space-y-4">
                {marketData.map((item) => (
                  <div key={item.symbol} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div>
                      <div className="font-semibold text-gray-900 dark:text-white">
                        {item.symbol}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        ${item.price.toFixed(2)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`font-semibold ${
                        item.changePercent >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {item.changePercent >= 0 ? '+' : ''}{item.changePercent.toFixed(2)}%
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {item.change >= 0 ? '+' : ''}{item.change.toFixed(2)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Real-time Chart */}
          <div className="card">
            <div className="card-header">
              <div>
                <h3 className="card-title">SPY Price Chart</h3>
                <p className="card-subtitle">Real-time price action</p>
              </div>
            </div>
            <div className="card-content">
              <PriceChart
                symbol="SPY"
                data={spyPriceData}
                height={250}
                theme="dark"
                showVolume={true}
                realTime={false}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard; 