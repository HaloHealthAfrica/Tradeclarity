import { BaseStrategy } from './BaseStrategy';
import { Candle, TradeSignal } from '../types';
import { createModuleLogger } from '../utils/logger';
import { calculateEMA, calculateRSI, calculateMACD } from '../utils/indicators';

const logger = createModuleLogger('ABCDFibinachiStrategy');

/**
 * ABCD Fibonacci Pattern Point Interface
 */
export interface ABCDPoint {
  index: number;
  price: number;
  timestamp: number;
  type: 'high' | 'low';
}

/**
 * ABCD Pattern Structure
 */
export interface ABCDPattern {
  A: ABCDPoint;
  B: ABCDPoint;
  C: ABCDPoint;
  D: ABCDPoint;
  abLength: number;
  bcLength: number;
  cdLength: number;
  abRatio: number;
  cdRatio: number;
  fibonacciTargets: {
    ext127: number;
    ext161: number;
    ext200: number;
    ext261: number;
  };
  confluence: boolean;
  strength: number;
  direction: 'bullish' | 'bearish';
  trendAlignment: boolean;
  volumeConfirmation: boolean;
  technicalConfirmation: boolean;
}

/**
 * Fibonacci Levels Interface
 */
export interface FibonacciLevels {
  retracement: {
    r236: number;
    r382: number;
    r500: number;
    r618: number;
    r786: number;
  };
  extension: {
    e127: number;
    e161: number;
    e200: number;
    e261: number;
    e314: number;
  };
}

/**
 * Technical Confirmation Patterns
 */
export interface TechnicalPatterns {
  engulfing: boolean;
  doji: boolean;
  hammer: boolean;
  shootingStar: boolean;
  headAndShoulders: boolean;
  doubleTop: boolean;
  doubleBottom: boolean;
  triangle: boolean;
  wedge: boolean;
}

/**
 * ABCD Fibonacci Strategy Configuration
 */
export interface ABCDFibinachiConfig {
  // Pattern Detection
  minSwingSize: number;        // Minimum swing size in %
  maxSwingLookback: number;    // Max bars to look back for swings
  fibTolerance: number;        // Tolerance for Fibonacci levels
  abcdRatioMin: number;        // Minimum AB/CD ratio
  abcdRatioMax: number;        // Maximum AB/CD ratio
  bcRetracementMin: number;    // Minimum BC retracement
  bcRetracementMax: number;    // Maximum BC retracement
  
  // Confluence Requirements
  confluenceRequired: number;  // Required confluence factors
  volumeConfirmation: boolean; // Require volume confirmation
  trendAlignment: boolean;     // Require trend alignment
  technicalConfirmation: boolean; // Require technical pattern confirmation
  
  // Risk Management
  maxRiskPerTrade: number;     // Maximum risk per trade (%)
  stopLossBuffer: number;      // Buffer for stop loss placement
  takeProfitMultiplier: number; // Take profit multiplier
  
  // Technical Analysis
  emaPeriods: number[];        // EMA periods for trend analysis
  rsiPeriod: number;           // RSI period
  rsiOverbought: number;       // RSI overbought level
  rsiOversold: number;         // RSI oversold level
  macdFast: number;            // MACD fast period
  macdSlow: number;            // MACD slow period
  macdSignal: number;          // MACD signal period
  
  // Volume Analysis
  volumeSMA: number;           // Volume SMA period
  volumeThreshold: number;     // Volume confirmation threshold
}

/**
 * ABCD Fibonacci Strategy - Integrated Confluence Trading
 * 
 * This strategy combines three ABCD Fibonacci approaches:
 * 1. Primary ABCD Fibonacci pattern detection
 * 2. Advanced technical pattern confirmation
 * 3. Multi-timeframe confluence analysis
 * 
 * Features:
 * - Harmonic pattern recognition with Fibonacci extensions
 * - Technical pattern confirmation (engulfing, head & shoulders, etc.)
 * - Volume and momentum analysis
 * - Trend alignment validation
 * - Dynamic risk management
 * - Multi-timeframe confluence
 */
export class ABCDFibinachiStrategy extends BaseStrategy {
  public name = 'ABCD fibinachi';
  public symbols: string[] = ['SPY', 'QQQ', 'TSLA', 'AAPL', 'NVDA', 'MSFT', 'AMD', 'GOOGL'];
  public intervals: string[] = ['5m', '15m', '1h', '4h'];
  
  private config: ABCDFibinachiConfig;
  private priceHistory: Map<string, Candle[]> = new Map();
  private patternHistory: Map<string, ABCDPattern[]> = new Map();
  private activePatterns: Map<string, ABCDPattern> = new Map();
  
  constructor(parameters: Record<string, any> = {}) {
    super(parameters);
    
    // Default configuration
    this.config = {
      // Pattern Detection
      minSwingSize: 0.5,
      maxSwingLookback: 100,
      fibTolerance: 0.02,
      abcdRatioMin: 0.618,
      abcdRatioMax: 1.618,
      bcRetracementMin: 0.382,
      bcRetracementMax: 0.886,
      
      // Confluence Requirements
      confluenceRequired: 4,
      volumeConfirmation: true,
      trendAlignment: true,
      technicalConfirmation: true,
      
      // Risk Management
      maxRiskPerTrade: 0.02, // 2% risk per trade
      stopLossBuffer: 0.005, // 0.5% buffer
      takeProfitMultiplier: 1.5,
      
      // Technical Analysis
      emaPeriods: [20, 50, 100, 200],
      rsiPeriod: 14,
      rsiOverbought: 70,
      rsiOversold: 30,
      macdFast: 12,
      macdSlow: 26,
      macdSignal: 9,
      
      // Volume Analysis
      volumeSMA: 20,
      volumeThreshold: 1.2
    };
    
    // Override with custom parameters
    Object.assign(this.config, parameters);
  }

  public async processCandle(candle: Candle): Promise<TradeSignal | null> {
    try {
      // Update price history
      this.updatePriceHistory(candle);
      
      // Detect ABCD patterns
      const pattern = this.detectABCDPattern(candle);
      if (!pattern) return null;
      
      // Validate pattern confluence
      if (!this.validatePatternConfluence(pattern, candle)) return null;
      
      // Generate trade signal
      const signal = this.generateTradeSignal(pattern, candle);
      
      if (signal && this.validateSignal(signal)) {
        this.logger.info('ABCD Fibonacci signal generated', {
          symbol: signal.symbol,
          direction: signal.direction,
          confidence: signal.confidence,
          patternStrength: pattern.strength
        });
        
        // Track active pattern
        this.activePatterns.set(candle.symbol, pattern);
        
        return signal;
      }
      
      return null;
    } catch (error) {
      this.logger.error('Error processing ABCD Fibonacci candle', error as Error);
      return null;
    }
  }

  /**
   * Update price history for pattern detection
   */
  private updatePriceHistory(candle: Candle): void {
    if (!this.priceHistory.has(candle.symbol)) {
      this.priceHistory.set(candle.symbol, []);
    }
    
    const history = this.priceHistory.get(candle.symbol)!;
    history.push(candle);
    
    // Keep only recent data for performance
    if (history.length > this.config.maxSwingLookback) {
      history.splice(0, history.length - this.config.maxSwingLookback);
    }
  }

  /**
   * Detect ABCD Fibonacci patterns
   */
  private detectABCDPattern(candle: Candle): ABCDPattern | null {
    const history = this.priceHistory.get(candle.symbol);
    if (!history || history.length < 50) return null;

    const swings = this.identifySwingPoints(history);
    if (swings.length < 4) return null;

    // Look for ABCD patterns in recent swing points
    for (let i = swings.length - 4; i >= Math.max(0, swings.length - 20); i--) {
      const A = swings[i];
      const B = swings[i + 1];
      const C = swings[i + 2];
      const D = swings[i + 3];

      const pattern = this.validateABCDPattern(A, B, C, D, history);
      if (pattern && pattern.confluence && pattern.strength >= 75) {
        return pattern;
      }
    }

    return null;
  }

  /**
   * Identify swing points in price data
   */
  private identifySwingPoints(data: Candle[]): ABCDPoint[] {
    const swings: ABCDPoint[] = [];
    const lookback = 5; // Bars on each side for swing confirmation

    for (let i = lookback; i < data.length - lookback; i++) {
      const current = data[i];
      const isHigh = this.isSwingHigh(data, i, lookback);
      const isLow = this.isSwingLow(data, i, lookback);

      if (isHigh) {
        swings.push({
          index: i,
          price: current.high,
          timestamp: current.timestamp,
          type: 'high'
        });
      } else if (isLow) {
        swings.push({
          index: i,
          price: current.low,
          timestamp: current.timestamp,
          type: 'low'
        });
      }
    }

    return swings;
  }

  /**
   * Check if point is a swing high
   */
  private isSwingHigh(data: Candle[], index: number, lookback: number): boolean {
    const currentHigh = data[index].high;
    for (let i = index - lookback; i <= index + lookback; i++) {
      if (i < 0 || i >= data.length) continue;
      if (i !== index && data[i].high >= currentHigh) {
        return false;
      }
    }
    return true;
  }

  /**
   * Check if point is a swing low
   */
  private isSwingLow(data: Candle[], index: number, lookback: number): boolean {
    const currentLow = data[index].low;
    for (let i = index - lookback; i <= index + lookback; i++) {
      if (i < 0 || i >= data.length) continue;
      if (i !== index && data[i].low <= currentLow) {
        return false;
      }
    }
    return true;
  }

  /**
   * Validate ABCD pattern structure and ratios
   */
  private validateABCDPattern(A: ABCDPoint, B: ABCDPoint, C: ABCDPoint, D: ABCDPoint, data: Candle[]): ABCDPattern | null {
    // Calculate pattern measurements
    const abLength = Math.abs(B.price - A.price);
    const bcLength = Math.abs(C.price - B.price);
    const cdLength = Math.abs(D.price - C.price);

    // Check minimum swing size
    const minSwing = A.price * (this.config.minSwingSize / 100);
    if (abLength < minSwing || cdLength < minSwing) return null;

    // Calculate ratios
    const abRatio = abLength;
    const cdRatio = cdLength;
    const bcRetracementRatio = bcLength / abLength;

    // Validate BC retracement
    if (bcRetracementRatio < this.config.bcRetracementMin || bcRetracementRatio > this.config.bcRetracementMax) {
      return null;
    }

    // Calculate AB/CD ratio
    const abcdRatio = cdLength / abLength;
    if (abcdRatio < this.config.abcdRatioMin || abcdRatio > this.config.abcdRatioMax) {
      return null;
    }

    // Determine pattern direction
    const direction: 'bullish' | 'bearish' = (A.price < B.price) ? 'bullish' : 'bearish';

    // Calculate Fibonacci targets
    const fibonacciTargets = this.calculateFibonacciTargets(A, B, C, D, direction);

    // Check Fibonacci confluence
    const fibonacciMatch = this.checkFibonacciConfluence(D.price, fibonacciTargets);

    // Calculate technical indicators
    const emaData = this.calculateEMAs(data, D.index);
    const rsi = this.calculateRSI(data, D.index);
    const macd = this.calculateMACD(data, D.index);

    // Calculate confluence and strength
    const confluenceFactors = this.calculateConfluence(A, B, C, D, fibonacciTargets, emaData, rsi, macd, data);
    const confluence = confluenceFactors.count >= this.config.confluenceRequired;
    const strength = Math.min(95, confluenceFactors.score);

    if (!confluence || strength < 70) return null;

    return {
      A, B, C, D,
      abLength,
      bcLength,
      cdLength,
      abRatio,
      cdRatio,
      fibonacciTargets,
      confluence,
      strength,
      direction,
      trendAlignment: confluenceFactors.trendAlignment,
      volumeConfirmation: confluenceFactors.volumeConfirmation,
      technicalConfirmation: confluenceFactors.technicalConfirmation
    };
  }

  /**
   * Calculate Fibonacci extension targets
   */
  private calculateFibonacciTargets(A: ABCDPoint, B: ABCDPoint, C: ABCDPoint, D: ABCDPoint, direction: 'bullish' | 'bearish'): ABCDPattern['fibonacciTargets'] {
    const abRange = B.price - A.price;
    const bcRange = C.price - B.price;
    
    // Calculate extension levels based on BC retracement
    const bcRetracement = Math.abs(bcRange) / Math.abs(abRange);
    
    let extensionLevel = 1.618; // Default to 161.8%
    
    if (bcRetracement <= 0.618) {
      extensionLevel = 1.618;
    } else if (bcRetracement <= 0.786) {
      extensionLevel = 1.27;
    } else if (bcRetracement <= 0.886) {
      extensionLevel = 1.0;
    }
    
    const cdRange = bcRange * extensionLevel;
    const dPrice = direction === 'bullish' ? C.price + cdRange : C.price - cdRange;
    
    return {
      ext127: dPrice * 1.27,
      ext161: dPrice * 1.618,
      ext200: dPrice * 2.0,
      ext261: dPrice * 2.618
    };
  }

  /**
   * Check Fibonacci confluence
   */
  private checkFibonacciConfluence(price: number, targets: ABCDPattern['fibonacciTargets']): boolean {
    const tolerance = price * this.config.fibTolerance;
    
    return Object.values(targets).some(target => 
      Math.abs(price - target) <= tolerance
    );
  }

  /**
   * Calculate EMAs for trend analysis
   */
  private calculateEMAs(data: Candle[], index: number): { [key: number]: number } {
    const emas: { [key: number]: number } = {};
    
    for (const period of this.config.emaPeriods) {
      if (index >= period - 1) {
        const prices = data.slice(index - period + 1, index + 1).map(c => c.close);
        emas[period] = calculateEMA(prices, period);
      }
    }
    
    return emas;
  }

  /**
   * Calculate RSI
   */
  private calculateRSI(data: Candle[], index: number): number {
    if (index < this.config.rsiPeriod) return 50;
    
    const prices = data.slice(index - this.config.rsiPeriod + 1, index + 1).map(c => c.close);
    return calculateRSI(prices, this.config.rsiPeriod);
  }

  /**
   * Calculate MACD
   */
  private calculateMACD(data: Candle[], index: number): { macd: number; signal: number; histogram: number } {
    if (index < this.config.macdSlow) return { macd: 0, signal: 0, histogram: 0 };
    
    const prices = data.slice(index - this.config.macdSlow + 1, index + 1).map(c => c.close);
    return calculateMACD(prices, this.config.macdFast, this.config.macdSlow, this.config.macdSignal);
  }

  /**
   * Calculate confluence factors
   */
  private calculateConfluence(
    A: ABCDPoint, 
    B: ABCDPoint, 
    C: ABCDPoint, 
    D: ABCDPoint, 
    fibonacciTargets: ABCDPattern['fibonacciTargets'],
    emaData: { [key: number]: number },
    rsi: number,
    macd: { macd: number; signal: number; histogram: number },
    data: Candle[]
  ): {
    count: number;
    score: number;
    trendAlignment: boolean;
    volumeConfirmation: boolean;
    technicalConfirmation: boolean;
  } {
    let count = 0;
    let score = 0;
    
    // 1. Fibonacci confluence (weight: 3)
    if (this.checkFibonacciConfluence(D.price, fibonacciTargets)) {
      count++;
      score += 30;
    }
    
    // 2. Trend alignment (weight: 2)
    const trendAlignment = this.checkTrendAlignment(emaData, A, B, C, D);
    if (trendAlignment) {
      count++;
      score += 20;
    }
    
    // 3. Volume confirmation (weight: 2)
    const volumeConfirmation = this.checkVolumeConfirmation(data, D.index);
    if (volumeConfirmation) {
      count++;
      score += 20;
    }
    
    // 4. Technical pattern confirmation (weight: 2)
    const technicalConfirmation = this.checkTechnicalPatterns(data, D.index);
    if (technicalConfirmation) {
      count++;
      score += 20;
    }
    
    // 5. RSI confirmation (weight: 1)
    const rsiConfirmation = this.checkRSIConfirmation(rsi, A, B, C, D);
    if (rsiConfirmation) {
      count++;
      score += 10;
    }
    
    // 6. MACD confirmation (weight: 1)
    const macdConfirmation = this.checkMACDConfirmation(macd, A, B, C, D);
    if (macdConfirmation) {
      count++;
      score += 10;
    }
    
    return {
      count,
      score,
      trendAlignment,
      volumeConfirmation,
      technicalConfirmation
    };
  }

  /**
   * Check trend alignment with EMAs
   */
  private checkTrendAlignment(
    emaData: { [key: number]: number },
    A: ABCDPoint,
    B: ABCDPoint,
    C: ABCDPoint,
    D: ABCDPoint
  ): boolean {
    if (!this.config.trendAlignment) return true;
    
    const direction = (A.price < B.price) ? 'bullish' : 'bearish';
    const currentPrice = D.price;
    
    // Check EMA alignment
    const ema20 = emaData[20];
    const ema50 = emaData[50];
    const ema100 = emaData[100];
    
    if (!ema20 || !ema50 || !ema100) return false;
    
    if (direction === 'bullish') {
      return currentPrice > ema20 && ema20 > ema50 && ema50 > ema100;
    } else {
      return currentPrice < ema20 && ema20 < ema50 && ema50 < ema100;
    }
  }

  /**
   * Check volume confirmation
   */
  private checkVolumeConfirmation(data: Candle[], index: number): boolean {
    if (!this.config.volumeConfirmation) return true;
    
    if (index < this.config.volumeSMA) return false;
    
    const currentVolume = data[index].volume;
    const volumeHistory = data.slice(index - this.config.volumeSMA + 1, index).map(c => c.volume);
    const avgVolume = volumeHistory.reduce((sum, vol) => sum + vol, 0) / volumeHistory.length;
    
    return currentVolume > avgVolume * this.config.volumeThreshold;
  }

  /**
   * Check technical pattern confirmation
   */
  private checkTechnicalPatterns(data: Candle[], index: number): boolean {
    if (!this.config.technicalConfirmation) return true;
    
    if (index < 2) return false;
    
    const current = data[index];
    const prev = data[index - 1];
    const prev2 = data[index - 2];
    
    // Check for bullish engulfing
    const bullishEngulfing = current.close > current.open && 
                             prev.close < prev.open &&
                             current.open < prev.close &&
                             current.close > prev.open;
    
    // Check for bearish engulfing
    const bearishEngulfing = current.close < current.open &&
                             prev.close > prev.open &&
                             current.open > prev.close &&
                             current.close < prev.open;
    
    // Check for doji
    const doji = Math.abs(current.close - current.open) < (current.high - current.low) * 0.1;
    
    // Check for hammer
    const hammer = current.close > current.open &&
                   (current.high - current.low) > 3 * (current.close - current.open) &&
                   (current.close - current.low) > 2 * (current.high - current.close);
    
    // Check for shooting star
    const shootingStar = current.close < current.open &&
                         (current.high - current.low) > 3 * (current.open - current.close) &&
                         (current.high - current.open) > 2 * (current.open - current.low);
    
    return bullishEngulfing || bearishEngulfing || doji || hammer || shootingStar;
  }

  /**
   * Check RSI confirmation
   */
  private checkRSIConfirmation(rsi: number, A: ABCDPoint, B: ABCDPoint, C: ABCDPoint, D: ABCDPoint): boolean {
    const direction = (A.price < B.price) ? 'bullish' : 'bearish';
    
    if (direction === 'bullish') {
      return rsi < this.config.rsiOversold || (rsi > 40 && rsi < 60);
    } else {
      return rsi > this.config.rsiOverbought || (rsi > 40 && rsi < 60);
    }
  }

  /**
   * Check MACD confirmation
   */
  private checkMACDConfirmation(
    macd: { macd: number; signal: number; histogram: number },
    A: ABCDPoint,
    B: ABCDPoint,
    C: ABCDPoint,
    D: ABCDPoint
  ): boolean {
    const direction = (A.price < B.price) ? 'bullish' : 'bearish';
    
    if (direction === 'bullish') {
      return macd.histogram > 0 && macd.macd > macd.signal;
    } else {
      return macd.histogram < 0 && macd.macd < macd.signal;
    }
  }

  /**
   * Validate pattern confluence
   */
  private validatePatternConfluence(pattern: ABCDPattern, candle: Candle): boolean {
    // Check if pattern is recent enough
    const timeDiff = candle.timestamp - pattern.D.timestamp;
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    
    if (timeDiff > maxAge) return false;
    
    // Check if price is near D point
    const priceDiff = Math.abs(candle.close - pattern.D.price);
    const tolerance = pattern.D.price * this.config.fibTolerance;
    
    if (priceDiff > tolerance) return false;
    
    return true;
  }

  /**
   * Generate trade signal from pattern
   */
  private generateTradeSignal(pattern: ABCDPattern, candle: Candle): TradeSignal | null {
    const direction = pattern.direction === 'bullish' ? 'LONG' : 'SHORT';
    const confidence = pattern.strength / 100;
    
    // Calculate stop loss
    const stopLoss = this.calculateStopLoss(pattern);
    
    // Calculate take profit
    const takeProfit = this.calculateTakeProfit(pattern);
    
    // Calculate position size based on risk
    const positionSize = this.calculatePositionSize(candle.close, stopLoss);
    
    return this.createSignal(
      candle.symbol,
      direction,
      confidence,
      candle.close,
      positionSize,
      stopLoss,
      takeProfit
    );
  }

  /**
   * Calculate stop loss level
   */
  private calculateStopLoss(pattern: ABCDPattern): number {
    const buffer = pattern.A.price * this.config.stopLossBuffer;
    
    if (pattern.direction === 'bullish') {
      return pattern.A.price - buffer;
    } else {
      return pattern.A.price + buffer;
    }
  }

  /**
   * Calculate take profit level
   */
  private calculateTakeProfit(pattern: ABCDPattern): number {
    const risk = Math.abs(pattern.D.price - this.calculateStopLoss(pattern));
    const reward = risk * this.config.takeProfitMultiplier;
    
    if (pattern.direction === 'bullish') {
      return pattern.D.price + reward;
    } else {
      return pattern.D.price - reward;
    }
  }

  /**
   * Calculate position size based on risk management
   */
  private calculatePositionSize(entryPrice: number, stopLoss: number): number {
    const riskAmount = 10000 * this.config.maxRiskPerTrade; // Assuming $10k account
    const priceRisk = Math.abs(entryPrice - stopLoss);
    
    return riskAmount / priceRisk;
  }

  /**
   * Get strategy configuration
   */
  public getConfig(): ABCDFibinachiConfig {
    return { ...this.config };
  }

  /**
   * Update strategy configuration
   */
  public updateConfig(newConfig: Partial<ABCDFibinachiConfig>): void {
    Object.assign(this.config, newConfig);
    this.logger.info('ABCD Fibonacci configuration updated', newConfig);
  }

  /**
   * Get active patterns
   */
  public getActivePatterns(): Map<string, ABCDPattern> {
    return new Map(this.activePatterns);
  }

  /**
   * Clear completed patterns
   */
  public clearCompletedPatterns(): void {
    this.activePatterns.clear();
    this.logger.info('Completed patterns cleared');
  }
} 