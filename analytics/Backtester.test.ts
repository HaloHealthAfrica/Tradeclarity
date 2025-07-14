import { Backtester } from './Backtester';
import { DatabaseService } from '../api/DatabaseService';
import { MarketDataService } from '../api/MarketDataService';
import { StrategyLoader } from '../strategies/StrategyLoader';

// Mock dependencies
jest.mock('../api/DatabaseService');
jest.mock('../api/MarketDataService');
jest.mock('../strategies/StrategyLoader');

const mockDatabaseService = DatabaseService as jest.MockedClass<typeof DatabaseService>;
const mockMarketDataService = MarketDataService as jest.MockedClass<typeof MarketDataService>;
const mockStrategyLoader = StrategyLoader as jest.MockedClass<typeof StrategyLoader>;

describe('Backtester', () => {
  let backtester: Backtester;
  let mockDb: jest.Mocked<DatabaseService>;
  let mockMarketData: jest.Mocked<MarketDataService>;
  let mockStrategy: jest.Mocked<StrategyLoader>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockDb = {
      query: jest.fn(),
      getConnection: jest.fn(),
      close: jest.fn(),
    } as any;
    
    mockMarketData = {
      getHistoricalData: jest.fn(),
      getMarketStatus: jest.fn(),
    } as any;

    mockStrategy = {
      loadStrategy: jest.fn(),
      executeStrategy: jest.fn(),
    } as any;

    mockDatabaseService.mockImplementation(() => mockDb);
    mockMarketDataService.mockImplementation(() => mockMarketData);
    mockStrategyLoader.mockImplementation(() => mockStrategy);
    
    backtester = new Backtester();
  });

  describe('loadHistoricalData', () => {
    it('should load historical data from TwelveData API', async () => {
      const mockData = [
        { timestamp: '2024-01-01T09:30:00Z', open: 150.0, high: 152.0, low: 149.0, close: 151.0, volume: 1000000 },
        { timestamp: '2024-01-02T09:30:00Z', open: 151.0, high: 153.0, low: 150.0, close: 152.0, volume: 1100000 },
      ];

      mockMarketData.getHistoricalData.mockResolvedValue(mockData);

      const data = await backtester.loadHistoricalData('AAPL', '2024-01-01', '2024-01-31');

      expect(data).toHaveLength(2);
      expect(data[0]).toHaveProperty('timestamp');
      expect(data[0]).toHaveProperty('open');
      expect(data[0]).toHaveProperty('close');
    });

    it('should handle API errors and use fallback data', async () => {
      mockMarketData.getHistoricalData.mockRejectedValue(new Error('API Error'));

      const data = await backtester.loadHistoricalData('AAPL', '2024-01-01', '2024-01-31');

      expect(data).toBeDefined();
      expect(data.length).toBeGreaterThan(0);
    });
  });

  describe('simulateTrade', () => {
    it('should simulate a buy trade correctly', async () => {
      const signal = {
        symbol: 'AAPL',
        side: 'buy',
        quantity: 100,
        price: 150.0,
        timestamp: '2024-01-15T10:00:00Z',
        strategy: 'EMAConfluence'
      };

      const trade = await backtester.simulateTrade(signal, 150.0);

      expect(trade).toHaveProperty('symbol', 'AAPL');
      expect(trade).toHaveProperty('side', 'buy');
      expect(trade).toHaveProperty('quantity', 100);
      expect(trade).toHaveProperty('entryPrice', 150.0);
      expect(trade).toHaveProperty('pnl');
    });

    it('should simulate a sell trade correctly', async () => {
      const signal = {
        symbol: 'TSLA',
        side: 'sell',
        quantity: 50,
        price: 250.0,
        timestamp: '2024-01-15T14:00:00Z',
        strategy: 'SqueezeStrategy'
      };

      const trade = await backtester.simulateTrade(signal, 245.0);

      expect(trade).toHaveProperty('symbol', 'TSLA');
      expect(trade).toHaveProperty('side', 'sell');
      expect(trade).toHaveProperty('pnl');
      expect(trade.pnl).toBeGreaterThan(0); // Profit on short
    });
  });

  describe('runBacktest', () => {
    it('should run a complete backtest', async () => {
      const mockHistoricalData = [
        { timestamp: '2024-01-01T09:30:00Z', open: 150.0, high: 152.0, low: 149.0, close: 151.0, volume: 1000000 },
        { timestamp: '2024-01-02T09:30:00Z', open: 151.0, high: 153.0, low: 150.0, close: 152.0, volume: 1100000 },
      ];

      const mockSignals = [
        { symbol: 'AAPL', side: 'buy', quantity: 100, price: 150.0, timestamp: '2024-01-01T10:00:00Z', strategy: 'EMAConfluence' },
        { symbol: 'AAPL', side: 'sell', quantity: 100, price: 152.0, timestamp: '2024-01-02T14:00:00Z', strategy: 'EMAConfluence' },
      ];

      mockMarketData.getHistoricalData.mockResolvedValue(mockHistoricalData);
      mockStrategy.executeStrategy.mockResolvedValue(mockSignals);

      const results = await backtester.runBacktest('EMAConfluence', 'AAPL', '2024-01-01', '2024-01-31');

      expect(results).toHaveProperty('strategy', 'EMAConfluence');
      expect(results).toHaveProperty('symbol', 'AAPL');
      expect(results).toHaveProperty('trades');
      expect(results).toHaveProperty('performance');
      expect(results).toHaveProperty('riskMetrics');
    });

    it('should handle strategy execution errors', async () => {
      mockMarketData.getHistoricalData.mockResolvedValue([]);
      mockStrategy.executeStrategy.mockRejectedValue(new Error('Strategy execution failed'));

      await expect(backtester.runBacktest('InvalidStrategy', 'AAPL', '2024-01-01', '2024-01-31'))
        .rejects.toThrow('Strategy execution failed');
    });
  });

  describe('calculatePerformanceMetrics', () => {
    it('should calculate performance metrics correctly', async () => {
      const mockTrades = [
        { pnl: 500, commission: 5, holdTime: 2 },
        { pnl: -200, commission: 5, holdTime: 1 },
        { pnl: 300, commission: 5, holdTime: 3 },
      ];

      const metrics = backtester.calculatePerformanceMetrics(mockTrades);

      expect(metrics).toHaveProperty('totalPnL', 600);
      expect(metrics).toHaveProperty('totalTrades', 3);
      expect(metrics).toHaveProperty('winRate');
      expect(metrics).toHaveProperty('profitFactor');
      expect(metrics).toHaveProperty('averageWin');
      expect(metrics).toHaveProperty('averageLoss');
      expect(metrics).toHaveProperty('maxDrawdown');
    });

    it('should handle empty trade list', async () => {
      const metrics = backtester.calculatePerformanceMetrics([]);

      expect(metrics.totalPnL).toBe(0);
      expect(metrics.totalTrades).toBe(0);
      expect(metrics.winRate).toBe(0);
    });
  });

  describe('calculateRiskMetrics', () => {
    it('should calculate risk metrics correctly', async () => {
      const mockTrades = [
        { pnl: 500, entryPrice: 150.0, exitPrice: 155.0 },
        { pnl: -200, entryPrice: 250.0, exitPrice: 246.0 },
        { pnl: 300, entryPrice: 100.0, exitPrice: 103.0 },
      ];

      const riskMetrics = backtester.calculateRiskMetrics(mockTrades);

      expect(riskMetrics).toHaveProperty('sharpeRatio');
      expect(riskMetrics).toHaveProperty('sortinoRatio');
      expect(riskMetrics).toHaveProperty('maxDrawdown');
      expect(riskMetrics).toHaveProperty('var95');
      expect(riskMetrics).toHaveProperty('calmarRatio');
    });
  });

  describe('compareStrategies', () => {
    it('should compare multiple strategies', async () => {
      const mockResults1 = {
        strategy: 'EMAConfluence',
        performance: { totalPnL: 600, winRate: 0.6 },
        riskMetrics: { sharpeRatio: 1.2, maxDrawdown: 200 }
      };

      const mockResults2 = {
        strategy: 'SqueezeStrategy',
        performance: { totalPnL: 400, winRate: 0.5 },
        riskMetrics: { sharpeRatio: 0.8, maxDrawdown: 300 }
      };

      jest.spyOn(backtester, 'runBacktest')
        .mockResolvedValueOnce(mockResults1)
        .mockResolvedValueOnce(mockResults2);

      const comparison = await backtester.compareStrategies(['EMAConfluence', 'SqueezeStrategy'], 'AAPL', '2024-01-01', '2024-01-31');

      expect(comparison).toHaveLength(2);
      expect(comparison[0].strategy).toBe('EMAConfluence');
      expect(comparison[1].strategy).toBe('SqueezeStrategy');
    });
  });

  describe('optimizeParameters', () => {
    it('should optimize strategy parameters using grid search', async () => {
      const mockResults = [
        { params: { period: 10 }, performance: { totalPnL: 500 } },
        { params: { period: 20 }, performance: { totalPnL: 600 } },
        { params: { period: 30 }, performance: { totalPnL: 400 } },
      ];

      jest.spyOn(backtester, 'runBacktest').mockResolvedValue(mockResults[1]);

      const optimization = await backtester.optimizeParameters('EMAConfluence', 'AAPL', '2024-01-01', '2024-01-31', {
        period: [10, 20, 30]
      }, 'grid');

      expect(optimization).toHaveProperty('bestParams');
      expect(optimization).toHaveProperty('bestPerformance');
      expect(optimization).toHaveProperty('allResults');
    });

    it('should optimize using genetic algorithm', async () => {
      const mockResults = [
        { params: { period: 15 }, performance: { totalPnL: 550 } },
        { params: { period: 25 }, performance: { totalPnL: 650 } },
      ];

      jest.spyOn(backtester, 'runBacktest').mockResolvedValue(mockResults[1]);

      const optimization = await backtester.optimizeParameters('EMAConfluence', 'AAPL', '2024-01-01', '2024-01-31', {
        period: [10, 30]
      }, 'genetic');

      expect(optimization).toHaveProperty('bestParams');
      expect(optimization).toHaveProperty('bestPerformance');
      expect(optimization).toHaveProperty('generations');
    });
  });

  describe('saveBacktestResults', () => {
    it('should save backtest results to database', async () => {
      const mockResults = {
        strategy: 'EMAConfluence',
        symbol: 'AAPL',
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        performance: { totalPnL: 600, winRate: 0.6 },
        riskMetrics: { sharpeRatio: 1.2, maxDrawdown: 200 },
        trades: []
      };

      mockDb.query.mockResolvedValue({ rows: [{ id: 1 }] });

      const saved = await backtester.saveBacktestResults(mockResults);

      expect(saved).toBe(true);
      expect(mockDb.query).toHaveBeenCalled();
    });
  });

  describe('loadBacktestResults', () => {
    it('should load backtest results from database', async () => {
      const mockResults = [
        {
          id: 1,
          strategy: 'EMAConfluence',
          symbol: 'AAPL',
          start_date: '2024-01-01',
          end_date: '2024-01-31',
          performance: { totalPnL: 600, winRate: 0.6 },
          risk_metrics: { sharpeRatio: 1.2, maxDrawdown: 200 }
        }
      ];

      mockDb.query.mockResolvedValue({ rows: mockResults });

      const results = await backtester.loadBacktestResults('EMAConfluence');

      expect(results).toHaveLength(1);
      expect(results[0]).toHaveProperty('strategy', 'EMAConfluence');
    });
  });
}); 