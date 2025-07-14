import { EndOfDayAnalyzer } from './EndOfDayAnalyzer';
import { DatabaseService } from '../api/DatabaseService';
import { MarketDataService } from '../api/MarketDataService';

// Mock dependencies
jest.mock('../api/DatabaseService');
jest.mock('../api/MarketDataService');

const mockDatabaseService = DatabaseService as jest.MockedClass<typeof DatabaseService>;
const mockMarketDataService = MarketDataService as jest.MockedClass<typeof MarketDataService>;

describe('EndOfDayAnalyzer', () => {
  let analyzer: EndOfDayAnalyzer;
  let mockDb: jest.Mocked<DatabaseService>;
  let mockMarketData: jest.Mocked<MarketDataService>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockDb = {
      query: jest.fn(),
      getConnection: jest.fn(),
      close: jest.fn(),
    } as any;
    
    mockMarketData = {
      getMarketStatus: jest.fn(),
      getHistoricalData: jest.fn(),
    } as any;

    mockDatabaseService.mockImplementation(() => mockDb);
    mockMarketDataService.mockImplementation(() => mockMarketData);
    
    analyzer = new EndOfDayAnalyzer();
  });

  describe('generateDailyReport', () => {
    it('should generate a complete daily report', async () => {
      const mockTrades = [
        { id: 1, symbol: 'AAPL', side: 'buy', quantity: 100, price: 150.0, timestamp: '2024-01-15T10:00:00Z', pnl: 500 },
        { id: 2, symbol: 'TSLA', side: 'sell', quantity: 50, price: 250.0, timestamp: '2024-01-15T14:00:00Z', pnl: -200 },
      ];

      const mockSignals = [
        { id: 1, symbol: 'AAPL', pattern: 'bullish_breakout', confidence: 0.85, timestamp: '2024-01-15T09:30:00Z' },
        { id: 2, symbol: 'TSLA', pattern: 'bearish_reversal', confidence: 0.72, timestamp: '2024-01-15T13:45:00Z' },
      ];

      mockDb.query.mockResolvedValueOnce({ rows: mockTrades });
      mockDb.query.mockResolvedValueOnce({ rows: mockSignals });
      mockMarketData.getMarketStatus.mockResolvedValue({ isOpen: false, session: 'closed' });

      const report = await analyzer.generateDailyReport('2024-01-15');

      expect(report).toHaveProperty('date', '2024-01-15');
      expect(report).toHaveProperty('summary');
      expect(report).toHaveProperty('performance');
      expect(report).toHaveProperty('signals');
      expect(report).toHaveProperty('risk');
      expect(report).toHaveProperty('outlook');
    });

    it('should handle database errors gracefully', async () => {
      mockDb.query.mockRejectedValue(new Error('Database connection failed'));

      await expect(analyzer.generateDailyReport('2024-01-15')).rejects.toThrow('Database connection failed');
    });
  });

  describe('calculateDailyPerformance', () => {
    it('should calculate performance metrics correctly', async () => {
      const mockTrades = [
        { pnl: 500, commission: 5 },
        { pnl: -200, commission: 5 },
        { pnl: 300, commission: 5 },
      ];

      mockDb.query.mockResolvedValue({ rows: mockTrades });

      const performance = await analyzer.calculateDailyPerformance('2024-01-15');

      expect(performance).toHaveProperty('totalPnL', 600);
      expect(performance).toHaveProperty('totalTrades', 3);
      expect(performance).toHaveProperty('winRate');
      expect(performance).toHaveProperty('averageWin');
      expect(performance).toHaveProperty('averageLoss');
    });

    it('should handle empty trade data', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const performance = await analyzer.calculateDailyPerformance('2024-01-15');

      expect(performance.totalPnL).toBe(0);
      expect(performance.totalTrades).toBe(0);
      expect(performance.winRate).toBe(0);
    });
  });

  describe('analyzeMarketConditions', () => {
    it('should analyze market conditions with real data', async () => {
      const mockMarketData = {
        volume: 1000000,
        volatility: 0.25,
        trend: 'bullish',
        sector_performance: { tech: 0.05, finance: -0.02 }
      };

      mockDb.query.mockResolvedValue({ rows: [mockMarketData] });

      const analysis = await analyzer.analyzeMarketConditions('2024-01-15');

      expect(analysis).toHaveProperty('volume');
      expect(analysis).toHaveProperty('volatility');
      expect(analysis).toHaveProperty('trend');
      expect(analysis).toHaveProperty('sectorPerformance');
    });
  });

  describe('evaluateStrategyPerformance', () => {
    it('should evaluate strategy performance correctly', async () => {
      const mockStrategyTrades = [
        { strategy: 'EMAConfluence', pnl: 300, trades: 5 },
        { strategy: 'SqueezeStrategy', pnl: -100, trades: 3 },
      ];

      mockDb.query.mockResolvedValue({ rows: mockStrategyTrades });

      const strategyPerformance = await analyzer.evaluateStrategyPerformance('2024-01-15');

      expect(strategyPerformance).toHaveLength(2);
      expect(strategyPerformance[0]).toHaveProperty('strategy', 'EMAConfluence');
      expect(strategyPerformance[0]).toHaveProperty('pnl', 300);
    });
  });

  describe('assessRiskMetrics', () => {
    it('should calculate risk metrics correctly', async () => {
      const mockTrades = [
        { pnl: 500, maxDrawdown: 100 },
        { pnl: -200, maxDrawdown: 300 },
        { pnl: 300, maxDrawdown: 50 },
      ];

      mockDb.query.mockResolvedValue({ rows: mockTrades });

      const riskMetrics = await analyzer.assessRiskMetrics('2024-01-15');

      expect(riskMetrics).toHaveProperty('maxDrawdown');
      expect(riskMetrics).toHaveProperty('sharpeRatio');
      expect(riskMetrics).toHaveProperty('var95');
      expect(riskMetrics).toHaveProperty('riskRewardRatio');
    });
  });

  describe('generateNextDayOutlook', () => {
    it('should generate next day outlook based on current data', async () => {
      const mockSignals = [
        { pattern: 'bullish_breakout', confidence: 0.85 },
        { pattern: 'bearish_reversal', confidence: 0.72 },
      ];

      mockDb.query.mockResolvedValue({ rows: mockSignals });
      mockMarketData.getMarketStatus.mockResolvedValue({ isOpen: false, session: 'closed' });

      const outlook = await analyzer.generateNextDayOutlook('2024-01-15');

      expect(outlook).toHaveProperty('sentiment');
      expect(outlook).toHaveProperty('keyLevels');
      expect(outlook).toHaveProperty('watchlist');
      expect(outlook).toHaveProperty('riskLevel');
    });
  });

  describe('exportReport', () => {
    it('should export report in JSON format', async () => {
      const mockReport = {
        date: '2024-01-15',
        summary: { totalPnL: 600, totalTrades: 5 },
        performance: { winRate: 0.6, averageWin: 400 },
        signals: [{ symbol: 'AAPL', pattern: 'bullish_breakout' }],
        risk: { maxDrawdown: 200, sharpeRatio: 1.2 },
        outlook: { sentiment: 'bullish', riskLevel: 'medium' }
      };

      const exported = analyzer.exportReport(mockReport, 'json');

      expect(exported).toContain('"date":"2024-01-15"');
      expect(exported).toContain('"totalPnL":600');
    });

    it('should export report in CSV format', async () => {
      const mockReport = {
        date: '2024-01-15',
        summary: { totalPnL: 600, totalTrades: 5 },
        performance: { winRate: 0.6, averageWin: 400 },
        signals: [{ symbol: 'AAPL', pattern: 'bullish_breakout' }],
        risk: { maxDrawdown: 200, sharpeRatio: 1.2 },
        outlook: { sentiment: 'bullish', riskLevel: 'medium' }
      };

      const exported = analyzer.exportReport(mockReport, 'csv');

      expect(exported).toContain('Date,TotalPnL,TotalTrades');
      expect(exported).toContain('2024-01-15,600,5');
    });
  });

  describe('getHistoricalReports', () => {
    it('should retrieve historical reports', async () => {
      const mockReports = [
        { date: '2024-01-15', summary: { totalPnL: 600 } },
        { date: '2024-01-14', summary: { totalPnL: 400 } },
      ];

      mockDb.query.mockResolvedValue({ rows: mockReports });

      const reports = await analyzer.getHistoricalReports('2024-01-10', '2024-01-15');

      expect(reports).toHaveLength(2);
      expect(reports[0]).toHaveProperty('date', '2024-01-15');
    });
  });
}); 