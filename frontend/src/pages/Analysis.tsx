import React, { useState, useEffect } from 'react';
import { analysisService, BacktestConfig, OptimizationConfig } from '../services/analysisService';
import { MetricCard } from '../components/MetricCard';
import { LineChart, BarChart, PieChart } from '../components/Charts';

interface AnalysisState {
  activeTab: 'backtest' | 'optimization' | 'market-data' | 'reports';
  loading: boolean;
  error: string | null;
  backtestResults: any[] | null;
  optimizationResults: any | null;
  marketDataStats: any | null;
  reports: any[] | null;
}

const Analysis: React.FC = () => {
  const [state, setState] = useState<AnalysisState>({
    activeTab: 'backtest',
    loading: false,
    error: null,
    backtestResults: null,
    optimizationResults: null,
    marketDataStats: null,
    reports: null
  });

  const [backtestConfig, setBacktestConfig] = useState<BacktestConfig>({
    strategy: 'EMAStrategy',
    symbols: ['AAPL', 'GOOGL'],
    startDate: '2023-01-01',
    endDate: '2023-12-31',
    initialCapital: 100000,
    commission: 0.1,
    slippage: 0.05,
    positionSize: 1000,
    riskManagement: {
      maxPositionSize: 5000,
      maxDailyLoss: 1000,
      stopLoss: 2,
      takeProfit: 4
    }
  });

  const [optimizationConfig, setOptimizationConfig] = useState<OptimizationConfig>({
    strategy: 'EMAStrategy',
    symbols: ['AAPL', 'GOOGL'],
    startDate: '2023-01-01',
    endDate: '2023-12-31',
    initialCapital: 100000,
    parameters: {
      emaShort: [5, 10, 15, 20],
      emaLong: [20, 30, 40, 50],
      stopLoss: [1, 2, 3, 4],
      takeProfit: [2, 4, 6, 8]
    },
    optimizationMethod: 'genetic',
    fitnessMetric: 'sharpe',
    maxIterations: 100,
    populationSize: 50,
    mutationRate: 0.1,
    crossoverRate: 0.8
  });

  const handleRunBacktest = async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const result = await analysisService.runBacktest(backtestConfig);
      setState(prev => ({ 
        ...prev, 
        backtestResults: [result],
        loading: false 
      }));
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        error: 'Failed to run backtest',
        loading: false 
      }));
    }
  };

  const handleRunOptimization = async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const result = await analysisService.runOptimization(optimizationConfig);
      setState(prev => ({ 
        ...prev, 
        optimizationResults: result,
        loading: false 
      }));
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        error: 'Failed to run optimization',
        loading: false 
      }));
    }
  };

  const handleCompareStrategies = async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const strategies = ['EMAStrategy', 'RSIStrategy', 'MACDStrategy'];
      const results = await analysisService.compareStrategies(strategies, {
        symbols: backtestConfig.symbols,
        startDate: backtestConfig.startDate,
        endDate: backtestConfig.endDate,
        initialCapital: backtestConfig.initialCapital,
        commission: backtestConfig.commission,
        slippage: backtestConfig.slippage,
        positionSize: backtestConfig.positionSize,
        riskManagement: backtestConfig.riskManagement
      });
      setState(prev => ({ 
        ...prev, 
        backtestResults: results,
        loading: false 
      }));
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        error: 'Failed to compare strategies',
        loading: false 
      }));
    }
  };

  const loadMarketDataStats = async () => {
    try {
      const stats = await analysisService.getMarketDataStats('AAPL');
      setState(prev => ({ ...prev, marketDataStats: stats }));
    } catch (error) {
      console.error('Error loading market data stats:', error);
    }
  };

  const loadReports = async () => {
    try {
      const summary = await analysisService.getPerformanceSummary(
        '2023-01-01',
        '2023-12-31',
        ['AAPL', 'GOOGL']
      );
      setState(prev => ({ ...prev, reports: [summary] }));
    } catch (error) {
      console.error('Error loading reports:', error);
    }
  };

  useEffect(() => {
    if (state.activeTab === 'market-data') {
      loadMarketDataStats();
    }
    if (state.activeTab === 'reports') {
      loadReports();
    }
  }, [state.activeTab]);

  const renderBacktestTab = () => (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
        <h3 className="text-lg font-semibold mb-4">Backtest Configuration</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Strategy</label>
            <select
              value={backtestConfig.strategy}
              onChange={(e) => setBacktestConfig(prev => ({ ...prev, strategy: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="EMAStrategy">EMA Strategy</option>
              <option value="RSIStrategy">RSI Strategy</option>
              <option value="MACDStrategy">MACD Strategy</option>
              <option value="FVGStrategy">FVG Strategy</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Symbols</label>
            <input
              type="text"
              value={backtestConfig.symbols.join(', ')}
              onChange={(e) => setBacktestConfig(prev => ({ ...prev, symbols: e.target.value.split(',').map(s => s.trim()) }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="AAPL, GOOGL, MSFT"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Start Date</label>
            <input
              type="date"
              value={backtestConfig.startDate}
              onChange={(e) => setBacktestConfig(prev => ({ ...prev, startDate: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">End Date</label>
            <input
              type="date"
              value={backtestConfig.endDate}
              onChange={(e) => setBacktestConfig(prev => ({ ...prev, endDate: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Initial Capital</label>
            <input
              type="number"
              value={backtestConfig.initialCapital}
              onChange={(e) => setBacktestConfig(prev => ({ ...prev, initialCapital: Number(e.target.value) }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Position Size</label>
            <input
              type="number"
              value={backtestConfig.positionSize}
              onChange={(e) => setBacktestConfig(prev => ({ ...prev, positionSize: Number(e.target.value) }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <div className="mt-6 flex space-x-4">
          <button
            onClick={handleRunBacktest}
            disabled={state.loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {state.loading ? 'Running...' : 'Run Backtest'}
          </button>
          <button
            onClick={handleCompareStrategies}
            disabled={state.loading}
            className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
          >
            Compare Strategies
          </button>
        </div>
      </div>

      {state.backtestResults && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
          <h3 className="text-lg font-semibold mb-4">Backtest Results</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {state.backtestResults.map((result, index) => (
              <div key={index} className="space-y-4">
                <MetricCard
                  title="Total Return"
                  value={`$${result.totalReturn?.toFixed(2) || 'N/A'}`}
                  change={result.totalReturn > 0 ? 'positive' : 'negative'}
                />
                <MetricCard
                  title="Sharpe Ratio"
                  value={result.sharpeRatio?.toFixed(2) || 'N/A'}
                  change={result.sharpeRatio > 1 ? 'positive' : 'negative'}
                />
                <MetricCard
                  title="Win Rate"
                  value={`${result.winRate?.toFixed(1) || 'N/A'}%`}
                  change={result.winRate > 50 ? 'positive' : 'negative'}
                />
                <MetricCard
                  title="Max Drawdown"
                  value={`${(result.maxDrawdown * 100)?.toFixed(1) || 'N/A'}%`}
                  change="negative"
                />
              </div>
            ))}
          </div>
          {state.backtestResults[0]?.equityCurve && (
            <div className="h-64">
              <LineChart
                data={state.backtestResults[0].equityCurve}
                xKey="date"
                yKey="equity"
                title="Equity Curve"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderOptimizationTab = () => (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
        <h3 className="text-lg font-semibold mb-4">Optimization Configuration</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Strategy</label>
            <select
              value={optimizationConfig.strategy}
              onChange={(e) => setOptimizationConfig(prev => ({ ...prev, strategy: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="EMAStrategy">EMA Strategy</option>
              <option value="RSIStrategy">RSI Strategy</option>
              <option value="MACDStrategy">MACD Strategy</option>
              <option value="FVGStrategy">FVG Strategy</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Optimization Method</label>
            <select
              value={optimizationConfig.optimizationMethod}
              onChange={(e) => setOptimizationConfig(prev => ({ ...prev, optimizationMethod: e.target.value as any }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="grid">Grid Search</option>
              <option value="genetic">Genetic Algorithm</option>
              <option value="bayesian">Bayesian Optimization</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Fitness Metric</label>
            <select
              value={optimizationConfig.fitnessMetric}
              onChange={(e) => setOptimizationConfig(prev => ({ ...prev, fitnessMetric: e.target.value as any }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="sharpe">Sharpe Ratio</option>
              <option value="returns">Total Returns</option>
              <option value="calmar">Calmar Ratio</option>
              <option value="custom">Custom</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Max Iterations</label>
            <input
              type="number"
              value={optimizationConfig.maxIterations}
              onChange={(e) => setOptimizationConfig(prev => ({ ...prev, maxIterations: Number(e.target.value) }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Population Size</label>
            <input
              type="number"
              value={optimizationConfig.populationSize || 50}
              onChange={(e) => setOptimizationConfig(prev => ({ ...prev, populationSize: Number(e.target.value) }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Mutation Rate</label>
            <input
              type="number"
              step="0.1"
              value={optimizationConfig.mutationRate || 0.1}
              onChange={(e) => setOptimizationConfig(prev => ({ ...prev, mutationRate: Number(e.target.value) }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <div className="mt-6">
          <button
            onClick={handleRunOptimization}
            disabled={state.loading}
            className="px-6 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50"
          >
            {state.loading ? 'Optimizing...' : 'Run Optimization'}
          </button>
        </div>
      </div>

      {state.optimizationResults && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
          <h3 className="text-lg font-semibold mb-4">Optimization Results</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <MetricCard
              title="Best Fitness"
              value={state.optimizationResults.statistics.bestFitness?.toFixed(3) || 'N/A'}
              change="positive"
            />
            <MetricCard
              title="Best Return"
              value={`$${state.optimizationResults.bestResult.totalReturn?.toFixed(2) || 'N/A'}`}
              change={state.optimizationResults.bestResult.totalReturn > 0 ? 'positive' : 'negative'}
            />
            <MetricCard
              title="Best Sharpe"
              value={state.optimizationResults.bestResult.sharpeRatio?.toFixed(2) || 'N/A'}
              change={state.optimizationResults.bestResult.sharpeRatio > 1 ? 'positive' : 'negative'}
            />
            <MetricCard
              title="Iterations"
              value={state.optimizationResults.statistics.totalIterations?.toString() || 'N/A'}
            />
          </div>
          <div className="mb-4">
            <h4 className="font-medium mb-2">Best Parameters:</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {Object.entries(state.optimizationResults.bestParameters).map(([key, value]) => (
                <div key={key} className="text-sm">
                  <span className="font-medium">{key}:</span> {value}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderMarketDataTab = () => (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
        <h3 className="text-lg font-semibold mb-4">Market Data Management</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Symbol</label>
            <input
              type="text"
              defaultValue="AAPL"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Start Date</label>
            <input
              type="date"
              defaultValue="2023-01-01"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">End Date</label>
            <input
              type="date"
              defaultValue="2023-12-31"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <div className="mt-6 flex space-x-4">
          <button className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
            Store Data
          </button>
          <button className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700">
            Retrieve Data
          </button>
          <button className="px-6 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700">
            Export Data
          </button>
        </div>
      </div>

      {state.marketDataStats && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
          <h3 className="text-lg font-semibold mb-4">Data Statistics</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              title="Total Records"
              value={state.marketDataStats.totalRecords?.toString() || 'N/A'}
            />
            <MetricCard
              title="Data Completeness"
              value={`${state.marketDataStats.dataQuality?.completeness?.toFixed(1) || 'N/A'}%`}
              change={state.marketDataStats.dataQuality?.completeness > 90 ? 'positive' : 'negative'}
            />
            <MetricCard
              title="Data Accuracy"
              value={`${state.marketDataStats.dataQuality?.accuracy?.toFixed(1) || 'N/A'}%`}
              change={state.marketDataStats.dataQuality?.accuracy > 95 ? 'positive' : 'negative'}
            />
            <MetricCard
              title="Data Gaps"
              value={state.marketDataStats.dataQuality?.gaps?.toString() || 'N/A'}
              change="negative"
            />
          </div>
        </div>
      )}
    </div>
  );

  const renderReportsTab = () => (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
        <h3 className="text-lg font-semibold mb-4">Analysis Reports</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Report Type</label>
            <select className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="daily">Daily Analysis</option>
              <option value="weekly">Weekly Summary</option>
              <option value="monthly">Monthly Report</option>
              <option value="performance">Performance Analysis</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Start Date</label>
            <input
              type="date"
              defaultValue="2023-01-01"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">End Date</label>
            <input
              type="date"
              defaultValue="2023-12-31"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <div className="mt-6 flex space-x-4">
          <button className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
            Generate Report
          </button>
          <button className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700">
            Export PDF
          </button>
          <button className="px-6 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700">
            Export CSV
          </button>
        </div>
      </div>

      {state.reports && state.reports.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
          <h3 className="text-lg font-semibold mb-4">Latest Reports</h3>
          <div className="space-y-4">
            {state.reports.map((report, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4">
                <h4 className="font-medium mb-2">Performance Summary</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <span className="text-sm text-gray-600">Total Return</span>
                    <p className="font-semibold">${report.totalReturn?.toFixed(2) || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-600">Win Rate</span>
                    <p className="font-semibold">{report.winRate?.toFixed(1) || 'N/A'}%</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-600">Sharpe Ratio</span>
                    <p className="font-semibold">{report.sharpeRatio?.toFixed(2) || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-600">Max Drawdown</span>
                    <p className="font-semibold">{(report.maxDrawdown * 100)?.toFixed(1) || 'N/A'}%</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Analysis Center</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Backtest strategies, optimize parameters, and analyze market data
          </p>
        </div>

        {state.error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <div className="mt-2 text-sm text-red-700">{state.error}</div>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm">
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="-mb-px flex space-x-8 px-6">
              {[
                { id: 'backtest', name: 'Backtesting' },
                { id: 'optimization', name: 'Optimization' },
                { id: 'market-data', name: 'Market Data' },
                { id: 'reports', name: 'Reports' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setState(prev => ({ ...prev, activeTab: tab.id as any }))}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    state.activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab.name}
                </button>
              ))}
            </nav>
          </div>

          <div className="p-6">
            {state.activeTab === 'backtest' && renderBacktestTab()}
            {state.activeTab === 'optimization' && renderOptimizationTab()}
            {state.activeTab === 'market-data' && renderMarketDataTab()}
            {state.activeTab === 'reports' && renderReportsTab()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analysis; 