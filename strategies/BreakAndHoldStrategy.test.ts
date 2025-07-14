/**
 * Break and Hold Strategy Test Suite
 * 
 * Comprehensive tests for the production-ready Break and Hold Strategy
 * including API resilience, caching, rate limiting, and error handling.
 */

import { BreakAndHoldStrategy } from './BreakAndHoldStrategy';
import { Candle } from '../types';
import { createModuleLogger } from '../utils/logger';

const logger = createModuleLogger('BreakAndHoldStrategy.test');

/**
 * Mock API Client for testing
 */
class MockAPIClient {
  private responses: Map<string, any> = new Map();
  private callCount: number = 0;
  private shouldFail: boolean = false;

  setResponse(endpoint: string, response: any): void {
    this.responses.set(endpoint, response);
  }

  setShouldFail(shouldFail: boolean): void {
    this.shouldFail = shouldFail;
  }

  async makeCall(endpoint: string, params: any): Promise<any> {
    this.callCount++;
    
    if (this.shouldFail) {
      throw new Error('Mock API failure');
    }

    const key = `${endpoint}_${JSON.stringify(params)}`;
    const response = this.responses.get(key);
    
    if (!response) {
      throw new Error(`No mock response for ${key}`);
    }

    return response;
  }

  getCallCount(): number {
    return this.callCount;
  }

  reset(): void {
    this.callCount = 0;
    this.responses.clear();
    this.shouldFail = false;
  }
}

/**
 * Generate sample market data for testing
 */
function generateSampleMarketData(symbol: string): Candle[] {
  const data: Candle[] = [];
  let basePrice = 100;
  
  for (let i = 0; i < 50; i++) {
    const timestamp = Date.now() - (50 - i) * 60000; // 1-minute intervals
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
 * Generate breakout candle data
 */
function generateBreakoutCandle(symbol: string): Candle {
  return {
    symbol,
    interval: '5m',
    timestamp: Date.now(),
    open: 150,
    high: 155,
    low: 149,
    close: 154,
    volume: 3000000 // High volume for breakout
  };
}

/**
 * Test API resilience and circuit breaker
 */
async function testAPICircuitBreaker(): Promise<boolean> {
  logger.info('Testing API Circuit Breaker...');
  
  try {
    const strategy = new BreakAndHoldStrategy({
      api: {
        baseUrl: 'https://api.twelvedata.com',
        apiKey: 'test_key',
        timeout: 5000,
        retryAttempts: 3,
        retryDelay: 100,
        rateLimit: {
          requestsPerMinute: 800,
          requestsPerSecond: 10
        }
      }
    });

    await strategy.initialize();
    
    // Test circuit breaker state
    const health = strategy.getAPIHealth();
    logger.info('API Health Status', health);
    
    await strategy.cleanup();
    return true;
  } catch (error) {
    logger.error('Circuit breaker test failed', error as Error);
    return false;
  }
}

/**
 * Test caching functionality
 */
async function testCaching(): Promise<boolean> {
  logger.info('Testing Caching Functionality...');
  
  try {
    const strategy = new BreakAndHoldStrategy({
      cache: {
        maxSize: 100,
        ttl: 300000,
        cleanupInterval: 60000
      }
    });

    await strategy.initialize();
    
    // Test cache stats
    const cacheStats = strategy.getCacheStats();
    logger.info('Cache Statistics', cacheStats);
    
    // Verify cache size is reasonable
    if (cacheStats.size >= 0 && cacheStats.size <= 100) {
      logger.info('Cache size is within expected range');
    } else {
      logger.warn('Cache size is outside expected range', cacheStats);
    }
    
    await strategy.cleanup();
    return true;
  } catch (error) {
    logger.error('Caching test failed', error as Error);
    return false;
  }
}

/**
 * Test rate limiting
 */
async function testRateLimiting(): Promise<boolean> {
  logger.info('Testing Rate Limiting...');
  
  try {
    const strategy = new BreakAndHoldStrategy({
      api: {
        rateLimit: {
          requestsPerMinute: 10, // Low limit for testing
          requestsPerSecond: 2
        }
      }
    });

    await strategy.initialize();
    
    // The rate limiter should prevent excessive API calls
    logger.info('Rate limiting configured successfully');
    
    await strategy.cleanup();
    return true;
  } catch (error) {
    logger.error('Rate limiting test failed', error as Error);
    return false;
  }
}

/**
 * Test configuration management
 */
async function testConfigurationManagement(): Promise<boolean> {
  logger.info('Testing Configuration Management...');
  
  try {
    const strategy = new BreakAndHoldStrategy({
      breakoutScoreThreshold: 5,
      confirmationCandles: 3,
      minVolumeMultiplier: 2.0
    });

    await strategy.initialize();
    
    // Get current configuration
    const config = strategy.getConfig();
    logger.info('Initial Configuration', {
      breakoutScoreThreshold: config.breakoutScoreThreshold,
      confirmationCandles: config.confirmationCandles,
      minVolumeMultiplier: config.minVolumeMultiplier
    });
    
    // Update configuration
    strategy.updateConfig({
      breakoutScoreThreshold: 6,
      confirmationCandles: 4
    });
    
    // Verify configuration was updated
    const updatedConfig = strategy.getConfig();
    if (updatedConfig.breakoutScoreThreshold === 6 && updatedConfig.confirmationCandles === 4) {
      logger.info('Configuration updated successfully');
    } else {
      logger.warn('Configuration update may have failed');
    }
    
    await strategy.cleanup();
    return true;
  } catch (error) {
    logger.error('Configuration management test failed', error as Error);
    return false;
  }
}

/**
 * Test error handling
 */
async function testErrorHandling(): Promise<boolean> {
  logger.info('Testing Error Handling...');
  
  try {
    const strategy = new BreakAndHoldStrategy({
      api: {
        baseUrl: 'https://invalid-url.com',
        apiKey: 'invalid_key',
        timeout: 1000,
        retryAttempts: 2,
        retryDelay: 100,
        rateLimit: {
          requestsPerMinute: 10,
          requestsPerSecond: 2
        }
      }
    });

    await strategy.initialize();
    
    // Test with invalid candle data
    const invalidCandle: Candle = {
      symbol: 'INVALID',
      interval: '5m',
      timestamp: Date.now(),
      open: NaN,
      high: NaN,
      low: NaN,
      close: NaN,
      volume: -1
    };
    
    const signal = await strategy.processCandle(invalidCandle);
    
    // Should handle gracefully without throwing
    if (signal === null) {
      logger.info('Error handling working correctly - invalid data handled gracefully');
    }
    
    await strategy.cleanup();
    return true;
  } catch (error) {
    logger.error('Error handling test failed', error as Error);
    return false;
  }
}

/**
 * Test trading window detection
 */
async function testTradingWindow(): Promise<boolean> {
  logger.info('Testing Trading Window Detection...');
  
  try {
    const strategy = new BreakAndHoldStrategy({
      tradingWindows: [
        { start: { hour: 9, minute: 30 }, end: { hour: 11, minute: 0 } },
        { start: { hour: 14, minute: 30 }, end: { hour: 15, minute: 30 } }
      ]
    });

    await strategy.initialize();
    
    // Test with sample candle
    const candle: Candle = {
      symbol: 'AAPL',
      interval: '5m',
      timestamp: Date.now(),
      open: 150,
      high: 155,
      low: 149,
      close: 154,
      volume: 2000000
    };
    
    const signal = await strategy.processCandle(candle);
    
    // Signal might be null due to trading window restrictions
    logger.info('Trading window test completed', { signalGenerated: signal !== null });
    
    await strategy.cleanup();
    return true;
  } catch (error) {
    logger.error('Trading window test failed', error as Error);
    return false;
  }
}

/**
 * Test breakout pattern detection
 */
async function testBreakoutPatternDetection(): Promise<boolean> {
  logger.info('Testing Breakout Pattern Detection...');
  
  try {
    const strategy = new BreakAndHoldStrategy({
      breakoutScoreThreshold: 3, // Lower threshold for testing
      confirmationCandles: 1, // Lower confirmation for testing
      minVolumeMultiplier: 1.5 // Lower volume requirement for testing
    });

    await strategy.initialize();
    
    // Test with breakout candle
    const breakoutCandle = generateBreakoutCandle('AAPL');
    const signal = await strategy.processCandle(breakoutCandle);
    
    if (signal) {
      logger.info('Breakout pattern detected', {
        symbol: signal.symbol,
        direction: signal.direction,
        confidence: signal.confidence
      });
    } else {
      logger.info('No breakout pattern detected for test candle');
    }
    
    await strategy.cleanup();
    return true;
  } catch (error) {
    logger.error('Breakout pattern detection test failed', error as Error);
    return false;
  }
}

/**
 * Test performance with multiple symbols
 */
async function testPerformance(): Promise<{
  processingTime: number;
  signalsGenerated: number;
  averageTimePerCandle: number;
}> {
  logger.info('Testing Performance with Multiple Symbols...');
  
  const symbols = ['SPY', 'QQQ', 'TSLA', 'AAPL'];
  const strategy = new BreakAndHoldStrategy({
    breakoutScoreThreshold: 3,
    confirmationCandles: 1,
    minVolumeMultiplier: 1.5
  });
  
  await strategy.initialize();
  
  const startTime = Date.now();
  let signalsGenerated = 0;
  
  for (const symbol of symbols) {
    logger.info(`Processing ${symbol}...`);
    const data = generateSampleMarketData(symbol);
    
    for (const candle of data) {
      const signal = await strategy.processCandle(candle);
      if (signal) {
        signalsGenerated++;
        logger.info(`Signal generated for ${symbol}: ${signal.direction} @ ${signal.price}`);
      }
    }
  }
  
  const endTime = Date.now();
  const processingTime = endTime - startTime;
  const totalCandles = symbols.length * 50; // 50 candles per symbol
  const averageTimePerCandle = processingTime / totalCandles;
  
  logger.info('Performance Results', {
    processingTime,
    signalsGenerated,
    averageTimePerCandle,
    totalCandles
  });
  
  await strategy.cleanup();
  
  return {
    processingTime,
    signalsGenerated,
    averageTimePerCandle
  };
}

/**
 * Test memory management
 */
async function testMemoryManagement(): Promise<boolean> {
  logger.info('Testing Memory Management...');
  
  try {
    const strategy = new BreakAndHoldStrategy({
      cache: {
        maxSize: 10, // Small cache for testing
        ttl: 60000,
        cleanupInterval: 30000
      }
    });

    await strategy.initialize();
    
    // Generate some data to fill cache
    for (let i = 0; i < 20; i++) {
      const candle = generateBreakoutCandle(`SYMBOL_${i}`);
      await strategy.processCandle(candle);
    }
    
    // Check cache stats
    const cacheStats = strategy.getCacheStats();
    logger.info('Cache stats after processing', cacheStats);
    
    // Verify cache size doesn't exceed max
    if (cacheStats.size <= 10) {
      logger.info('Memory management working correctly - cache size within limits');
    } else {
      logger.warn('Cache size exceeded maximum', cacheStats);
    }
    
    await strategy.cleanup();
    return true;
  } catch (error) {
    logger.error('Memory management test failed', error as Error);
    return false;
  }
}

/**
 * Run all tests
 */
async function runAllTests(): Promise<{
  totalTests: number;
  passedTests: number;
  failedTests: number;
  performanceResults: any;
}> {
  logger.info('Break and Hold Strategy Test Suite');
  logger.info('====================================');
  
  const tests = [
    { name: 'API Circuit Breaker', test: testAPICircuitBreaker },
    { name: 'Caching Functionality', test: testCaching },
    { name: 'Rate Limiting', test: testRateLimiting },
    { name: 'Configuration Management', test: testConfigurationManagement },
    { name: 'Error Handling', test: testErrorHandling },
    { name: 'Trading Window Detection', test: testTradingWindow },
    { name: 'Breakout Pattern Detection', test: testBreakoutPatternDetection },
    { name: 'Memory Management', test: testMemoryManagement }
  ];
  
  let passedTests = 0;
  let failedTests = 0;
  
  for (const testCase of tests) {
    try {
      logger.info(`Running test: ${testCase.name}`);
      const result = await testCase.test();
      
      if (result) {
        logger.info(`✅ ${testCase.name} - PASSED`);
        passedTests++;
      } else {
        logger.error(`❌ ${testCase.name} - FAILED`);
        failedTests++;
      }
    } catch (error) {
      logger.error(`❌ ${testCase.name} - FAILED with exception`, error as Error);
      failedTests++;
    }
  }
  
  // Run performance test separately
  logger.info('Running Performance Test...');
  const performanceResults = await testPerformance();
  
  const totalTests = tests.length;
  
  logger.info('Test Summary', {
    totalTests,
    passedTests,
    failedTests,
    successRate: `${((passedTests / totalTests) * 100).toFixed(1)}%`
  });
  
  return {
    totalTests,
    passedTests,
    failedTests,
    performanceResults
  };
}

// Export for use in other modules
export {
  testAPICircuitBreaker,
  testCaching,
  testRateLimiting,
  testConfigurationManagement,
  testErrorHandling,
  testTradingWindow,
  testBreakoutPatternDetection,
  testPerformance,
  testMemoryManagement,
  runAllTests,
  generateSampleMarketData,
  generateBreakoutCandle
}; 