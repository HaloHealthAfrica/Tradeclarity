import { PerformanceTracker } from './PerformanceTracker';
import { DatabaseService } from '../api/DatabaseService';
import { WebSocketService } from '../api/WebSocketService';

// Mock dependencies
jest.mock('../api/DatabaseService');
jest.mock('../api/WebSocketService');

const mockDatabaseService = DatabaseService as jest.MockedClass<typeof DatabaseService>;
const mockWebSocketService = WebSocketService as jest.MockedClass<typeof WebSocketService>;

describe('PerformanceTracker', () => {
  let tracker: PerformanceTracker;
  let mockDb: jest.Mocked<DatabaseService>;
  let mockWebSocket: jest.Mocked<WebSocketService>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockDb = {
      query: jest.fn(),
      getConnection: jest.fn(),
      close: jest.fn(),
    } as any;
    
    mockWebSocket = {
      broadcast: jest.fn(),
      sendToUser: jest.fn(),
    } as any;

    mockDatabaseService.mockImplementation(() => mockDb);
    mockWebSocketService.mockImplementation(() => mockWebSocket);
    
    tracker = new PerformanceTracker();
  });

  describe('trackTrade', () => {
    it('should track a new trade and update performance', async () => {
      const trade = {
        id: 1,
        symbol: 'AAPL',
        side: 'buy',
        quantity: 100,
        entryPrice: 150.0,
        exitPrice: 155.0,
        pnl: 500,
        commission: 5,
        timestamp: '2024-01-15T10:00:00Z',
        strategy: 'EMAConfluence'
      };

      mockDb.query.mockResolvedValue({ rows: [{ id: 1 }] });

      await tracker.trackTrade(trade);

      expect(mockDb.query).toHaveBeenCalled();
      expect(mockWebSocket.broadcast).toHaveBeenCalledWith('performance_update', expect.any(Object));
    });

    it('should handle database errors gracefully', async () => {
      const trade = {
        id: 1,
        symbol: 'AAPL',
        side: 'buy',
        quantity: 100,
        entryPrice: 150.0,
        exitPrice: 155.0,
        pnl: 500,
        commission: 5,
        timestamp: '2024-01-15T10:00:00Z',
        strategy: 'EMAConfluence'
      };

      mockDb.query.mockRejectedValue(new Error('Database error'));

      await expect(tracker.trackTrade(trade)).rejects.toThrow('Database error');
    });
  });

  describe('calculateRealTimeMetrics', () => {
    it('should calculate real-time performance metrics', async () => {
      const mockTrades = [
        { pnl: 500, commission: 5, timestamp: '2024-01-15T10:00:00Z' },
        { pnl: -200, commission: 5, timestamp: '2024-01-15T11:00:00Z' },
        { pnl: 300, commission: 5, timestamp: '2024-01-15T12:00:00Z' },
      ];

      mockDb.query.mockResolvedValue({ rows: mockTrades });

      const metrics = await tracker.calculateRealTimeMetrics();

      expect(metrics).toHaveProperty('totalPnL', 600);
      expect(metrics).toHaveProperty('totalTrades', 3);
      expect(metrics).toHaveProperty('winRate');
      expect(metrics).toHaveProperty('profitFactor');
      expect(metrics).toHaveProperty('averageWin');
      expect(metrics).toHaveProperty('averageLoss');
    });

    it('should handle empty trade data', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const metrics = await tracker.calculateRealTimeMetrics();

      expect(metrics.totalPnL).toBe(0);
      expect(metrics.totalTrades).toBe(0);
      expect(metrics.winRate).toBe(0);
    });
  });

  describe('trackDrawdown', () => {
    it('should track maximum drawdown correctly', async () => {
      const mockTrades = [
        { pnl: 500, cumulativePnL: 500 },
        { pnl: -200, cumulativePnL: 300 },
        { pnl: -300, cumulativePnL: 0 },
        { pnl: 400, cumulativePnL: 400 },
      ];

      mockDb.query.mockResolvedValue({ rows: mockTrades });

      const drawdown = await tracker.trackDrawdown();

      expect(drawdown).toHaveProperty('currentDrawdown');
      expect(drawdown).toHaveProperty('maxDrawdown');
      expect(drawdown).toHaveProperty('drawdownPercentage');
    });
  });

  describe('calculateSharpeRatio', () => {
    it('should calculate Sharpe ratio correctly', async () => {
      const mockReturns = [0.05, -0.02, 0.03, 0.01, -0.01];

      const sharpeRatio = tracker.calculateSharpeRatio(mockReturns);

      expect(sharpeRatio).toBeGreaterThan(0);
      expect(typeof sharpeRatio).toBe('number');
    });

    it('should handle zero returns', async () => {
      const mockReturns = [0, 0, 0, 0, 0];

      const sharpeRatio = tracker.calculateSharpeRatio(mockReturns);

      expect(sharpeRatio).toBe(0);
    });
  });

  describe('trackStrategyPerformance', () => {
    it('should track performance by strategy', async () => {
      const mockStrategyTrades = [
        { strategy: 'EMAConfluence', pnl: 300, trades: 5 },
        { strategy: 'SqueezeStrategy', pnl: -100, trades: 3 },
        { strategy: 'ICTStrategy', pnl: 200, trades: 2 },
      ];

      mockDb.query.mockResolvedValue({ rows: mockStrategyTrades });

      const strategyPerformance = await tracker.trackStrategyPerformance();

      expect(strategyPerformance).toHaveLength(3);
      expect(strategyPerformance[0]).toHaveProperty('strategy');
      expect(strategyPerformance[0]).toHaveProperty('pnl');
      expect(strategyPerformance[0]).toHaveProperty('trades');
    });
  });

  describe('monitorRiskMetrics', () => {
    it('should monitor risk metrics in real-time', async () => {
      const mockTrades = [
        { pnl: 500, entryPrice: 150.0, exitPrice: 155.0 },
        { pnl: -200, entryPrice: 250.0, exitPrice: 246.0 },
        { pnl: 300, entryPrice: 100.0, exitPrice: 103.0 },
      ];

      mockDb.query.mockResolvedValue({ rows: mockTrades });

      const riskMetrics = await tracker.monitorRiskMetrics();

      expect(riskMetrics).toHaveProperty('sharpeRatio');
      expect(riskMetrics).toHaveProperty('sortinoRatio');
      expect(riskMetrics).toHaveProperty('maxDrawdown');
      expect(riskMetrics).toHaveProperty('var95');
      expect(riskMetrics).toHaveProperty('calmarRatio');
    });
  });

  describe('generatePerformanceReport', () => {
    it('should generate a comprehensive performance report', async () => {
      const mockTrades = [
        { pnl: 500, commission: 5, strategy: 'EMAConfluence' },
        { pnl: -200, commission: 5, strategy: 'SqueezeStrategy' },
        { pnl: 300, commission: 5, strategy: 'EMAConfluence' },
      ];

      mockDb.query.mockResolvedValue({ rows: mockTrades });

      const report = await tracker.generatePerformanceReport('2024-01-15');

      expect(report).toHaveProperty('date', '2024-01-15');
      expect(report).toHaveProperty('summary');
      expect(report).toHaveProperty('performance');
      expect(report).toHaveProperty('riskMetrics');
      expect(report).toHaveProperty('strategyBreakdown');
    });
  });

  describe('setAlerts', () => {
    it('should set performance alerts', async () => {
      const alerts = {
        maxDrawdown: 0.1,
        dailyLoss: -500,
        winRate: 0.4,
        sharpeRatio: 0.5
      };

      await tracker.setAlerts(alerts);

      expect(tracker.alerts).toEqual(alerts);
    });
  });

  describe('checkAlerts', () => {
    it('should check and trigger alerts when thresholds are exceeded', async () => {
      tracker.alerts = {
        maxDrawdown: 0.1,
        dailyLoss: -500,
        winRate: 0.4,
        sharpeRatio: 0.5
      };

      const mockMetrics = {
        maxDrawdown: 0.15,
        dailyPnL: -600,
        winRate: 0.35,
        sharpeRatio: 0.3
      };

      jest.spyOn(tracker, 'calculateRealTimeMetrics').mockResolvedValue(mockMetrics);

      const triggeredAlerts = await tracker.checkAlerts();

      expect(triggeredAlerts).toHaveLength(4);
      expect(triggeredAlerts[0]).toHaveProperty('type');
      expect(triggeredAlerts[0]).toHaveProperty('message');
    });
  });

  describe('exportPerformanceData', () => {
    it('should export performance data in JSON format', async () => {
      const mockData = {
        trades: [{ pnl: 500, symbol: 'AAPL' }],
        performance: { totalPnL: 500, winRate: 0.6 },
        riskMetrics: { sharpeRatio: 1.2, maxDrawdown: 200 }
      };

      const exported = tracker.exportPerformanceData(mockData, 'json');

      expect(exported).toContain('"totalPnL":500');
      expect(exported).toContain('"winRate":0.6');
    });

    it('should export performance data in CSV format', async () => {
      const mockData = {
        trades: [{ pnl: 500, symbol: 'AAPL', timestamp: '2024-01-15T10:00:00Z' }],
        performance: { totalPnL: 500, winRate: 0.6 },
        riskMetrics: { sharpeRatio: 1.2, maxDrawdown: 200 }
      };

      const exported = tracker.exportPerformanceData(mockData, 'csv');

      expect(exported).toContain('PnL,Symbol,Timestamp');
      expect(exported).toContain('500,AAPL,2024-01-15T10:00:00Z');
    });
  });

  describe('getHistoricalPerformance', () => {
    it('should retrieve historical performance data', async () => {
      const mockHistory = [
        { date: '2024-01-15', totalPnL: 600, trades: 5 },
        { date: '2024-01-14', totalPnL: 400, trades: 3 },
      ];

      mockDb.query.mockResolvedValue({ rows: mockHistory });

      const history = await tracker.getHistoricalPerformance('2024-01-10', '2024-01-15');

      expect(history).toHaveLength(2);
      expect(history[0]).toHaveProperty('date', '2024-01-15');
      expect(history[0]).toHaveProperty('totalPnL', 600);
    });
  });

  describe('startRealTimeTracking', () => {
    it('should start real-time performance tracking', async () => {
      const mockMetrics = {
        totalPnL: 600,
        totalTrades: 5,
        winRate: 0.6,
        profitFactor: 1.5
      };

      jest.spyOn(tracker, 'calculateRealTimeMetrics').mockResolvedValue(mockMetrics);

      await tracker.startRealTimeTracking();

      expect(tracker.isTracking).toBe(true);
      expect(mockWebSocket.broadcast).toHaveBeenCalledWith('performance_update', mockMetrics);
    });
  });

  describe('stopRealTimeTracking', () => {
    it('should stop real-time performance tracking', async () => {
      tracker.isTracking = true;

      await tracker.stopRealTimeTracking();

      expect(tracker.isTracking).toBe(false);
    });
  });
}); 