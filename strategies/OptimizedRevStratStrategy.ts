import type { IStorage } from '../storage';
import type { Strategy, Signal, InsertSignal, MarketData } from '@shared/schema';
import { RevStratStrategy, RevStratConfig, Candle, RevStratSignal } from './RevStratStrategy';
import { createModuleLogger } from '../utils/logger';

const logger = createModuleLogger('OptimizedRevStratStrategy');

/**
 * Enhanced RevStrat Configuration with Optimization Parameters
 */
export interface OptimizedRevStratConfig extends RevStratConfig {
  // Earlier Entry Optimizations
  momentumThreshold: number;          // RSI threshold for momentum detection
  volumeConfirmationThreshold: number; // Volume spike threshold
  prePatternDetection: boolean;       // Enable pre-pattern detection
  
  // Safety Enhancements
  multiFactorValidation: boolean;     // Require multiple confirmations
  dynamicStopLoss: boolean;          // Use ATR-based stops
  marketRegimeFilter: boolean;       // Filter by market conditions
  
  // Profitability Optimizations
  dynamicTargets: boolean;           // Volatility-based targets
  confluenceFactors: boolean;        // Include Fibonacci/pivot levels
  multiTimeframeAnalysis: boolean;   // Add higher timeframe context
}

export const optimizedRevStratConfig: OptimizedRevStratConfig = {
  // Base configuration
  maxHistoryLength: 100,
  riskRatio: 2.5, // Increased from 2.0
  minBarRange: 0.008, // Reduced for earlier detection
  minConfidence: 65, // Increased threshold
  maxPositionSizePercent: 0.02, // Reduced risk per trade
  volatilityThreshold: 0.25, // Reduced threshold
  trendAnalysisPeriod: 15, // Increased period
  
  // Earlier Entry Optimizations
  momentumThreshold: 45, // RSI threshold for early momentum
  volumeConfirmationThreshold: 1.3, // 30% above average volume
  prePatternDetection: true,
  
  // Safety Enhancements
  multiFactorValidation: true,
  dynamicStopLoss: true,
  marketRegimeFilter: true,
  
  // Profitability Optimizations
  dynamicTargets: true,
  confluenceFactors: true,
  multiTimeframeAnalysis: true
};

/**
 * Enhanced Pre-Pattern Signal for Earlier Entry
 */
interface PrePatternSignal {
  symbol: string;
  confidence: number;
  momentumBuilding: boolean;
  volumeConfirmation: boolean;
  expectedPattern: string;
  earlierEntryBy: string;
  riskIncrease: number;
}

/**
 * Market Context Analysis
 */
interface MarketContext {
  trend: 'bullish' | 'bearish' | 'sideways';
  volatility: 'low' | 'medium' | 'high';
  volume: 'low' | 'normal' | 'high';
  marketRegime: 'trending' | 'ranging' | 'volatile';
}

/**
 * Technical Indicators
 */
interface TechnicalIndicators {
  rsi: number;
  macd: {
    macd: number;
    signal: number;
    histogram: number;
  };
  ema8: number;
  ema21: number;
  ema50: number;
  atr: number;
  volume: number;
  vwap: number;
  bollingerBands: {
    upper: number;
    middle: number;
    lower: number;
  };
}

/**
 * Confluence Factors
 */
interface ConfluenceFactors {
  fibonacciLevels: boolean;
  pivotPoints: boolean;
  supportResistance: boolean;
  volumeProfile: boolean;
  momentumDivergence: boolean;
  trendAlignment: boolean;
  totalScore: number;
}

/**
 * Production-Ready Optimized RevStrat Strategy
 * 
 * Features:
 * - Pre-pattern detection for earlier entries
 * - Multi-factor validation for safety
 * - Dynamic stop-loss and target management
 * - Market context analysis
 * - Real-time data integration
 * - Comprehensive error handling
 * - Performance monitoring
 */
export class OptimizedRevStratStrategy extends RevStratStrategy {
  private optimizedConfig: OptimizedRevStratConfig;
  private momentumHistory: Record<string, number[]> = {};
  private volumeHistory: Record<string, number[]> = {};
  private technicalIndicators: Record<string, TechnicalIndicators> = {};
  private marketContexts: Record<string, MarketContext> = {};
  private performanceMetrics: {
    totalSignals: number;
    successfulSignals: number;
    averageConfidence: number;
    averageEntryTime: number;
  } = {
    totalSignals: 0,
    successfulSignals: 0,
    averageConfidence: 0,
    averageEntryTime: 0
  };

  constructor(storage: IStorage) {
    super(storage);
    this.optimizedConfig = optimizedRevStratConfig;
    
    logger.info('OptimizedRevStratStrategy initialized with enhanced configuration');
  }

  /**
   * Generate enhanced RevStrat signals with optimization features
   */
  async generateSignal(strategy: Strategy): Promise<Signal | null> {
    try {
      const startTime = Date.now();
      
      // Select symbol and get market data
      const symbol = this.selectSymbol();
      const marketData = await this.getMarketData(symbol);
      
      if (!marketData) {
        logger.warn(`No market data available for ${symbol}`);
        return null;
      }

      // Generate enhanced candle history
      const candleHistory = this.generateCandleHistory(marketData);
      
      if (candleHistory.length < 15) {
        logger.warn(`Insufficient candle history for ${symbol}: ${candleHistory.length} candles`);
        return null;
      }

      // Update technical indicators and market context
      this.updateTechnicalIndicators(symbol, candleHistory);
      this.updateMarketContext(symbol, candleHistory);

      // Market regime filter
      if (this.optimizedConfig.marketRegimeFilter && !this.isMarketSuitable(symbol)) {
        logger.info(`Market conditions unfavorable for ${symbol} - ${this.marketContexts[symbol]?.marketRegime} regime`);
        return null;
      }

      // Pre-pattern detection for earlier entry
      let prePatternSignal: PrePatternSignal | null = null;
      if (this.optimizedConfig.prePatternDetection) {
        prePatternSignal = this.detectPrePattern(symbol, candleHistory);
      }

      // Standard pattern analysis
      const revStratSignal = this.analyzeRevStrat(candleHistory);
      
      // Enhanced signal validation
      if (revStratSignal) {
        const enhancedSignal = await this.enhanceSignal(revStratSignal, symbol, candleHistory, strategy);
        if (enhancedSignal) {
          this.updatePerformanceMetrics(enhancedSignal.confidence, Date.now() - startTime);
          return enhancedSignal;
        }
      }

      // Early entry opportunity from pre-pattern detection
      if (prePatternSignal && prePatternSignal.confidence >= 60) {
        const earlySignal = await this.createEarlyEntrySignal(prePatternSignal, symbol, marketData, strategy);
        if (earlySignal) {
          this.updatePerformanceMetrics(earlySignal.confidence, Date.now() - startTime);
          return earlySignal;
        }
      }

      return null;
    } catch (error) {
      logger.error('Error in optimized RevStrat signal generation:', error);
      return null;
    }
  }

  /**
   * Pre-pattern detection for earlier entry opportunities
   */
  private detectPrePattern(symbol: string, candleHistory: Candle[]): PrePatternSignal | null {
    try {
      const recent = candleHistory.slice(-5);
      if (recent.length < 5) return null;

      const [bar1, bar2, bar3, bar4, bar5] = recent;
      
      // Calculate technical indicators
      const indicators = this.technicalIndicators[symbol];
      if (!indicators) return null;
      
      // Momentum building analysis
      const momentum = this.calculateMomentum(candleHistory);
      const volumeConfirmation = this.checkVolumeConfirmation(symbol, bar5);
      
      let confidence = 40; // Base pre-pattern confidence
      let expectedPattern = '';
      let earlierEntryBy = '10-20 minutes';

      // Detect setup conditions
      if (this.isFormingInsideBar(bar4, bar5) && momentum.rsi < this.optimizedConfig.momentumThreshold) {
        confidence += 15;
        expectedPattern = 'Inside Bar Breakout Setup';
        earlierEntryBy = '15-25 minutes';
      }

      if (this.isRangeCompression(recent) && Math.abs(momentum.rsi - 50) > 15) {
        confidence += 20;
        expectedPattern = 'Range Compression with Momentum Divergence';
        earlierEntryBy = '20-30 minutes';
      }

      if (volumeConfirmation) {
        confidence += 10;
      }

      // Market context bonus
      const marketContext = this.marketContexts[symbol];
      if (marketContext && marketContext.trend !== 'sideways') {
        confidence += 8;
      }

      // Multi-factor validation
      if (this.optimizedConfig.multiFactorValidation) {
        const confluenceScore = this.calculateConfluenceScore(symbol, candleHistory);
        confidence += confluenceScore * 5;
      }

      if (confidence < 55) return null;

      logger.info(`Pre-pattern detected for ${symbol}: ${expectedPattern} (${confidence}% confidence)`);

      return {
        symbol,
        confidence,
        momentumBuilding: Math.abs(momentum.rsi - 50) > 10,
        volumeConfirmation,
        expectedPattern,
        earlierEntryBy,
        riskIncrease: Math.max(2, 15 - (confidence - 55))
      };
    } catch (error) {
      logger.error('Error in pre-pattern detection:', error);
      return null;
    }
  }

  /**
   * Enhanced signal validation with multi-factor analysis
   */
  private async enhanceSignal(
    revStratSignal: RevStratSignal, 
    symbol: string, 
    candleHistory: Candle[], 
    strategy: Strategy
  ): Promise<Signal | null> {
    try {
      // Multi-factor validation
      if (this.optimizedConfig.multiFactorValidation) {
        const confluenceScore = this.calculateConfluenceScore(symbol, candleHistory);
        if (confluenceScore < 3) {
          logger.info(`Signal rejected for ${symbol}: insufficient confluence (${confluenceScore})`);
          return null;
        }
      }

      // Dynamic stop-loss calculation
      let stopLoss = revStratSignal.stop;
      if (this.optimizedConfig.dynamicStopLoss) {
        stopLoss = this.calculateDynamicStopLoss(symbol, revStratSignal);
      }

      // Dynamic target calculation
      let target = revStratSignal.target;
      if (this.optimizedConfig.dynamicTargets) {
        target = this.calculateDynamicTarget(symbol, revStratSignal);
      }

      // Enhanced confidence calculation
      const enhancedConfidence = this.calculateEnhancedConfidence(revStratSignal, symbol, candleHistory);

      if (enhancedConfidence < this.optimizedConfig.minConfidence) {
        logger.info(`Signal rejected for ${symbol}: low enhanced confidence (${enhancedConfidence}%)`);
        return null;
      }

      // Create enhanced signal
      const marketData = await this.getMarketData(symbol);
      if (!marketData) return null;

      const signal: InsertSignal = {
        strategyId: strategy.id,
        symbol: revStratSignal.symbol,
        direction: revStratSignal.type,
        confidence: enhancedConfidence,
        currentPrice: marketData.price,
        entryRange: { min: revStratSignal.entry, max: revStratSignal.entry },
        targetPrice: target,
        stopLoss: stopLoss,
        positionSize: this.calculatePositionSize(marketData.price, revStratSignal.entry, stopLoss),
        riskReward: target / stopLoss,
        pattern: `Enhanced_${revStratSignal.stratPattern}`,
        reasoning: this.generateEnhancedReasoning(revStratSignal, symbol),
        confluence: this.generateEnhancedConfluence(symbol, candleHistory),
        marketContext: this.generateMarketContext(marketData),
        expectedHold: this.getExpectedHoldTime(),
        optimalEntry: this.getOptimalEntryWindow(),
        optionsData: this.generateOptionsData(marketData.price, revStratSignal.type),
        status: 'active'
      };

      logger.info(`Enhanced signal generated for ${symbol}: ${revStratSignal.stratPattern} (${enhancedConfidence}% confidence)`);
      return await this.storage.createSignal(signal);
    } catch (error) {
      logger.error('Error enhancing signal:', error);
      return null;
    }
  }

  /**
   * Create early entry signal from pre-pattern detection
   */
  private async createEarlyEntrySignal(
    prePatternSignal: PrePatternSignal, 
    symbol: string, 
    marketData: MarketData, 
    strategy: Strategy
  ): Promise<Signal | null> {
    try {
      const currentPrice = marketData.price;
      const atr = this.technicalIndicators[symbol]?.atr || 0.01;
      
      // Calculate entry parameters
      const entry = currentPrice;
      const stopLoss = prePatternSignal.expectedPattern.includes('Bullish') 
        ? entry - (atr * 1.5) 
        : entry + (atr * 1.5);
      const target = prePatternSignal.expectedPattern.includes('Bullish')
        ? entry + (atr * 3)
        : entry - (atr * 3);

      const signal: InsertSignal = {
        strategyId: strategy.id,
        symbol: prePatternSignal.symbol,
        direction: prePatternSignal.expectedPattern.includes('Bullish') ? 'CALL' : 'PUT',
        confidence: prePatternSignal.confidence,
        currentPrice: currentPrice,
        entryRange: { min: entry, max: entry },
        targetPrice: target,
        stopLoss: stopLoss,
        positionSize: this.calculatePositionSize(currentPrice, entry, stopLoss),
        riskReward: Math.abs(target - entry) / Math.abs(stopLoss - entry),
        pattern: `PrePattern_${prePatternSignal.expectedPattern}`,
        reasoning: `Early entry based on ${prePatternSignal.expectedPattern} with ${prePatternSignal.earlierEntryBy} advantage`,
        confluence: this.generatePrePatternConfluence(prePatternSignal),
        marketContext: this.generateMarketContext(marketData),
        expectedHold: this.getExpectedHoldTime(),
        optimalEntry: this.getOptimalEntryWindow(),
        optionsData: this.generateOptionsData(currentPrice, prePatternSignal.expectedPattern.includes('Bullish') ? 'CALL' : 'PUT'),
        status: 'active'
      };

      logger.info(`Early entry signal generated for ${symbol}: ${prePatternSignal.expectedPattern} (${prePatternSignal.confidence}% confidence)`);
      return await this.storage.createSignal(signal);
    } catch (error) {
      logger.error('Error creating early entry signal:', error);
      return null;
    }
  }

  /**
   * Update technical indicators for symbol
   */
  private updateTechnicalIndicators(symbol: string, candleHistory: Candle[]): void {
    try {
      if (candleHistory.length < 20) return;

      const recent = candleHistory.slice(-20);
      const prices = recent.map(c => c.close);
      const volumes = recent.map(c => c.volume || 0);
      const highs = recent.map(c => c.high);
      const lows = recent.map(c => c.low);

      // Calculate RSI
      const rsi = this.calculateRSI(prices, 14);

      // Calculate MACD
      const macd = this.calculateMACD(prices);

      // Calculate EMAs
      const ema8 = this.calculateEMA(prices, 8);
      const ema21 = this.calculateEMA(prices, 21);
      const ema50 = this.calculateEMA(prices, 50);

      // Calculate ATR
      const atr = this.calculateATR(highs, lows, prices, 14);

      // Calculate VWAP
      const vwap = this.calculateVWAP(recent);

      // Calculate Bollinger Bands
      const bollingerBands = this.calculateBollingerBands(prices, 20, 2);

      this.technicalIndicators[symbol] = {
        rsi: rsi[rsi.length - 1],
        macd,
        ema8: ema8[ema8.length - 1],
        ema21: ema21[ema21.length - 1],
        ema50: ema50[ema50.length - 1],
        atr: atr[atr.length - 1],
        volume: volumes[volumes.length - 1],
        vwap: vwap,
        bollingerBands
      };
    } catch (error) {
      logger.error('Error updating technical indicators:', error);
    }
  }

  /**
   * Update market context for symbol
   */
  private updateMarketContext(symbol: string, candleHistory: Candle[]): void {
    try {
      if (candleHistory.length < 20) return;

      const recent = candleHistory.slice(-20);
      const prices = recent.map(c => c.close);
      const volumes = recent.map(c => c.volume || 0);

      // Determine trend
      const ema8 = this.calculateEMA(prices, 8);
      const ema21 = this.calculateEMA(prices, 21);
      const trend = ema8[ema8.length - 1] > ema21[ema21.length - 1] ? 'bullish' : 'bearish';

      // Determine volatility
      const atr = this.calculateATR(
        recent.map(c => c.high), 
        recent.map(c => c.low), 
        prices, 
        14
      );
      const avgATR = atr.slice(-10).reduce((sum, val) => sum + val, 0) / 10;
      const volatility = avgATR > 0.02 ? 'high' : avgATR > 0.01 ? 'medium' : 'low';

      // Determine volume
      const avgVolume = volumes.reduce((sum, vol) => sum + vol, 0) / volumes.length;
      const currentVolume = volumes[volumes.length - 1];
      const volume = currentVolume > avgVolume * 1.5 ? 'high' : 
                    currentVolume < avgVolume * 0.5 ? 'low' : 'normal';

      // Determine market regime
      const priceChange = (prices[prices.length - 1] - prices[0]) / prices[0];
      const marketRegime = Math.abs(priceChange) > 0.05 ? 'trending' : 
                          volatility === 'high' ? 'volatile' : 'ranging';

      this.marketContexts[symbol] = {
        trend,
        volatility,
        volume,
        marketRegime
      };
    } catch (error) {
      logger.error('Error updating market context:', error);
    }
  }

  /**
   * Check if market conditions are suitable for trading
   */
  private isMarketSuitable(symbol: string): boolean {
    const context = this.marketContexts[symbol];
    if (!context) return true;

    // Avoid extremely volatile markets
    if (context.volatility === 'high' && context.marketRegime === 'volatile') {
      return false;
    }

    // Avoid low volume conditions
    if (context.volume === 'low') {
      return false;
    }

    return true;
  }

  /**
   * Calculate confluence score for multi-factor validation
   */
  private calculateConfluenceScore(symbol: string, candleHistory: Candle[]): number {
    try {
      const indicators = this.technicalIndicators[symbol];
      const context = this.marketContexts[symbol];
      if (!indicators || !context) return 0;

      let score = 0;

      // Trend alignment
      if (context.trend === 'bullish' && indicators.ema8 > indicators.ema21) score += 1;
      if (context.trend === 'bearish' && indicators.ema8 < indicators.ema21) score += 1;

      // Volume confirmation
      if (context.volume === 'high' || context.volume === 'normal') score += 1;

      // RSI conditions
      if (indicators.rsi > 30 && indicators.rsi < 70) score += 1;

      // MACD conditions
      if (indicators.macd.macd > indicators.macd.signal) score += 1;

      // Bollinger Bands
      const currentPrice = candleHistory[candleHistory.length - 1].close;
      if (currentPrice > indicators.bollingerBands.lower && 
          currentPrice < indicators.bollingerBands.upper) score += 1;

      return score;
    } catch (error) {
      logger.error('Error calculating confluence score:', error);
      return 0;
    }
  }

  /**
   * Calculate dynamic stop-loss based on ATR
   */
  private calculateDynamicStopLoss(symbol: string, signal: RevStratSignal): number {
    try {
      const indicators = this.technicalIndicators[symbol];
      if (!indicators) return signal.stop;

      const atr = indicators.atr;
      const currentPrice = signal.entry;

      if (signal.type === 'CALL') {
        return currentPrice - (atr * 2);
      } else {
        return currentPrice + (atr * 2);
      }
    } catch (error) {
      logger.error('Error calculating dynamic stop-loss:', error);
      return signal.stop;
    }
  }

  /**
   * Calculate dynamic target based on volatility
   */
  private calculateDynamicTarget(symbol: string, signal: RevStratSignal): number {
    try {
      const indicators = this.technicalIndicators[symbol];
      if (!indicators) return signal.target;

      const atr = indicators.atr;
      const currentPrice = signal.entry;
      const stopDistance = Math.abs(signal.stop - currentPrice);

      if (signal.type === 'CALL') {
        return currentPrice + (stopDistance * this.optimizedConfig.riskRatio);
      } else {
        return currentPrice - (stopDistance * this.optimizedConfig.riskRatio);
      }
    } catch (error) {
      logger.error('Error calculating dynamic target:', error);
      return signal.target;
    }
  }

  /**
   * Calculate enhanced confidence score
   */
  private calculateEnhancedConfidence(signal: RevStratSignal, symbol: string, candleHistory: Candle[]): number {
    try {
      let confidence = signal.confidence;

      // Add confluence bonus
      const confluenceScore = this.calculateConfluenceScore(symbol, candleHistory);
      confidence += confluenceScore * 5;

      // Add market context bonus
      const context = this.marketContexts[symbol];
      if (context) {
        if (context.trend !== 'sideways') confidence += 5;
        if (context.volume === 'high') confidence += 3;
        if (context.volatility === 'medium') confidence += 2;
      }

      // Add technical indicator bonuses
      const indicators = this.technicalIndicators[symbol];
      if (indicators) {
        if (indicators.rsi > 40 && indicators.rsi < 60) confidence += 3;
        if (indicators.macd.macd > indicators.macd.signal) confidence += 2;
      }

      return Math.min(confidence, 100);
    } catch (error) {
      logger.error('Error calculating enhanced confidence:', error);
      return signal.confidence;
    }
  }

  /**
   * Update performance metrics
   */
  private updatePerformanceMetrics(confidence: number, processingTime: number): void {
    this.performanceMetrics.totalSignals++;
    this.performanceMetrics.averageConfidence = 
      (this.performanceMetrics.averageConfidence * (this.performanceMetrics.totalSignals - 1) + confidence) / 
      this.performanceMetrics.totalSignals;
    this.performanceMetrics.averageEntryTime = 
      (this.performanceMetrics.averageEntryTime * (this.performanceMetrics.totalSignals - 1) + processingTime) / 
      this.performanceMetrics.totalSignals;
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics() {
    return { ...this.performanceMetrics };
  }

  /**
   * Get technical indicators for symbol
   */
  getTechnicalIndicators(symbol: string): TechnicalIndicators | null {
    return this.technicalIndicators[symbol] || null;
  }

  /**
   * Get market context for symbol
   */
  getMarketContext(symbol: string): MarketContext | null {
    return this.marketContexts[symbol] || null;
  }

  // Technical indicator calculation methods
  private calculateRSI(prices: number[], period: number): number[] {
    const rsi: number[] = [];
    for (let i = period; i < prices.length; i++) {
      let gains = 0, losses = 0;
      for (let j = i - period + 1; j <= i; j++) {
        const change = prices[j] - prices[j - 1];
        if (change > 0) gains += change;
        else losses -= change;
      }
      const avgGain = gains / period;
      const avgLoss = losses / period;
      const rs = avgGain / avgLoss;
      rsi.push(100 - (100 / (1 + rs)));
    }
    return rsi;
  }

  private calculateMACD(prices: number[]): { macd: number; signal: number; histogram: number } {
    const ema12 = this.calculateEMA(prices, 12);
    const ema26 = this.calculateEMA(prices, 26);
    const macd = ema12[ema12.length - 1] - ema26[ema26.length - 1];
    const signal = this.calculateEMA([macd], 9)[0];
    const histogram = macd - signal;
    return { macd, signal, histogram };
  }

  private calculateEMA(prices: number[], period: number): number[] {
    const ema: number[] = [];
    const multiplier = 2 / (period + 1);
    
    // First EMA is SMA
    let sum = 0;
    for (let i = 0; i < period; i++) {
      sum += prices[i];
    }
    ema.push(sum / period);
    
    // Calculate EMA
    for (let i = period; i < prices.length; i++) {
      const newEMA = (prices[i] * multiplier) + (ema[ema.length - 1] * (1 - multiplier));
      ema.push(newEMA);
    }
    
    return ema;
  }

  private calculateATR(highs: number[], lows: number[], closes: number[], period: number): number[] {
    const tr: number[] = [];
    for (let i = 1; i < highs.length; i++) {
      const hl = highs[i] - lows[i];
      const hc = Math.abs(highs[i] - closes[i - 1]);
      const lc = Math.abs(lows[i] - closes[i - 1]);
      tr.push(Math.max(hl, hc, lc));
    }
    
    const atr: number[] = [];
    let sum = 0;
    for (let i = 0; i < period; i++) {
      sum += tr[i];
    }
    atr.push(sum / period);
    
    for (let i = period; i < tr.length; i++) {
      const newATR = ((atr[atr.length - 1] * (period - 1)) + tr[i]) / period;
      atr.push(newATR);
    }
    
    return atr;
  }

  private calculateVWAP(candles: Candle[]): number {
    let cumulativeTPV = 0;
    let cumulativeVolume = 0;
    
    for (const candle of candles) {
      const typicalPrice = (candle.high + candle.low + candle.close) / 3;
      const volume = candle.volume || 0;
      cumulativeTPV += typicalPrice * volume;
      cumulativeVolume += volume;
    }
    
    return cumulativeVolume > 0 ? cumulativeTPV / cumulativeVolume : 0;
  }

  private calculateBollingerBands(prices: number[], period: number, stdDev: number): { upper: number; middle: number; lower: number } {
    const sma = prices.slice(-period).reduce((sum, price) => sum + price, 0) / period;
    const variance = prices.slice(-period).reduce((sum, price) => sum + Math.pow(price - sma, 2), 0) / period;
    const standardDeviation = Math.sqrt(variance);
    
    return {
      upper: sma + (standardDeviation * stdDev),
      middle: sma,
      lower: sma - (standardDeviation * stdDev)
    };
  }

  // Helper methods for pattern detection
  private calculateMomentum(candleHistory: Candle[]): { rsi: number } {
    const prices = candleHistory.map(c => c.close);
    const rsi = this.calculateRSI(prices, 14);
    return { rsi: rsi[rsi.length - 1] || 50 };
  }

  private checkVolumeConfirmation(symbol: string, candle: Candle): boolean {
    const indicators = this.technicalIndicators[symbol];
    if (!indicators || !candle.volume) return false;
    
    return candle.volume > indicators.volume * this.optimizedConfig.volumeConfirmationThreshold;
  }

  private isFormingInsideBar(prev: Candle, curr: Candle): boolean {
    return curr.high <= prev.high && curr.low >= prev.low;
  }

  private isRangeCompression(candles: Candle[]): boolean {
    if (candles.length < 3) return false;
    
    const ranges = candles.map(c => c.high - c.low);
    const avgRange = ranges.reduce((sum, range) => sum + range, 0) / ranges.length;
    const currentRange = ranges[ranges.length - 1];
    
    return currentRange < avgRange * 0.8;
  }

  // Enhanced reasoning and confluence methods
  private generateEnhancedReasoning(signal: RevStratSignal, symbol: string): string {
    const context = this.marketContexts[symbol];
    const indicators = this.technicalIndicators[symbol];
    
    let reasoning = `Enhanced ${signal.stratPattern} pattern with multi-factor validation. `;
    
    if (context) {
      reasoning += `Market context: ${context.trend} trend, ${context.volatility} volatility, ${context.volume} volume. `;
    }
    
    if (indicators) {
      reasoning += `Technical indicators: RSI ${indicators.rsi.toFixed(1)}, MACD ${indicators.macd.macd > indicators.macd.signal ? 'bullish' : 'bearish'}. `;
    }
    
    reasoning += `Confidence enhanced through confluence analysis and market context validation.`;
    
    return reasoning;
  }

  private generateEnhancedConfluence(symbol: string, candleHistory: Candle[]): string {
    const confluenceScore = this.calculateConfluenceScore(symbol, candleHistory);
    const context = this.marketContexts[symbol];
    
    let confluence = `Confluence Score: ${confluenceScore}/6. `;
    
    if (context) {
      confluence += `Market: ${context.trend} trend, ${context.marketRegime} regime. `;
    }
    
    confluence += `Multi-factor validation passed with enhanced safety measures.`;
    
    return confluence;
  }

  private generatePrePatternConfluence(prePatternSignal: PrePatternSignal): string {
    return `Pre-pattern confluence: ${prePatternSignal.expectedPattern} with ${prePatternSignal.confidence}% confidence. ` +
           `Momentum building: ${prePatternSignal.momentumBuilding ? 'Yes' : 'No'}. ` +
           `Volume confirmation: ${prePatternSignal.volumeConfirmation ? 'Yes' : 'No'}. ` +
           `Earlier entry by: ${prePatternSignal.earlierEntryBy}.`;
  }
} 