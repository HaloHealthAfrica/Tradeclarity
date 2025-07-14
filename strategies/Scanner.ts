import type { IStorage } from '../storage';
import type { Strategy, Signal, InsertSignal, MarketData } from '@shared/schema';
import { createModuleLogger } from '../utils/logger';
import { handleSignal } from '../engine/TradeOrchestrator';
import { TradeSignal } from '../types';

const logger = createModuleLogger('Scanner');

/**
 * Session-based scanner configuration for Eastern Standard Time
 */
export interface ScannerConfig {
  // Session Configuration (Eastern Standard Time)
  enableSessionBasedScanning: boolean;
  premarketStartTime: string; // "04:00" EST
  premarketEndTime: string;   // "09:30" EST
  marketOpenTime: string;     // "09:30" EST
  marketCloseTime: string;    // "16:00" EST
  afterHoursEndTime: string;  // "20:00" EST
  
  // Session-Specific Intervals (in milliseconds)
  premarketScanInterval: number; // 2 minutes
  intradayScanInterval: number;  // 1 minute
  afterHoursScanInterval: number; // 5 minutes
  
  // Session-Specific Risk Management
  premarketRiskMultiplier: number; // 0.7
  intradayRiskMultiplier: number;  // 1.0
  afterHoursRiskMultiplier: number; // 0.5
  
  // Session-Specific Pattern Detection
  enablePremarketGapAnalysis: boolean;
  enableIntradayMomentum: boolean;
  enableAfterHoursReversal: boolean;
  
  // API Configuration
  twelvedataApiKey: string;
  twelvedataBaseUrl: string;
  twelvedataWsUrl: string;
  
  // Rate Limiting by Session
  premarketApiCallsPerMinute: number; // 30
  intradayApiCallsPerMinute: number;  // 60
  afterHoursApiCallsPerMinute: number; // 15
  
  // Pattern Parameters
  gapThreshold: number;
  breakoutThreshold: number;
  volumeSpikeMultiplier: number;
  minVolumeThreshold: number;
  
  // Technical Indicators
  atrPeriod: number;
  atrStopMultiplier: number;
  emaShort: number;
  emaLong: number;
  rsiPeriod: number;
}

export const scannerConfig: ScannerConfig = {
  // Session Configuration (Eastern Standard Time)
  enableSessionBasedScanning: true,
  premarketStartTime: "04:00", // 4:00 AM EST
  premarketEndTime: "09:30",   // 9:30 AM EST
  marketOpenTime: "09:30",     // 9:30 AM EST
  marketCloseTime: "16:00",    // 4:00 PM EST
  afterHoursEndTime: "20:00",  // 8:00 PM EST
  
  // Session-Specific Intervals
  premarketScanInterval: 2 * 60 * 1000, // 2 minutes
  intradayScanInterval: 60 * 1000,       // 1 minute
  afterHoursScanInterval: 5 * 60 * 1000, // 5 minutes
  
  // Session-Specific Risk Management
  premarketRiskMultiplier: 0.7,
  intradayRiskMultiplier: 1.0,
  afterHoursRiskMultiplier: 0.5,
  
  // Session-Specific Pattern Detection
  enablePremarketGapAnalysis: true,
  enableIntradayMomentum: true,
  enableAfterHoursReversal: true,
  
  // API Configuration
  twelvedataApiKey: process.env.TWELVEDATA_API_KEY || '',
  twelvedataBaseUrl: 'https://api.twelvedata.com',
  twelvedataWsUrl: 'wss://ws.twelvedata.com/v1/quotes/price',
  
  // Rate Limiting by Session
  premarketApiCallsPerMinute: 30,
  intradayApiCallsPerMinute: 60,
  afterHoursApiCallsPerMinute: 15,
  
  // Pattern Parameters
  gapThreshold: 0.005,
  breakoutThreshold: 0.001,
  volumeSpikeMultiplier: 1.5,
  minVolumeThreshold: 100000,
  
  // Technical Indicators
  atrPeriod: 14,
  atrStopMultiplier: 1.5,
  emaShort: 20,
  emaLong: 50,
  rsiPeriod: 14
};

/**
 * Market session information for Eastern Standard Time
 */
export interface SessionInfo {
  session: 'premarket' | 'intraday' | 'afterhours' | 'closed';
  confidence: number;
  scanInterval: number;
  riskMultiplier: number;
  apiCallsPerMinute: number;
  patternTypes: string[];
}

/**
 * Session-specific pattern result
 */
export interface SessionPatternResult {
  pattern: string;
  direction: 'BUY' | 'SELL';
  entry: number;
  stop: number;
  confidenceBase: number;
  session: string;
  sessionConfidence: number;
}

/**
 * Optimized Scanner with Session-Based Scanning for Eastern Standard Time
 * 
 * Features:
 * - Session-aware scanning (premarket, intraday, after hours) in EST
 * - Session-specific pattern detection
 * - Adaptive risk management
 * - Session-specific rate limiting
 * - Performance optimization by session
 */
export class Scanner {
  private storage: IStorage;
  private config: ScannerConfig;
  private watchlist: string[] = [];
  private activeSignals: any[] = [];
  private lastScanTime: Map<string, number> = new Map();
  private running = false;
  private sessionMetrics = {
    premarket: { signalsGenerated: 0, winRate: 0, processingTime: 0 },
    intraday: { signalsGenerated: 0, winRate: 0, processingTime: 0 },
    afterhours: { signalsGenerated: 0, winRate: 0, processingTime: 0 }
  };

  constructor(storage: IStorage, config?: Partial<ScannerConfig>) {
    this.storage = storage;
    this.config = { ...scannerConfig, ...config };
    
    if (!this.config.twelvedataApiKey) {
      throw new Error('TWELVEDATA_API_KEY environment variable is required');
    }
    
    logger.info('Scanner initialized with session-based configuration for Eastern Standard Time');
  }

  /**
   * Add symbols to watchlist
   */
  addSymbols(symbols: string[]): void {
    this.watchlist.push(...symbols);
    this.watchlist = [...new Set(this.watchlist)]; // Remove duplicates
    logger.info(`Watchlist updated: ${this.watchlist.length} symbols`);
  }

  /**
   * Start optimized scanning process
   */
  async startScanning(): Promise<void> {
    if (this.running) {
      logger.warn('Scanner is already running');
      return;
    }

    this.running = true;
    logger.info('Starting scanner with session-based scanning for Eastern Standard Time...');

    try {
      while (this.running) {
        const session = this.getCurrentSession();
        logger.info(`Current session (EST): ${session.session}, scanning with ${session.scanInterval}ms interval`);
        
        await this.scanAllSymbolsForSession(session);
        await this.delay(session.scanInterval);
      }
    } catch (error) {
      logger.error('Scanner error:', error);
      this.running = false;
    }
  }

  /**
   * Stop scanning process
   */
  stopScanning(): void {
    this.running = false;
    logger.info('Scanner stopped');
  }

  /**
   * Get current market session with configuration for Eastern Standard Time
   */
  private getCurrentSession(): SessionInfo {
    try {
      // Get current time in Eastern Standard Time
      const now = new Date();
      const estTime = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
      const currentTime = estTime.toTimeString().slice(0, 5); // "HH:MM" format
      
      logger.debug(`Current EST time: ${currentTime}`);
      
      if (currentTime >= this.config.premarketStartTime && currentTime < this.config.premarketEndTime) {
        return {
          session: 'premarket',
          confidence: 0.9,
          scanInterval: this.config.premarketScanInterval,
          riskMultiplier: this.config.premarketRiskMultiplier,
          apiCallsPerMinute: this.config.premarketApiCallsPerMinute,
          patternTypes: ['gap', 'volume', 'news']
        };
      } else if (currentTime >= this.config.marketOpenTime && currentTime < this.config.marketCloseTime) {
        return {
          session: 'intraday',
          confidence: 0.95,
          scanInterval: this.config.intradayScanInterval,
          riskMultiplier: this.config.intradayRiskMultiplier,
          apiCallsPerMinute: this.config.intradayApiCallsPerMinute,
          patternTypes: ['momentum', 'breakout', 'reversal']
        };
      } else if (currentTime >= this.config.marketCloseTime && currentTime < this.config.afterHoursEndTime) {
        return {
          session: 'afterhours',
          confidence: 0.7,
          scanInterval: this.config.afterHoursScanInterval,
          riskMultiplier: this.config.afterHoursRiskMultiplier,
          apiCallsPerMinute: this.config.afterHoursApiCallsPerMinute,
          patternTypes: ['reversal', 'unwinding']
        };
      } else {
        return {
          session: 'closed',
          confidence: 0.1,
          scanInterval: 10 * 60 * 1000, // 10 minutes
          riskMultiplier: 0.3,
          apiCallsPerMinute: 5,
          patternTypes: []
        };
      }
    } catch (error) {
      logger.error('Error determining current session:', error);
      return {
        session: 'intraday',
        confidence: 0.5,
        scanInterval: this.config.intradayScanInterval,
        riskMultiplier: this.config.intradayRiskMultiplier,
        apiCallsPerMinute: this.config.intradayApiCallsPerMinute,
        patternTypes: ['momentum', 'breakout']
      };
    }
  }

  /**
   * Scan all symbols for current session
   */
  private async scanAllSymbolsForSession(session: SessionInfo): Promise<void> {
    const startTime = Date.now();
    
    try {
      logger.info(`Scanning ${this.watchlist.length} symbols for ${session.session} session (EST)...`);
      
      // Scan symbols in parallel with session-specific rate limiting
      const scanPromises = this.watchlist.map(symbol => this.scanSymbolForSession(symbol, session));
      await Promise.allSettled(scanPromises);
      
      const processingTime = Date.now() - startTime;
      this.updateSessionMetrics(session.session, processingTime);
      
      logger.info(`${session.session} scan completed in ${processingTime}ms`);
      
    } catch (error) {
      logger.error(`Error during ${session.session} scan:`, error);
    }
  }

  /**
   * Scan individual symbol for session-specific patterns
   */
  private async scanSymbolForSession(symbol: string, session: SessionInfo): Promise<void> {
    try {
      // Session-specific rate limiting
      const lastScan = this.lastScanTime.get(symbol) || 0;
      if (Date.now() - lastScan < session.scanInterval) {
        return;
      }

      // Get market data
      const marketData = await this.getMarketData(symbol);
      if (!marketData) {
        logger.warn(`No market data available for ${symbol}`);
        return;
      }

      // Detect session-specific patterns
      const patterns = this.detectPatternsForSession(marketData, session);
      
      // Process each pattern with session-specific risk management
      for (const pattern of patterns) {
        await this.processPatternForSession(symbol, marketData, pattern, session);
      }

      this.lastScanTime.set(symbol, Date.now());
      
    } catch (error) {
      logger.error(`Error scanning ${symbol} for ${session.session}:`, error);
    }
  }

  /**
   * Get market data for symbol
   */
  private async getMarketData(symbol: string): Promise<any[] | null> {
    try {
      // Get historical data from storage
      const historicalData = await this.storage.getMarketDataHistory(symbol, 100);
      
      if (historicalData.length < 20) {
        logger.warn(`Insufficient historical data for ${symbol}: ${historicalData.length} points`);
        return null;
      }

      // Convert to scanner format
      const marketData = historicalData.map((data: any) => ({
        symbol: data.symbol,
        timestamp: new Date(data.timestamp),
        open: data.open || data.price,
        high: data.high || data.price,
        low: data.low || data.price,
        close: data.price,
        volume: data.volume || 0
      }));

      return marketData;
      
    } catch (error) {
      logger.error(`Error getting market data for ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Detect session-specific patterns
   */
  private detectPatternsForSession(marketData: any[], session: SessionInfo): SessionPatternResult[] {
    const patterns: SessionPatternResult[] = [];
    
    try {
      // Base patterns (common to all sessions)
      const basePatterns = this.detectBasePatterns(marketData);
      patterns.push(...basePatterns.map(p => ({ ...p, session: session.session, sessionConfidence: session.confidence })));

      // Session-specific patterns
      switch (session.session) {
        case 'premarket':
          if (this.config.enablePremarketGapAnalysis) {
            patterns.push(...this.detectPremarketPatterns(marketData, session));
          }
          break;
        case 'intraday':
          if (this.config.enableIntradayMomentum) {
            patterns.push(...this.detectIntradayPatterns(marketData, session));
          }
          break;
        case 'afterhours':
          if (this.config.enableAfterHoursReversal) {
            patterns.push(...this.detectAfterHoursPatterns(marketData, session));
          }
          break;
      }

      return patterns;
    } catch (error) {
      logger.error('Error detecting session patterns:', error);
      return [];
    }
  }

  /**
   * Detect base patterns (common to all sessions)
   */
  private detectBasePatterns(marketData: any[]): SessionPatternResult[] {
    const patterns: SessionPatternResult[] = [];
    
    try {
      if (marketData.length < 3) return patterns;

      const currentBar = marketData[marketData.length - 1];
      const prevBar = marketData[marketData.length - 2];

      // Inside Bar Pattern
      const isInsideBar = (currentBar.high < prevBar.high && currentBar.low > prevBar.low);
      
      if (isInsideBar) {
        const breakoutLevel = currentBar.high * (1 + this.config.breakoutThreshold);
        if (currentBar.close > breakoutLevel) {
          patterns.push({
            pattern: 'Inside Bar Bullish Breakout',
            direction: 'BUY',
            entry: currentBar.close,
            stop: currentBar.low,
            confidenceBase: 110,
            session: 'base',
            sessionConfidence: 0.8
          });
        }
        
        const breakdownLevel = currentBar.low * (1 - this.config.breakoutThreshold);
        if (currentBar.close < breakdownLevel) {
          patterns.push({
            pattern: 'Inside Bar Bearish Breakdown',
            direction: 'SELL',
            entry: currentBar.close,
            stop: currentBar.high,
            confidenceBase: 110,
            session: 'base',
            sessionConfidence: 0.8
          });
        }
      }

      // Outside Bar Pattern
      const isOutsideBar = (currentBar.high > prevBar.high && currentBar.low < prevBar.low);
      
      if (isOutsideBar) {
        if (currentBar.close > currentBar.open) {
          const breakoutLevel = currentBar.high * (1 + this.config.breakoutThreshold);
          if (currentBar.close > breakoutLevel) {
            patterns.push({
              pattern: 'Outside Bar Bullish Follow-Through',
              direction: 'BUY',
              entry: currentBar.close,
              stop: currentBar.low,
              confidenceBase: 115,
              session: 'base',
              sessionConfidence: 0.8
            });
          }
        }
        
        if (currentBar.close < currentBar.open) {
          const breakdownLevel = currentBar.low * (1 - this.config.breakoutThreshold);
          if (currentBar.close < breakdownLevel) {
            patterns.push({
              pattern: 'Outside Bar Bearish Follow-Through',
              direction: 'SELL',
              entry: currentBar.close,
              stop: currentBar.high,
              confidenceBase: 115,
              session: 'base',
              sessionConfidence: 0.8
            });
          }
        }
      }

      // Gap Detection
      const gapUp = currentBar.open > prevBar.close * (1 + this.config.gapThreshold);
      const gapDown = currentBar.open < prevBar.close * (1 - this.config.gapThreshold);
      
      if (gapUp && currentBar.close > currentBar.high) {
        patterns.push({
          pattern: 'Gap Up Breakout',
          direction: 'BUY',
          entry: currentBar.close,
          stop: currentBar.low,
          confidenceBase: 120,
          session: 'base',
          sessionConfidence: 0.8
        });
      }
      
      if (gapDown && currentBar.close < currentBar.low) {
        patterns.push({
          pattern: 'Gap Down Breakdown',
          direction: 'SELL',
          entry: currentBar.close,
          stop: currentBar.high,
          confidenceBase: 120,
          session: 'base',
          sessionConfidence: 0.8
        });
      }

      return patterns;
    } catch (error) {
      logger.error('Error detecting base patterns:', error);
      return [];
    }
  }

  /**
   * Detect premarket-specific patterns
   */
  private detectPremarketPatterns(marketData: any[], session: SessionInfo): SessionPatternResult[] {
    const patterns: SessionPatternResult[] = [];
    
    try {
      if (marketData.length < 2) return patterns;

      const currentBar = marketData[marketData.length - 1];
      const prevBar = marketData[marketData.length - 2];

      // Premarket gap analysis
      const gapUp = currentBar.open > prevBar.close * 1.02; // 2% gap
      const gapDown = currentBar.open < prevBar.close * 0.98; // -2% gap

      if (gapUp && currentBar.close > currentBar.open) {
        patterns.push({
          pattern: 'Premarket Gap Up Continuation',
          direction: 'BUY',
          entry: currentBar.close,
          stop: currentBar.low,
          confidenceBase: 125,
          session: session.session,
          sessionConfidence: session.confidence
        });
      }

      if (gapDown && currentBar.close < currentBar.open) {
        patterns.push({
          pattern: 'Premarket Gap Down Continuation',
          direction: 'SELL',
          entry: currentBar.close,
          stop: currentBar.high,
          confidenceBase: 125,
          session: session.session,
          sessionConfidence: session.confidence
        });
      }

      // Premarket volume analysis
      const avgVolume = this.calculateAverageVolume(marketData);
      if (currentBar.volume > avgVolume * 2) {
        if (currentBar.close > currentBar.open) {
          patterns.push({
            pattern: 'Premarket High Volume Bullish',
            direction: 'BUY',
            entry: currentBar.close,
            stop: currentBar.low,
            confidenceBase: 130,
            session: session.session,
            sessionConfidence: session.confidence
          });
        } else {
          patterns.push({
            pattern: 'Premarket High Volume Bearish',
            direction: 'SELL',
            entry: currentBar.close,
            stop: currentBar.high,
            confidenceBase: 130,
            session: session.session,
            sessionConfidence: session.confidence
          });
        }
      }

      return patterns;
    } catch (error) {
      logger.error('Error detecting premarket patterns:', error);
      return [];
    }
  }

  /**
   * Detect intraday-specific patterns
   */
  private detectIntradayPatterns(marketData: any[], session: SessionInfo): SessionPatternResult[] {
    const patterns: SessionPatternResult[] = [];
    
    try {
      if (marketData.length < 5) return patterns;

      const currentBar = marketData[marketData.length - 1];
      const recentBars = marketData.slice(-5);

      // Momentum continuation patterns
      const upBars = recentBars.filter((bar: any) => bar.close > bar.open).length;
      const downBars = recentBars.filter((bar: any) => bar.close < bar.open).length;

      if (upBars >= 3 && currentBar.close > currentBar.open) {
        patterns.push({
          pattern: 'Intraday Momentum Continuation',
          direction: 'BUY',
          entry: currentBar.close,
          stop: currentBar.low,
          confidenceBase: 120,
          session: session.session,
          sessionConfidence: session.confidence
        });
      }

      if (downBars >= 3 && currentBar.close < currentBar.open) {
        patterns.push({
          pattern: 'Intraday Momentum Continuation',
          direction: 'SELL',
          entry: currentBar.close,
          stop: currentBar.high,
          confidenceBase: 120,
          session: session.session,
          sessionConfidence: session.confidence
        });
      }

      return patterns;
    } catch (error) {
      logger.error('Error detecting intraday patterns:', error);
      return [];
    }
  }

  /**
   * Detect after-hours specific patterns
   */
  private detectAfterHoursPatterns(marketData: any[], session: SessionInfo): SessionPatternResult[] {
    const patterns: SessionPatternResult[] = [];
    
    try {
      if (marketData.length < 3) return patterns;

      const currentBar = marketData[marketData.length - 1];
      const prevBar = marketData[marketData.length - 2];

      // After-hours reversal patterns
      const dayRange = Math.abs(prevBar.high - prevBar.low);
      const currentRange = Math.abs(currentBar.high - currentBar.low);

      if (currentRange > dayRange * 0.5) {
        if (currentBar.close > currentBar.open) {
          patterns.push({
            pattern: 'After Hours Bullish Reversal',
            direction: 'BUY',
            entry: currentBar.close,
            stop: currentBar.low,
            confidenceBase: 115,
            session: session.session,
            sessionConfidence: session.confidence
          });
        } else {
          patterns.push({
            pattern: 'After Hours Bearish Reversal',
            direction: 'SELL',
            entry: currentBar.close,
            stop: currentBar.high,
            confidenceBase: 115,
            session: session.session,
            sessionConfidence: session.confidence
          });
        }
      }

      return patterns;
    } catch (error) {
      logger.error('Error detecting after hours patterns:', error);
      return [];
    }
  }

  /**
   * Calculate average volume
   */
  private calculateAverageVolume(marketData: any[]): number {
    try {
      const volumes = marketData.slice(-20).map((d: any) => d.volume);
      return volumes.reduce((sum: number, vol: number) => sum + vol, 0) / volumes.length;
    } catch (error) {
      logger.error('Volume calculation error:', error);
      return 0;
    }
  }

  /**
   * Process pattern with session-specific risk management
   */
  private async processPatternForSession(
    symbol: string, 
    marketData: any[], 
    pattern: SessionPatternResult, 
    session: SessionInfo
  ): Promise<void> {
    try {
      // Apply session-specific risk multiplier
      const adjustedConfidence = pattern.confidenceBase * session.riskMultiplier;
      
      // Calculate position size with session-specific risk
      const { positionSize, riskAmount } = this.calculatePositionSizeForSession(
        pattern.entry, 
        pattern.stop, 
        session.riskMultiplier
      );

      // Create session-specific signal
      const signal = {
        symbol,
        pattern: pattern.pattern,
        direction: pattern.direction,
        entryPrice: pattern.entry,
        stopLoss: pattern.stop,
        confidence: adjustedConfidence,
        session: session.session,
        sessionConfidence: session.confidence,
        riskMultiplier: session.riskMultiplier,
        positionSize,
        riskAmount,
        timestamp: new Date()
      };

      // Save signal to database
      await this.saveSignal(signal);
      
      // Send signal to trading system for Alpaca execution
      await this.sendSignalToTradingSystem(signal);
      
      // Update session metrics
      this.sessionMetrics[session.session as keyof typeof this.sessionMetrics].signalsGenerated++;
      
      logger.info(`${session.session} signal generated: ${symbol} ${pattern.pattern} (${adjustedConfidence.toFixed(1)}% confidence)`);
      
    } catch (error) {
      logger.error(`Error processing ${session.session} pattern for ${symbol}:`, error);
    }
  }

  /**
   * Calculate position size with session-specific risk
   */
  private calculatePositionSizeForSession(
    entryPrice: number, 
    stopPrice: number, 
    riskMultiplier: number
  ): { positionSize: number; riskAmount: number } {
    try {
      const riskPerShare = Math.abs(entryPrice - stopPrice);
      if (riskPerShare === 0) return { positionSize: 0, riskAmount: 0 };
      
      // Apply session-specific risk multiplier
      const adjustedRiskAmount = 1000 * riskMultiplier; // Base risk amount
      const positionSize = Math.floor(adjustedRiskAmount / riskPerShare);
      
      return { positionSize, riskAmount: adjustedRiskAmount };
    } catch (error) {
      logger.error('Position size calculation error:', error);
      return { positionSize: 0, riskAmount: 0 };
    }
  }

  /**
   * Send signal to trading system for Alpaca execution
   */
  private async sendSignalToTradingSystem(signal: any): Promise<void> {
    try {
      // Convert scanner signal to TradeSignal format for trading system
      const tradeSignal: TradeSignal = {
        symbol: signal.symbol,
        direction: signal.direction === 'BUY' ? 'LONG' : 'SHORT',
        confidence: signal.confidence / 100, // Convert percentage to decimal
        strategy: 'optimized_scanner',
        timestamp: Date.now(),
        price: signal.entryPrice,
        quantity: signal.positionSize,
        stopLoss: signal.stopLoss,
        takeProfit: signal.entryPrice + (signal.entryPrice - signal.stopLoss) * 2 // 2:1 risk/reward
      };

      // Send to trading system for Alpaca execution
      const result = await handleSignal(tradeSignal);
      
      if (result) {
        logger.info('Signal sent to trading system for Alpaca execution', {
          symbol: signal.symbol,
          direction: signal.direction,
          tradeId: result.id,
          status: result.status
        });
      } else {
        logger.warn('Signal rejected by trading system', {
          symbol: signal.symbol,
          direction: signal.direction,
          reason: 'Risk checks or signal evaluation failed'
        });
      }
    } catch (error) {
      logger.error('Error sending signal to trading system:', error);
    }
  }

  /**
   * Save signal to database
   */
  private async saveSignal(signal: any): Promise<void> {
    try {
      // Convert to storage format
      const storageSignal: InsertSignal = {
        strategyId: 'optimized_scanner',
        symbol: signal.symbol,
        direction: signal.direction === 'BUY' ? 'CALL' : 'PUT',
        confidence: signal.confidence,
        currentPrice: signal.entryPrice,
        entryRange: { min: signal.entryPrice, max: signal.entryPrice },
        targetPrice: signal.entryPrice + (signal.entryPrice - signal.stopLoss),
        stopLoss: signal.stopLoss,
        positionSize: signal.positionSize,
        riskReward: 2.0,
        pattern: signal.pattern,
        reasoning: `${signal.session} session signal: ${signal.pattern}`,
        confluence: [`Session: ${signal.session}`, `Confidence: ${signal.confidence}%`],
        marketContext: { session: signal.session },
        expectedHold: '1-4 hours',
        optimalEntry: 'immediate',
        optionsData: null,
        status: 'active'
      };

      await this.storage.createSignal(storageSignal);
    } catch (error) {
      logger.error('Error saving signal:', error);
    }
  }

  /**
   * Update session metrics
   */
  private updateSessionMetrics(session: string, processingTime: number): void {
    try {
      if (this.sessionMetrics[session as keyof typeof this.sessionMetrics]) {
        this.sessionMetrics[session as keyof typeof this.sessionMetrics].processingTime = processingTime;
      }
    } catch (error) {
      logger.error('Error updating session metrics:', error);
    }
  }

  /**
   * Delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get session metrics
   */
  getSessionMetrics() {
    return { ...this.sessionMetrics };
  }

  /**
   * Get performance metrics (for API compatibility)
   */
  getPerformanceMetrics() {
    return {
      totalScans: this.sessionMetrics.premarket.signalsGenerated + 
                   this.sessionMetrics.intraday.signalsGenerated + 
                   this.sessionMetrics.afterhours.signalsGenerated,
      signalsGenerated: this.sessionMetrics.premarket.signalsGenerated + 
                        this.sessionMetrics.intraday.signalsGenerated + 
                        this.sessionMetrics.afterhours.signalsGenerated,
      averageProcessingTime: (this.sessionMetrics.premarket.processingTime + 
                             this.sessionMetrics.intraday.processingTime + 
                             this.sessionMetrics.afterhours.processingTime) / 3,
      errors: 0,
      sessionMetrics: this.sessionMetrics
    };
  }

  /**
   * Get configuration
   */
  getConfig(): ScannerConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<ScannerConfig>): void {
    Object.assign(this.config, newConfig);
    logger.info('Scanner configuration updated', newConfig);
  }

  /**
   * Get watchlist
   */
  getWatchlist(): string[] {
    return [...this.watchlist];
  }

  /**
   * Get active signals
   */
  getActiveSignals(): any[] {
    return [...this.activeSignals];
  }

  /**
   * Get current session info
   */
  getCurrentSessionInfo() {
    return this.getCurrentSession();
  }
} 