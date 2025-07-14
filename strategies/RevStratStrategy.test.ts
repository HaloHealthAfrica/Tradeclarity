import { RevStratStrategy, RevStratConfig, Candle, RevStratSignal } from './RevStratStrategy';
import { createModuleLogger } from '../utils/logger';

// Mock storage interface
const mockStorage = {
  createSignal: jest.fn(),
  getMarketDataHistory: jest.fn(),
  updateStrategyLastSignal: jest.fn()
};

// Mock logger
jest.mock('../utils/logger', () => ({
  createModuleLogger: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }))
}));

describe('RevStratStrategy', () => {
  let strategy: RevStratStrategy;
  let mockLogger: any;

  beforeEach(() => {
    jest.clearAllMocks();
    strategy = new RevStratStrategy(mockStorage as any);
    mockLogger = createModuleLogger('RevStratStrategy');
  });

  describe('Configuration', () => {
    test('should initialize with default configuration', () => {
      const config = strategy.getConfig();
      expect(config.maxHistoryLength).toBe(100);
      expect(config.riskRatio).toBe(2.0);
      expect(config.minConfidence).toBe(55);
    });

    test('should update configuration correctly', () => {
      const newConfig = { minConfidence: 70, riskRatio: 2.5 };
      strategy.updateConfig(newConfig);
      
      const config = strategy.getConfig();
      expect(config.minConfidence).toBe(70);
      expect(config.riskRatio).toBe(2.5);
    });
  });

  describe('Candle Validation', () => {
    test('should validate valid candle data', () => {
      const validCandle = {
        open: '100.00',
        high: '105.00',
        low: '99.00',
        close: '103.00',
        volume: '1000000'
      };

      const result = (strategy as any).validateCandle(validCandle);
      expect(result).toBeTruthy();
      expect(result.open).toBe(100.00);
      expect(result.high).toBe(105.00);
      expect(result.low).toBe(99.00);
      expect(result.close).toBe(103.00);
      expect(result.range).toBe(6.00);
    });

    test('should reject invalid OHLC data', () => {
      const invalidCandle = {
        open: '100.00',
        high: '95.00', // High lower than open/close
        low: '99.00',
        close: '103.00',
        volume: '1000000'
      };

      const result = (strategy as any).validateCandle(invalidCandle);
      expect(result).toBeNull();
    });

    test('should reject low-range candles', () => {
      const lowRangeCandle = {
        open: '100.00',
        high: '100.05',
        low: '100.00',
        close: '100.02',
        volume: '1000000'
      };

      const result = (strategy as any).validateCandle(lowRangeCandle);
      expect(result).toBeNull();
    });

    test('should handle missing volume data', () => {
      const candleWithoutVolume = {
        open: '100.00',
        high: '105.00',
        low: '99.00',
        close: '103.00'
      };

      const result = (strategy as any).validateCandle(candleWithoutVolume);
      expect(result).toBeTruthy();
      expect(result.volume).toBeUndefined();
    });
  });

  describe('Strat Type Detection', () => {
    test('should detect inside bar (type 1)', () => {
      const prev: Candle = {
        timestamp: Date.now(),
        open: 100,
        high: 105,
        low: 99,
        close: 103,
        range: 6
      };

      const curr: Candle = {
        timestamp: Date.now(),
        open: 102,
        high: 104,
        low: 100,
        close: 101,
        range: 4
      };

      const result = (strategy as any).getStratType(prev, curr);
      expect(result).toBe('1');
    });

    test('should detect up bar (type 2U)', () => {
      const prev: Candle = {
        timestamp: Date.now(),
        open: 100,
        high: 105,
        low: 99,
        close: 103,
        range: 6
      };

      const curr: Candle = {
        timestamp: Date.now(),
        open: 103,
        high: 107,
        low: 102,
        close: 106,
        range: 5
      };

      const result = (strategy as any).getStratType(prev, curr);
      expect(result).toBe('2U');
    });

    test('should detect down bar (type 2D)', () => {
      const prev: Candle = {
        timestamp: Date.now(),
        open: 100,
        high: 105,
        low: 99,
        close: 103,
        range: 6
      };

      const curr: Candle = {
        timestamp: Date.now(),
        open: 103,
        high: 104,
        low: 97,
        close: 98,
        range: 7
      };

      const result = (strategy as any).getStratType(prev, curr);
      expect(result).toBe('2D');
    });

    test('should detect outside bar (type 3)', () => {
      const prev: Candle = {
        timestamp: Date.now(),
        open: 100,
        high: 105,
        low: 99,
        close: 103,
        range: 6
      };

      const curr: Candle = {
        timestamp: Date.now(),
        open: 102,
        high: 107,
        low: 97,
        close: 101,
        range: 10
      };

      const result = (strategy as any).getStratType(prev, curr);
      expect(result).toBe('3');
    });

    test('should handle equal highs and lows', () => {
      const prev: Candle = {
        timestamp: Date.now(),
        open: 100,
        high: 105,
        low: 99,
        close: 103,
        range: 6
      };

      const curr: Candle = {
        timestamp: Date.now(),
        open: 103,
        high: 105, // Equal high
        low: 99,   // Equal low
        close: 101,
        range: 6
      };

      const result = (strategy as any).getStratType(prev, curr);
      expect(result).toBe('1'); // Inside bar
    });
  });

  describe('Pattern Recognition', () => {
    test('should recognize 2D->2U bullish pattern', () => {
      const bar1: Candle = {
        timestamp: Date.now(),
        open: 100,
        high: 105,
        low: 99,
        close: 103,
        range: 6
      };

      const bar2: Candle = {
        timestamp: Date.now(),
        open: 103,
        high: 104,
        low: 97,
        close: 98,
        range: 7
      };

      const bar3: Candle = {
        timestamp: Date.now(),
        open: 98,
        high: 107,
        low: 97,
        close: 106,
        range: 10,
        volume: 1500000
      };

      const result = (strategy as any).recognizePattern('2D', '2U', bar1, bar2, bar3);
      expect(result).toBeTruthy();
      expect(result.stratPattern).toBe('2D->2U');
      expect(result.direction).toBe('CALL');
    });

    test('should recognize 2U->2D bearish pattern', () => {
      const bar1: Candle = {
        timestamp: Date.now(),
        open: 100,
        high: 105,
        low: 99,
        close: 103,
        range: 6
      };

      const bar2: Candle = {
        timestamp: Date.now(),
        open: 103,
        high: 107,
        low: 102,
        close: 106,
        range: 5
      };

      const bar3: Candle = {
        timestamp: Date.now(),
        open: 106,
        high: 106,
        low: 97,
        close: 98,
        range: 9,
        volume: 1500000
      };

      const result = (strategy as any).recognizePattern('2U', '2D', bar1, bar2, bar3);
      expect(result).toBeTruthy();
      expect(result.stratPattern).toBe('2U->2D');
      expect(result.direction).toBe('PUT');
    });

    test('should reject unrecognized patterns', () => {
      const bar1: Candle = {
        timestamp: Date.now(),
        open: 100,
        high: 105,
        low: 99,
        close: 103,
        range: 6
      };

      const bar2: Candle = {
        timestamp: Date.now(),
        open: 103,
        high: 105,
        low: 99,
        close: 101,
        range: 6
      };

      const bar3: Candle = {
        timestamp: Date.now(),
        open: 101,
        high: 105,
        low: 99,
        close: 103,
        range: 6
      };

      const result = (strategy as any).recognizePattern('1', '1', bar1, bar2, bar3);
      expect(result).toBeNull();
    });
  });

  describe('Confidence Calculation', () => {
    test('should calculate confidence with volume confirmation', () => {
      const pattern = {
        stratPattern: '2D->2U',
        direction: 'CALL' as const,
        strength: 60
      };

      const bar1: Candle = {
        timestamp: Date.now(),
        open: 100,
        high: 105,
        low: 99,
        close: 103,
        range: 6
      };

      const bar2: Candle = {
        timestamp: Date.now(),
        open: 103,
        high: 104,
        low: 97,
        close: 98,
        range: 7,
        volume: 1000000
      };

      const bar3: Candle = {
        timestamp: Date.now(),
        open: 98,
        high: 107,
        low: 97,
        close: 106,
        range: 10,
        volume: 2000000 // High volume
      };

      const result = (strategy as any).calculateConfidence(pattern, bar1, bar2, bar3);
      expect(result).toBeGreaterThan(60);
      expect(result).toBeLessThanOrEqual(100);
    });

    test('should handle missing volume data', () => {
      const pattern = {
        stratPattern: '2D->2U',
        direction: 'CALL' as const,
        strength: 60
      };

      const bar1: Candle = {
        timestamp: Date.now(),
        open: 100,
        high: 105,
        low: 99,
        close: 103,
        range: 6
      };

      const bar2: Candle = {
        timestamp: Date.now(),
        open: 103,
        high: 104,
        low: 97,
        close: 98,
        range: 7
      };

      const bar3: Candle = {
        timestamp: Date.now(),
        open: 98,
        high: 107,
        low: 97,
        close: 106,
        range: 10
      };

      const result = (strategy as any).calculateConfidence(pattern, bar1, bar2, bar3);
      expect(result).toBeGreaterThanOrEqual(60);
    });
  });

  describe('Trade Level Calculation', () => {
    test('should calculate bullish trade levels', () => {
      const pattern = {
        stratPattern: '2D->2U',
        direction: 'CALL' as const,
        strength: 60
      };

      const bar1: Candle = {
        timestamp: Date.now(),
        open: 100,
        high: 105,
        low: 99,
        close: 103,
        range: 6
      };

      const bar2: Candle = {
        timestamp: Date.now(),
        open: 103,
        high: 104,
        low: 97,
        close: 98,
        range: 7
      };

      const bar3: Candle = {
        timestamp: Date.now(),
        open: 98,
        high: 107,
        low: 97,
        close: 106,
        range: 10
      };

      const result = (strategy as any).calculateTradeLevels(pattern, bar1, bar2, bar3);
      expect(result.entry).toBe(106);
      expect(result.stop).toBeLessThan(result.entry);
      expect(result.target).toBeGreaterThan(result.entry);
    });

    test('should calculate bearish trade levels', () => {
      const pattern = {
        stratPattern: '2U->2D',
        direction: 'PUT' as const,
        strength: 60
      };

      const bar1: Candle = {
        timestamp: Date.now(),
        open: 100,
        high: 105,
        low: 99,
        close: 103,
        range: 6
      };

      const bar2: Candle = {
        timestamp: Date.now(),
        open: 103,
        high: 107,
        low: 102,
        close: 106,
        range: 5
      };

      const bar3: Candle = {
        timestamp: Date.now(),
        open: 106,
        high: 106,
        low: 97,
        close: 98,
        range: 9
      };

      const result = (strategy as any).calculateTradeLevels(pattern, bar1, bar2, bar3);
      expect(result.entry).toBe(98);
      expect(result.stop).toBeGreaterThan(result.entry);
      expect(result.target).toBeLessThan(result.entry);
    });
  });

  describe('Position Size Calculation', () => {
    test('should calculate position size correctly', () => {
      const currentPrice = 100;
      const entryPrice = 100;
      const stopPrice = 95;

      const result = (strategy as any).calculatePositionSize(currentPrice, entryPrice, stopPrice);
      expect(result).toBeGreaterThan(0);
    });

    test('should handle zero risk per share', () => {
      const currentPrice = 100;
      const entryPrice = 100;
      const stopPrice = 100;

      const result = (strategy as any).calculatePositionSize(currentPrice, entryPrice, stopPrice);
      expect(result).toBe(0);
    });
  });

  describe('Performance Metrics', () => {
    test('should update performance metrics correctly', () => {
      const initialMetrics = strategy.getPerformanceMetrics();
      expect(initialMetrics.totalSignals).toBe(0);

      (strategy as any).updatePerformanceMetrics(75, 100);
      
      const updatedMetrics = strategy.getPerformanceMetrics();
      expect(updatedMetrics.totalSignals).toBe(1);
      expect(updatedMetrics.averageConfidence).toBe(75);
      expect(updatedMetrics.averageProcessingTime).toBe(100);
    });

    test('should calculate average metrics correctly', () => {
      (strategy as any).updatePerformanceMetrics(60, 50);
      (strategy as any).updatePerformanceMetrics(80, 150);
      
      const metrics = strategy.getPerformanceMetrics();
      expect(metrics.totalSignals).toBe(2);
      expect(metrics.averageConfidence).toBe(70);
      expect(metrics.averageProcessingTime).toBe(100);
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid candle data gracefully', () => {
      const invalidCandle = {
        open: 'invalid',
        high: '105.00',
        low: '99.00',
        close: '103.00'
      };

      const result = (strategy as any).validateCandle(invalidCandle);
      expect(result).toBeNull();
    });

    test('should handle pattern recognition errors', () => {
      const result = (strategy as any).recognizePattern('invalid', 'pattern', null, null, null);
      expect(result).toBeNull();
    });

    test('should handle confidence calculation errors', () => {
      const result = (strategy as any).calculateConfidence(null, null, null, null);
      expect(result).toBe(0);
    });
  });

  describe('Integration Tests', () => {
    test('should generate complete signal from valid pattern', () => {
      const mockStrategy = { id: 'test-strategy' };
      const mockMarketData = {
        symbol: 'SPY',
        price: 150,
        change: 0.5,
        timestamp: Date.now()
      };

      // Mock the getMarketData method
      (strategy as any).getMarketData = jest.fn().mockResolvedValue(mockMarketData);
      (strategy as any).generateCandleHistory = jest.fn().mockReturnValue([
        {
          timestamp: Date.now(),
          open: 100,
          high: 105,
          low: 99,
          close: 103,
          range: 6
        },
        {
          timestamp: Date.now(),
          open: 103,
          high: 104,
          low: 97,
          close: 98,
          range: 7
        },
        {
          timestamp: Date.now(),
          open: 98,
          high: 107,
          low: 97,
          close: 106,
          range: 10,
          volume: 1500000
        }
      ]);

      // Mock the analyzeRevStrat method to return a valid signal
      (strategy as any).analyzeRevStrat = jest.fn().mockReturnValue({
        symbol: 'SPY',
        type: 'CALL',
        stratPattern: '2D->2U',
        entry: 106,
        stop: 95,
        target: 118,
        riskReward: 2.4,
        confidence: 75,
        timestamp: Date.now(),
        bars: []
      });

      mockStorage.createSignal.mockResolvedValue({ id: 'test-signal' });

      return strategy.generateSignal(mockStrategy as any).then(signal => {
        expect(signal).toBeTruthy();
        expect(mockStorage.createSignal).toHaveBeenCalled();
      });
    });

    test('should return null for insufficient data', () => {
      const mockStrategy = { id: 'test-strategy' };
      const mockMarketData = {
        symbol: 'SPY',
        price: 150,
        change: 0.5,
        timestamp: Date.now()
      };

      (strategy as any).getMarketData = jest.fn().mockResolvedValue(mockMarketData);
      (strategy as any).generateCandleHistory = jest.fn().mockReturnValue([]);

      return strategy.generateSignal(mockStrategy as any).then(signal => {
        expect(signal).toBeNull();
      });
    });
  });
}); 