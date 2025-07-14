import { SATYSignalGenerator, SATYConfig } from './SATYSignalGenerator';
import { SATYTimingAnalyzer, SATYTimingConfig } from './SATYTimingAnalyzer';
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

describe('SATY Trading Strategy', () => {
  let signalGenerator: SATYSignalGenerator;
  let timingAnalyzer: SATYTimingAnalyzer;
  let mockLogger: any;

  beforeEach(() => {
    jest.clearAllMocks();
    signalGenerator = new SATYSignalGenerator(mockStorage as any);
    timingAnalyzer = new SATYTimingAnalyzer(mockStorage as any);
    mockLogger = createModuleLogger('SATYStrategy');
  });

  describe('SATYSignalGenerator', () => {
    describe('Configuration', () => {
      test('should initialize with default configuration', () => {
        const config = signalGenerator.getConfig();
        expect(config.emaShortPeriod).toBe(8);
        expect(config.emaLongPeriod).toBe(21);
        expect(config.adxThreshold).toBe(25);
        expect(config.minConfidence).toBe(0.65);
      });

      test('should update configuration correctly', () => {
        const newConfig = { minConfidence: 0.75, adxThreshold: 30 };
        signalGenerator.updateConfig(newConfig);
        
        const config = signalGenerator.getConfig();
        expect(config.minConfidence).toBe(0.75);
        expect(config.adxThreshold).toBe(30);
      });
    });

    describe('Technical Analysis', () => {
      test('should calculate EMA correctly', () => {
        const prices = [100, 101, 102, 103, 104, 105, 106, 107];
        const ema = (signalGenerator as any).calculateEMA(prices, 5);
        
        expect(ema.length).toBeGreaterThan(0);
        expect(ema[ema.length - 1]).toBeGreaterThan(0);
      });

      test('should calculate RSI correctly', () => {
        const prices = [100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114];
        const rsi = (signalGenerator as any).calculateRSI(prices, 14);
        
        expect(rsi.length).toBeGreaterThan(0);
        expect(rsi[rsi.length - 1]).toBeGreaterThanOrEqual(0);
        expect(rsi[rsi.length - 1]).toBeLessThanOrEqual(100);
      });

      test('should calculate MACD correctly', () => {
        const prices = [100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125];
        const macd = (signalGenerator as any).calculateMACD(prices);
        
        expect(macd.macd).toBeDefined();
        expect(macd.signal).toBeDefined();
        expect(macd.histogram).toBeDefined();
      });

      test('should calculate Bollinger Bands correctly', () => {
        const prices = [100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120];
        const bb = (signalGenerator as any).calculateBollingerBands(prices, 20, 2);
        
        expect(bb.upper).toBeGreaterThan(bb.middle);
        expect(bb.middle).toBeGreaterThan(bb.lower);
      });
    });

    describe('Signal Generation', () => {
      test('should generate signal with valid market data', async () => {
        const mockStrategy = { id: 'test-strategy' };
        const mockMarketData = {
          symbol: 'SPY',
          price: 150,
          volume: 1000000,
          change: 0.01,
          timestamp: Date.now()
        };

        // Mock the getMarketData method
        (signalGenerator as any).getMarketData = jest.fn().mockResolvedValue(mockMarketData);
        (signalGenerator as any).calculateTechnicalIndicators = jest.fn().mockResolvedValue({
          emaShort: 151,
          emaLong: 149,
          adx: 30,
          volumeSMA: 1200000,
          rsi: 60,
          macd: { macd: 0.5, signal: 0.3, histogram: 0.2 },
          bollingerBands: { upper: 155, middle: 150, lower: 145 }
        });

        // Mock the analyzeSATYSignal method
        (signalGenerator as any).analyzeSATYSignal = jest.fn().mockReturnValue({
          symbol: 'SPY',
          direction: 'CALL',
          entry: 150,
          stop: 145,
          target: 160,
          confidence: 0.75,
          reasoning: 'Bullish signal',
          technicalFactors: ['EMA alignment', 'Volume confirmation'],
          riskReward: 2.0,
          timestamp: Date.now()
        });

        mockStorage.createSignal.mockResolvedValue({ id: 'test-signal' });

        const signal = await signalGenerator.generateSignal(mockStrategy as any);
        
        expect(signal).toBeTruthy();
        expect(mockStorage.createSignal).toHaveBeenCalled();
      });

      test('should return null for insufficient data', async () => {
        const mockStrategy = { id: 'test-strategy' };
        const mockMarketData = {
          symbol: 'SPY',
          price: 150,
          volume: 1000000,
          change: 0.01,
          timestamp: Date.now()
        };

        (signalGenerator as any).getMarketData = jest.fn().mockResolvedValue(mockMarketData);
        (signalGenerator as any).calculateTechnicalIndicators = jest.fn().mockResolvedValue(null);

        const signal = await signalGenerator.generateSignal(mockStrategy as any);
        
        expect(signal).toBeNull();
      });
    });

    describe('Risk Management', () => {
      test('should calculate position size correctly', () => {
        const currentPrice = 100;
        const entryPrice = 100;
        const stopPrice = 95;

        const positionSize = (signalGenerator as any).calculatePositionSize(currentPrice, entryPrice, stopPrice);
        expect(positionSize).toBeGreaterThan(0);
      });

      test('should handle zero risk per share', () => {
        const currentPrice = 100;
        const entryPrice = 100;
        const stopPrice = 100;

        const positionSize = (signalGenerator as any).calculatePositionSize(currentPrice, entryPrice, stopPrice);
        expect(positionSize).toBe(0);
      });
    });

    describe('Performance Metrics', () => {
      test('should update performance metrics correctly', () => {
        const initialMetrics = signalGenerator.getPerformanceMetrics();
        expect(initialMetrics.totalSignals).toBe(0);

        (signalGenerator as any).updatePerformanceMetrics(0.75, 100);
        
        const updatedMetrics = signalGenerator.getPerformanceMetrics();
        expect(updatedMetrics.totalSignals).toBe(1);
        expect(updatedMetrics.averageConfidence).toBe(0.75);
        expect(updatedMetrics.averageProcessingTime).toBe(100);
      });
    });
  });

  describe('SATYTimingAnalyzer', () => {
    describe('Configuration', () => {
      test('should initialize with default configuration', () => {
        const config = timingAnalyzer.getConfig();
        expect(config.entryWindowMinutes).toBe(30);
        expect(config.maxEarlyEntryRisk).toBe(0.15);
        expect(config.minConfidenceForEarlyEntry).toBe(0.75);
      });

      test('should update configuration correctly', () => {
        const newConfig = { maxEarlyEntryRisk: 0.2, minConfidenceForEarlyEntry: 0.8 };
        timingAnalyzer.updateConfig(newConfig);
        
        const config = timingAnalyzer.getConfig();
        expect(config.maxEarlyEntryRisk).toBe(0.2);
        expect(config.minConfidenceForEarlyEntry).toBe(0.8);
      });
    });

    describe('Timing Analysis', () => {
      test('should analyze time of day correctly', () => {
        const timeAnalysis = (timingAnalyzer as any).analyzeTimeOfDay();
        
        expect(timeAnalysis.confidenceBonus).toBeDefined();
        expect(timeAnalysis.reasoning).toBeDefined();
      });

      test('should analyze market conditions correctly', () => {
        const marketContext = {
          volatility: 0.02,
          volume: 1.2,
          trendStrength: 30,
          marketRegime: 'trending' as const,
          timeOfDay: 'mid_day' as const
        };

        const marketAnalysis = (timingAnalyzer as any).analyzeMarketConditions(marketContext);
        
        expect(marketAnalysis.confidenceBonus).toBeDefined();
        expect(marketAnalysis.reasoning).toBeDefined();
      });

      test('should analyze volatility correctly', () => {
        const volatilityAnalysis = (timingAnalyzer as any).analyzeVolatility(0.02);
        
        expect(volatilityAnalysis.confidenceBonus).toBeDefined();
        expect(volatilityAnalysis.reasoning).toBeDefined();
      });

      test('should analyze volume correctly', () => {
        const volumeAnalysis = (timingAnalyzer as any).analyzeVolume(1.5);
        
        expect(volumeAnalysis.confidenceBonus).toBeDefined();
        expect(volumeAnalysis.reasoning).toBeDefined();
      });
    });

    describe('Risk Assessment', () => {
      test('should calculate market risk correctly', () => {
        const marketContext = {
          volatility: 0.02,
          volume: 1.2,
          trendStrength: 30,
          marketRegime: 'trending' as const,
          timeOfDay: 'mid_day' as const
        };

        const marketRisk = (timingAnalyzer as any).calculateMarketRisk(marketContext);
        expect(marketRisk).toBeGreaterThanOrEqual(0);
        expect(marketRisk).toBeLessThanOrEqual(1);
      });

      test('should calculate timing risk correctly', () => {
        const timingAnalysis = { timing: 'optimal' };
        const timingRisk = (timingAnalyzer as any).calculateTimingRisk(timingAnalysis);
        expect(timingRisk).toBeGreaterThanOrEqual(0);
        expect(timingRisk).toBeLessThanOrEqual(1);
      });

      test('should calculate volatility risk correctly', () => {
        const volatilityRisk = (timingAnalyzer as any).calculateVolatilityRisk(0.02);
        expect(volatilityRisk).toBeGreaterThanOrEqual(0);
        expect(volatilityRisk).toBeLessThanOrEqual(1);
      });

      test('should calculate volume risk correctly', () => {
        const volumeRisk = (timingAnalyzer as any).calculateVolumeRisk(1.5);
        expect(volumeRisk).toBeGreaterThanOrEqual(0);
        expect(volumeRisk).toBeLessThanOrEqual(1);
      });
    });

    describe('Entry Timing Analysis', () => {
      test('should analyze entry timing with valid data', async () => {
        const mockStrategy = { id: 'test-strategy' };
        const mockMarketData = {
          symbol: 'SPY',
          price: 150,
          volume: 1000000,
          change: 0.01,
          timestamp: Date.now()
        };

        // Mock the getMarketData method
        (timingAnalyzer as any).getMarketData = jest.fn().mockResolvedValue(mockMarketData);
        (timingAnalyzer as any).analyzeMarketContext = jest.fn().mockResolvedValue({
          volatility: 0.02,
          volume: 1.2,
          trendStrength: 30,
          marketRegime: 'trending',
          timeOfDay: 'mid_day'
        });

        // Mock the performTimingAnalysis method
        (timingAnalyzer as any).performTimingAnalysis = jest.fn().mockReturnValue({
          timing: 'optimal',
          confidence: 0.8,
          reasoning: 'Good market conditions'
        });

        // Mock the generateTimingRecommendations method
        (timingAnalyzer as any).generateTimingRecommendations = jest.fn().mockReturnValue([
          {
            type: 'entry',
            timing: 'immediate',
            confidence: 0.8,
            reasoning: 'Optimal entry conditions',
            expectedImpact: 'High probability of success',
            riskLevel: 'low'
          }
        ]);

        // Mock the assessRisks method
        (timingAnalyzer as any).assessRisks = jest.fn().mockReturnValue({
          overallRisk: 'low',
          marketRisk: 0.2,
          timingRisk: 0.2,
          volatilityRisk: 0.2,
          volumeRisk: 0.2,
          recommendations: ['Risk levels are acceptable']
        });

        // Mock the calculatePerformanceMetrics method
        (timingAnalyzer as any).calculatePerformanceMetrics = jest.fn().mockResolvedValue({
          winRate: 0.65,
          averageReturn: 0.12,
          maxDrawdown: 0.08,
          sharpeRatio: 1.2,
          profitFactor: 1.8,
          averageHoldTime: 7200000,
          optimalEntryTime: '9:30 AM - 10:00 AM'
        });

        const result = await timingAnalyzer.analyzeEntryTiming('SPY', mockStrategy as any);
        
        expect(result).toBeTruthy();
        expect(result.symbol).toBe('SPY');
        expect(result.currentTiming).toBe('optimal');
        expect(result.confidence).toBe(0.8);
      });

      test('should return null for insufficient data', async () => {
        const mockStrategy = { id: 'test-strategy' };

        (timingAnalyzer as any).getMarketData = jest.fn().mockResolvedValue(null);

        const result = await timingAnalyzer.analyzeEntryTiming('SPY', mockStrategy as any);
        
        expect(result).toBeNull();
      });
    });

    describe('Market Context Analysis', () => {
      test('should calculate volatility correctly', () => {
        const prices = [100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110];
        const volatility = (timingAnalyzer as any).calculateVolatility(prices);
        
        expect(volatility).toBeGreaterThanOrEqual(0);
      });

      test('should calculate trend strength correctly', () => {
        const prices = [100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110];
        const trendStrength = (timingAnalyzer as any).calculateTrendStrength(prices);
        
        expect(trendStrength).toBeGreaterThanOrEqual(0);
      });

      test('should determine market regime correctly', () => {
        const regime1 = (timingAnalyzer as any).determineMarketRegime(0.05, 30);
        const regime2 = (timingAnalyzer as any).determineMarketRegime(0.02, 20);
        const regime3 = (timingAnalyzer as any).determineMarketRegime(0.01, 15);
        
        expect(['trending', 'ranging', 'volatile']).toContain(regime1);
        expect(['trending', 'ranging', 'volatile']).toContain(regime2);
        expect(['trending', 'ranging', 'volatile']).toContain(regime3);
      });

      test('should determine time of day correctly', () => {
        const timeOfDay = (timingAnalyzer as any).determineTimeOfDay();
        
        expect(['pre_market', 'market_open', 'mid_day', 'market_close', 'after_hours']).toContain(timeOfDay);
      });
    });

    describe('Performance Metrics', () => {
      test('should update performance metrics correctly', () => {
        const initialMetrics = timingAnalyzer.getPerformanceMetrics();
        expect(initialMetrics.totalAnalyses).toBe(0);

        (timingAnalyzer as any).updatePerformanceMetrics(0.75, 100);
        
        const updatedMetrics = timingAnalyzer.getPerformanceMetrics();
        expect(updatedMetrics.totalAnalyses).toBe(1);
        expect(updatedMetrics.averageConfidence).toBe(0.75);
        expect(updatedMetrics.averageProcessingTime).toBe(100);
      });
    });
  });

  describe('Integration Tests', () => {
    test('should generate signal and analyze timing together', async () => {
      const mockStrategy = { id: 'test-strategy' };
      const mockMarketData = {
        symbol: 'SPY',
        price: 150,
        volume: 1000000,
        change: 0.01,
        timestamp: Date.now()
      };

      // Mock signal generation
      (signalGenerator as any).getMarketData = jest.fn().mockResolvedValue(mockMarketData);
      (signalGenerator as any).calculateTechnicalIndicators = jest.fn().mockResolvedValue({
        emaShort: 151,
        emaLong: 149,
        adx: 30,
        volumeSMA: 1200000,
        rsi: 60,
        macd: { macd: 0.5, signal: 0.3, histogram: 0.2 },
        bollingerBands: { upper: 155, middle: 150, lower: 145 }
      });
      (signalGenerator as any).analyzeSATYSignal = jest.fn().mockReturnValue({
        symbol: 'SPY',
        direction: 'CALL',
        entry: 150,
        stop: 145,
        target: 160,
        confidence: 0.75,
        reasoning: 'Bullish signal',
        technicalFactors: ['EMA alignment', 'Volume confirmation'],
        riskReward: 2.0,
        timestamp: Date.now()
      });
      mockStorage.createSignal.mockResolvedValue({ id: 'test-signal' });

      // Mock timing analysis
      (timingAnalyzer as any).getMarketData = jest.fn().mockResolvedValue(mockMarketData);
      (timingAnalyzer as any).analyzeMarketContext = jest.fn().mockResolvedValue({
        volatility: 0.02,
        volume: 1.2,
        trendStrength: 30,
        marketRegime: 'trending',
        timeOfDay: 'mid_day'
      });
      (timingAnalyzer as any).performTimingAnalysis = jest.fn().mockReturnValue({
        timing: 'optimal',
        confidence: 0.8,
        reasoning: 'Good market conditions'
      });
      (timingAnalyzer as any).generateTimingRecommendations = jest.fn().mockReturnValue([
        {
          type: 'entry',
          timing: 'immediate',
          confidence: 0.8,
          reasoning: 'Optimal entry conditions',
          expectedImpact: 'High probability of success',
          riskLevel: 'low'
        }
      ]);
      (timingAnalyzer as any).assessRisks = jest.fn().mockReturnValue({
        overallRisk: 'low',
        marketRisk: 0.2,
        timingRisk: 0.2,
        volatilityRisk: 0.2,
        volumeRisk: 0.2,
        recommendations: ['Risk levels are acceptable']
      });
      (timingAnalyzer as any).calculatePerformanceMetrics = jest.fn().mockResolvedValue({
        winRate: 0.65,
        averageReturn: 0.12,
        maxDrawdown: 0.08,
        sharpeRatio: 1.2,
        profitFactor: 1.8,
        averageHoldTime: 7200000,
        optimalEntryTime: '9:30 AM - 10:00 AM'
      });

      // Generate signal
      const signal = await signalGenerator.generateSignal(mockStrategy as any);
      
      // Analyze timing
      const timingAnalysis = await timingAnalyzer.analyzeEntryTiming('SPY', mockStrategy as any);
      
      expect(signal).toBeTruthy();
      expect(timingAnalysis).toBeTruthy();
      expect(signal.symbol).toBe('SPY');
      expect(timingAnalysis.symbol).toBe('SPY');
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid market data gracefully', async () => {
      const mockStrategy = { id: 'test-strategy' };

      (signalGenerator as any).getMarketData = jest.fn().mockResolvedValue(null);

      const signal = await signalGenerator.generateSignal(mockStrategy as any);
      
      expect(signal).toBeNull();
    });

    test('should handle technical analysis errors gracefully', async () => {
      const mockStrategy = { id: 'test-strategy' };
      const mockMarketData = {
        symbol: 'SPY',
        price: 150,
        volume: 1000000,
        change: 0.01,
        timestamp: Date.now()
      };

      (signalGenerator as any).getMarketData = jest.fn().mockResolvedValue(mockMarketData);
      (signalGenerator as any).calculateTechnicalIndicators = jest.fn().mockRejectedValue(new Error('Technical analysis failed'));

      const signal = await signalGenerator.generateSignal(mockStrategy as any);
      
      expect(signal).toBeNull();
    });

    test('should handle timing analysis errors gracefully', async () => {
      const mockStrategy = { id: 'test-strategy' };

      (timingAnalyzer as any).getMarketData = jest.fn().mockRejectedValue(new Error('Market data error'));

      const result = await timingAnalyzer.analyzeEntryTiming('SPY', mockStrategy as any);
      
      expect(result).toBeNull();
    });
  });
}); 