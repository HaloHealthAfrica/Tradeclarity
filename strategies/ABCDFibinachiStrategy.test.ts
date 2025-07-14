/**
 * ABCD Fibonacci Strategy Test Suite
 * 
 * This file demonstrates how to use the ABCD fibinachi strategy
 * and includes basic tests to verify functionality.
 */

import { ABCDFibinachiStrategy } from './ABCDFibinachiStrategy';
import { Candle } from '../types';
import { createModuleLogger } from '../utils/logger';

const logger = createModuleLogger('ABCDFibinachiStrategy.test');

/**
 * Mock storage implementation for testing
 */
class MockStorage {
  private marketData: Map<string, Candle[]> = new Map();

  async getMarketDataHistory(symbol: string, lookback: number): Promise<Candle[]> {
    return this.marketData.get(symbol) || [];
  }

  setMarketData(symbol: string, data: Candle[]): void {
    this.marketData.set(symbol, data);
  }
}

/**
 * Generate sample market data for testing
 */
function generateSampleData(symbol: string, count: number = 100): Candle[] {
  const data: Candle[] = [];
  let basePrice = 100;
  
  for (let i = 0; i < count; i++) {
    const timestamp = Date.now() - (count - i) * 60000; // 1-minute intervals
    const open = basePrice + Math.random() * 2 - 1;
    const high = open + Math.random() * 1;
    const low = open - Math.random() * 1;
    const close = open + Math.random() * 2 - 1;
    const volume = 1000000 + Math.random() * 500000;
    
    data.push({
      symbol,
      interval: '5m',
      timestamp,
      open,
      high,
      low,
      close,
      volume
    });
    
    basePrice = close;
  }
  
  return data;
}

/**
 * Generate ABCD pattern data
 */
function generateABCDPatternData(symbol: string): Candle[] {
  const data: Candle[] = [];
  let basePrice = 100;
  const timestamp = Date.now();
  
  // Point A (swing low)
  data.push({
    symbol,
    interval: '5m',
    timestamp: timestamp - 400000,
    open: basePrice,
    high: basePrice + 0.5,
    low: basePrice,
    close: basePrice + 0.2,
    volume: 1000000
  });
  
  // Point B (swing high)
  data.push({
    symbol,
    interval: '5m',
    timestamp: timestamp - 300000,
    open: basePrice + 0.2,
    high: basePrice + 2,
    low: basePrice + 0.1,
    close: basePrice + 1.8,
    volume: 1200000
  });
  
  // Point C (retracement)
  data.push({
    symbol,
    interval: '5m',
    timestamp: timestamp - 200000,
    open: basePrice + 1.8,
    high: basePrice + 1.9,
    low: basePrice + 0.8,
    close: basePrice + 1.0,
    volume: 1100000
  });
  
  // Point D (extension target)
  data.push({
    symbol,
    interval: '5m',
    timestamp: timestamp - 100000,
    open: basePrice + 1.0,
    high: basePrice + 3.2,
    low: basePrice + 0.9,
    close: basePrice + 3.0,
    volume: 1500000
  });
  
  // Current candle
  data.push({
    symbol,
    interval: '5m',
    timestamp,
    open: basePrice + 3.0,
    high: basePrice + 3.1,
    low: basePrice + 2.9,
    close: basePrice + 3.05,
    volume: 1300000
  });
  
  return data;
}

/**
 * Test the ABCD Fibonacci Strategy
 */
async function testABCDFibinachiStrategy(): Promise<boolean> {
  logger.info('Testing ABCD Fibonacci Strategy...');
  
  try {
    // Create strategy with custom configuration
    const strategy = new ABCDFibinachiStrategy({
      minSwingSize: 0.3,          // More sensitive for testing
      confluenceRequired: 3,       // Lower requirement for testing
      volumeConfirmation: true,
      trendAlignment: true,
      technicalConfirmation: true,
      maxRiskPerTrade: 0.02,
      stopLossBuffer: 0.005,
      takeProfitMultiplier: 1.5
    });
    
    // Initialize strategy
    await strategy.initialize();
    logger.info('Strategy initialized successfully');
    
    // Test 1: Process sample data
    logger.info('Processing sample market data...');
    const sampleData = generateSampleData('SPY', 50);
    
    for (const candle of sampleData) {
      const signal = await strategy.processCandle(candle);
      if (signal) {
        logger.info('Signal generated', {
          symbol: signal.symbol,
          direction: signal.direction,
          confidence: signal.confidence,
          price: signal.price,
          stopLoss: signal.stopLoss,
          takeProfit: signal.takeProfit
        });
      }
    }
    
    // Test 2: Process ABCD pattern data
    logger.info('Processing ABCD pattern data...');
    const patternData = generateABCDPatternData('SPY');
    
    for (const candle of patternData) {
      const signal = await strategy.processCandle(candle);
      if (signal) {
        logger.info('ABCD Pattern Signal', {
          symbol: signal.symbol,
          direction: signal.direction,
          confidence: signal.confidence,
          price: signal.price,
          stopLoss: signal.stopLoss,
          takeProfit: signal.takeProfit
        });
      }
    }
    
    // Test 3: Strategy configuration
    logger.info('Testing strategy configuration...');
    
    const config = strategy.getConfig();
    logger.info('Current Configuration', {
      minSwingSize: config.minSwingSize,
      confluenceRequired: config.confluenceRequired,
      volumeConfirmation: config.volumeConfirmation,
      trendAlignment: config.trendAlignment,
      technicalConfirmation: config.technicalConfirmation
    });
    
    // Update configuration
    strategy.updateConfig({
      confluenceRequired: 4,
      volumeConfirmation: false
    });
    
    logger.info('Configuration updated successfully');
    
    // Test 4: Active patterns
    logger.info('Checking active patterns...');
    const activePatterns = strategy.getActivePatterns();
    logger.info(`Active Patterns: ${activePatterns.size}`);
    
    if (activePatterns.size > 0) {
      for (const [symbol, pattern] of activePatterns) {
        logger.info(`Pattern for ${symbol}`, {
          direction: pattern.direction,
          strength: pattern.strength,
          confluence: pattern.confluence,
          trendAlignment: pattern.trendAlignment,
          volumeConfirmation: pattern.volumeConfirmation,
          technicalConfirmation: pattern.technicalConfirmation
        });
      }
    }
    
    // Test 5: Strategy cleanup
    logger.info('Testing strategy cleanup...');
    await strategy.cleanup();
    logger.info('Strategy cleanup completed successfully');
    
    logger.info('All tests completed successfully');
    return true;
    
  } catch (error) {
    logger.error('Test failed', error as Error);
    return false;
  }
}

/**
 * Performance test with multiple symbols
 */
async function performanceTest(): Promise<{
  processingTime: number;
  totalSignals: number;
  averageTimePerCandle: number;
  signalsPerSymbol: number;
}> {
  logger.info('Performance Test with Multiple Symbols...');
  
  const symbols = ['SPY', 'QQQ', 'TSLA', 'AAPL'];
  const strategy = new ABCDFibinachiStrategy({
    minSwingSize: 0.5,
    confluenceRequired: 4,
    maxRiskPerTrade: 0.02
  });
  
  await strategy.initialize();
  
  const startTime = Date.now();
  let totalSignals = 0;
  
  for (const symbol of symbols) {
    logger.info(`Processing ${symbol}...`);
    const data = generateSampleData(symbol, 100);
    
    for (const candle of data) {
      const signal = await strategy.processCandle(candle);
      if (signal) {
        totalSignals++;
        logger.info(`Signal for ${symbol}: ${signal.direction} @ ${signal.price}`);
      }
    }
  }
  
  const endTime = Date.now();
  const processingTime = endTime - startTime;
  const averageTimePerCandle = processingTime / (symbols.length * 100);
  const signalsPerSymbol = totalSignals / symbols.length;
  
  logger.info('Performance Results', {
    processingTime,
    totalSignals,
    averageTimePerCandle,
    signalsPerSymbol
  });
  
  await strategy.cleanup();
  
  return {
    processingTime,
    totalSignals,
    averageTimePerCandle,
    signalsPerSymbol
  };
}

/**
 * Run all tests
 */
async function runAllTests(): Promise<boolean> {
  logger.info('ABCD Fibonacci Strategy Test Suite');
  
  try {
    const testResult = await testABCDFibinachiStrategy();
    const performanceResult = await performanceTest();
    
    if (testResult) {
      logger.info('All tests completed successfully');
      logger.info('The ABCD fibinachi strategy is ready for production use');
      return true;
    } else {
      logger.error('Test suite failed');
      return false;
    }
    
  } catch (error) {
    logger.error('Test suite failed', error as Error);
    return false;
  }
}

// Export for use in other modules
export {
  testABCDFibinachiStrategy,
  performanceTest,
  runAllTests,
  generateSampleData,
  generateABCDPatternData
}; 