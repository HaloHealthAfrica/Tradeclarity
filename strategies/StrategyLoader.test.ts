import { StrategyLoader } from './StrategyLoader';
import { DatabaseService } from '../api/DatabaseService';
import { BaseStrategy } from './BaseStrategy';

// Mock dependencies
jest.mock('../api/DatabaseService');
jest.mock('./BaseStrategy');

const mockDatabaseService = DatabaseService as jest.MockedClass<typeof DatabaseService>;
const mockBaseStrategy = BaseStrategy as jest.MockedClass<typeof BaseStrategy>;

describe('StrategyLoader', () => {
  let loader: StrategyLoader;
  let mockDb: jest.Mocked<DatabaseService>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockDb = {
      query: jest.fn(),
      getConnection: jest.fn(),
      close: jest.fn(),
    } as any;

    mockDatabaseService.mockImplementation(() => mockDb);
    
    loader = new StrategyLoader();
  });

  describe('loadStrategy', () => {
    it('should load a strategy from database', async () => {
      const mockStrategy = {
        id: 1,
        name: 'EMAConfluence',
        description: 'EMA Strategy',
        parameters: { period: 20, multiplier: 2 },
        isActive: true,
        created_at: '2024-01-15T10:00:00Z'
      };

      mockDb.query.mockResolvedValue({ rows: [mockStrategy] });

      const strategy = await loader.loadStrategy('EMAConfluence');

      expect(strategy).toHaveProperty('name', 'EMAConfluence');
      expect(strategy).toHaveProperty('parameters');
      expect(strategy).toHaveProperty('isActive', true);
    });

    it('should handle strategy not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await expect(loader.loadStrategy('NonExistentStrategy')).rejects.toThrow('Strategy not found');
    });

    it('should handle database errors', async () => {
      mockDb.query.mockRejectedValue(new Error('Database error'));

      await expect(loader.loadStrategy('EMAConfluence')).rejects.toThrow('Database error');
    });
  });

  describe('loadAllStrategies', () => {
    it('should load all active strategies', async () => {
      const mockStrategies = [
        { id: 1, name: 'EMAConfluence', isActive: true },
        { id: 2, name: 'SqueezeStrategy', isActive: true },
        { id: 3, name: 'ICTStrategy', isActive: false },
      ];

      mockDb.query.mockResolvedValue({ rows: mockStrategies });

      const strategies = await loader.loadAllStrategies();

      expect(strategies).toHaveLength(2);
      expect(strategies[0]).toHaveProperty('name', 'EMAConfluence');
      expect(strategies[1]).toHaveProperty('name', 'SqueezeStrategy');
    });

    it('should return empty array when no active strategies', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const strategies = await loader.loadAllStrategies();

      expect(strategies).toHaveLength(0);
    });
  });

  describe('createStrategy', () => {
    it('should create a new strategy', async () => {
      const strategyData = {
        name: 'NewStrategy',
        description: 'A new trading strategy',
        parameters: { period: 14, threshold: 0.5 },
        isActive: true
      };

      mockDb.query.mockResolvedValue({ rows: [{ id: 1 }] });

      const created = await loader.createStrategy(strategyData);

      expect(created).toBe(true);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO strategies'),
        expect.arrayContaining([strategyData.name, strategyData.description])
      );
    });

    it('should handle duplicate strategy names', async () => {
      const strategyData = {
        name: 'EMAConfluence',
        description: 'Duplicate strategy',
        parameters: { period: 20 },
        isActive: true
      };

      mockDb.query.mockRejectedValue(new Error('duplicate key value violates unique constraint'));

      await expect(loader.createStrategy(strategyData)).rejects.toThrow('Strategy name already exists');
    });
  });

  describe('updateStrategy', () => {
    it('should update an existing strategy', async () => {
      const updateData = {
        name: 'EMAConfluence',
        description: 'Updated description',
        parameters: { period: 25, multiplier: 3 },
        isActive: true
      };

      mockDb.query.mockResolvedValue({ rows: [{ id: 1 }] });

      const updated = await loader.updateStrategy('EMAConfluence', updateData);

      expect(updated).toBe(true);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE strategies'),
        expect.arrayContaining([updateData.description, updateData.parameters])
      );
    });

    it('should handle strategy not found for update', async () => {
      const updateData = {
        name: 'NonExistentStrategy',
        description: 'Updated description',
        parameters: { period: 25 },
        isActive: true
      };

      mockDb.query.mockResolvedValue({ rows: [] });

      await expect(loader.updateStrategy('NonExistentStrategy', updateData)).rejects.toThrow('Strategy not found');
    });
  });

  describe('deleteStrategy', () => {
    it('should delete a strategy', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 1 }] });

      const deleted = await loader.deleteStrategy('EMAConfluence');

      expect(deleted).toBe(true);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM strategies'),
        expect.arrayContaining(['EMAConfluence'])
      );
    });

    it('should handle strategy not found for deletion', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await expect(loader.deleteStrategy('NonExistentStrategy')).rejects.toThrow('Strategy not found');
    });
  });

  describe('validateStrategy', () => {
    it('should validate strategy parameters', async () => {
      const validStrategy = {
        name: 'ValidStrategy',
        description: 'A valid strategy',
        parameters: { period: 20, multiplier: 2 },
        isActive: true
      };

      const isValid = loader.validateStrategy(validStrategy);

      expect(isValid).toBe(true);
    });

    it('should reject invalid strategy parameters', async () => {
      const invalidStrategy = {
        name: '',
        description: 'Invalid strategy',
        parameters: { period: -5, multiplier: 0 },
        isActive: true
      };

      const isValid = loader.validateStrategy(invalidStrategy);

      expect(isValid).toBe(false);
    });
  });

  describe('executeStrategy', () => {
    it('should execute a strategy with market data', async () => {
      const mockStrategy = {
        name: 'EMAConfluence',
        parameters: { period: 20, multiplier: 2 },
        execute: jest.fn().mockResolvedValue([
          { symbol: 'AAPL', signal: 'buy', confidence: 0.8, price: 150.0 }
        ])
      };

      const marketData = [
        { timestamp: '2024-01-15T09:30:00Z', open: 150.0, high: 152.0, low: 149.0, close: 151.0, volume: 1000000 },
        { timestamp: '2024-01-15T09:31:00Z', open: 151.0, high: 153.0, low: 150.0, close: 152.0, volume: 1100000 },
      ];

      jest.spyOn(loader, 'loadStrategy').mockResolvedValue(mockStrategy);

      const signals = await loader.executeStrategy('EMAConfluence', marketData);

      expect(signals).toHaveLength(1);
      expect(signals[0]).toHaveProperty('symbol', 'AAPL');
      expect(signals[0]).toHaveProperty('signal', 'buy');
    });

    it('should handle strategy execution errors', async () => {
      const mockStrategy = {
        name: 'FailingStrategy',
        parameters: { period: 20 },
        execute: jest.fn().mockRejectedValue(new Error('Strategy execution failed'))
      };

      jest.spyOn(loader, 'loadStrategy').mockResolvedValue(mockStrategy);

      await expect(loader.executeStrategy('FailingStrategy', [])).rejects.toThrow('Strategy execution failed');
    });
  });

  describe('getStrategyPerformance', () => {
    it('should get performance metrics for a strategy', async () => {
      const mockPerformance = {
        totalPnL: 600,
        totalTrades: 10,
        winRate: 0.6,
        profitFactor: 1.5,
        sharpeRatio: 1.2
      };

      mockDb.query.mockResolvedValue({ rows: [mockPerformance] });

      const performance = await loader.getStrategyPerformance('EMAConfluence', '2024-01-01', '2024-01-31');

      expect(performance).toHaveProperty('totalPnL', 600);
      expect(performance).toHaveProperty('winRate', 0.6);
      expect(performance).toHaveProperty('sharpeRatio', 1.2);
    });
  });

  describe('compareStrategies', () => {
    it('should compare multiple strategies', async () => {
      const mockComparison = [
        { strategy: 'EMAConfluence', totalPnL: 600, winRate: 0.6 },
        { strategy: 'SqueezeStrategy', totalPnL: 400, winRate: 0.5 },
      ];

      mockDb.query.mockResolvedValue({ rows: mockComparison });

      const comparison = await loader.compareStrategies(['EMAConfluence', 'SqueezeStrategy'], '2024-01-01', '2024-01-31');

      expect(comparison).toHaveLength(2);
      expect(comparison[0]).toHaveProperty('strategy', 'EMAConfluence');
      expect(comparison[1]).toHaveProperty('strategy', 'SqueezeStrategy');
    });
  });

  describe('optimizeStrategyParameters', () => {
    it('should optimize strategy parameters', async () => {
      const mockOptimization = {
        bestParams: { period: 25, multiplier: 2.5 },
        bestPerformance: { totalPnL: 800, winRate: 0.7 },
        iterations: 50
      };

      jest.spyOn(loader, 'executeStrategy').mockResolvedValue([]);

      const optimization = await loader.optimizeStrategyParameters('EMAConfluence', {
        period: [10, 20, 30],
        multiplier: [1.5, 2.0, 2.5]
      });

      expect(optimization).toHaveProperty('bestParams');
      expect(optimization).toHaveProperty('bestPerformance');
      expect(optimization).toHaveProperty('iterations');
    });
  });

  describe('backtestStrategy', () => {
    it('should backtest a strategy with historical data', async () => {
      const mockBacktest = {
        strategy: 'EMAConfluence',
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        totalPnL: 600,
        totalTrades: 10,
        winRate: 0.6,
        maxDrawdown: 200
      };

      jest.spyOn(loader, 'executeStrategy').mockResolvedValue([]);

      const backtest = await loader.backtestStrategy('EMAConfluence', 'AAPL', '2024-01-01', '2024-01-31');

      expect(backtest).toHaveProperty('strategy', 'EMAConfluence');
      expect(backtest).toHaveProperty('totalPnL');
      expect(backtest).toHaveProperty('winRate');
    });
  });

  describe('exportStrategy', () => {
    it('should export strategy configuration', async () => {
      const mockStrategy = {
        name: 'EMAConfluence',
        description: 'EMA Strategy',
        parameters: { period: 20, multiplier: 2 },
        isActive: true
      };

      jest.spyOn(loader, 'loadStrategy').mockResolvedValue(mockStrategy);

      const exported = await loader.exportStrategy('EMAConfluence', 'json');

      expect(exported).toContain('"name":"EMAConfluence"');
      expect(exported).toContain('"parameters":{"period":20,"multiplier":2}');
    });
  });

  describe('importStrategy', () => {
    it('should import strategy configuration', async () => {
      const strategyConfig = {
        name: 'ImportedStrategy',
        description: 'Imported from file',
        parameters: { period: 15, threshold: 0.3 },
        isActive: true
      };

      mockDb.query.mockResolvedValue({ rows: [{ id: 1 }] });

      const imported = await loader.importStrategy(strategyConfig);

      expect(imported).toBe(true);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO strategies'),
        expect.arrayContaining([strategyConfig.name])
      );
    });
  });
}); 