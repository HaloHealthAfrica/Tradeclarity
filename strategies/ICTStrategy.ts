import { Candle, TradeSignal } from '../types';
import { BaseStrategy } from './BaseStrategy';
import { registerStrategy } from './StrategyLoader';

interface FairValueGap {
  start: number;
  end: number;
  direction: 'bullish' | 'bearish';
  strength: number;
  timestamp: number;
}

interface OrderBlock {
  start: number;
  end: number;
  direction: 'bullish' | 'bearish';
  strength: number;
  timestamp: number;
  filled: boolean;
}

interface TechnicalPattern {
  type: 'engulfing' | 'head_shoulders' | 'double_top' | 'double_bottom' | 'triangle' | 'wedge';
  direction: 'bullish' | 'bearish';
  confidence: number;
  timestamp: number;
}

interface ICTLevel {
  price: number;
  type: 'fvg' | 'ob' | 'liquidity' | 'equal_high' | 'equal_low';
  direction: 'bullish' | 'bearish';
  strength: number;
  timestamp: number;
}

export class ICTStrategy extends BaseStrategy {
  public name = 'ICTStrategy';
  public symbols = ['AAPL', 'MSFT', 'TSLA', 'GOOGL'];
  public intervals = ['1m', '5m', '15m'];

  private fairValueGaps: FairValueGap[] = [];
  private orderBlocks: OrderBlock[] = [];
  private technicalPatterns: TechnicalPattern[] = [];
  private ictLevels: ICTLevel[] = [];
  private lastSignal: TradeSignal | null = null;
  private currentPosition: 'long' | 'short' | null = null;

  constructor(parameters: Record<string, any> = {}) {
    super(parameters);
    
    // ICT-specific parameters
    this.setParameter('fvgThreshold', parameters.fvgThreshold || 0.001); // 0.1% minimum gap
    this.setParameter('obThreshold', parameters.obThreshold || 0.002); // 0.2% minimum block
    this.setParameter('liquidityThreshold', parameters.liquidityThreshold || 0.005); // 0.5% liquidity zone
    this.setParameter('patternConfirmation', parameters.patternConfirmation || 0.7);
    this.setParameter('minConfidence', parameters.minConfidence || 0.75);
    this.setParameter('maxFVG', parameters.maxFVG || 50);
    this.setParameter('maxOB', parameters.maxOB || 30);
    this.setParameter('maxPatterns', parameters.maxPatterns || 20);
  }

  protected async processCandle(candle: Candle): Promise<TradeSignal | null> {
    try {
      // Get historical data for analysis
      const historicalData = await this.getHistoricalData(candle.symbol, candle.interval, 200);
      
      if (historicalData.length < 50) {
        this.logger.debug('Insufficient historical data for ICT analysis');
        return null;
      }

      // Update ICT levels
      this.updateFairValueGaps(historicalData);
      this.updateOrderBlocks(historicalData);
      this.updateTechnicalPatterns(historicalData);
      this.updateICTLevels(historicalData);

      // Clean up old levels
      this.cleanupOldLevels();

      // Generate ICT signal
      const signal = this.generateICTSignal(candle, historicalData);
      
      if (signal) {
        this.lastSignal = signal;
        this.trackPerformance(signal);
      }

      return signal;
    } catch (error) {
      this.logger.error('Error processing candle in ICT Strategy', error as Error);
      return null;
    }
  }

  private updateFairValueGaps(data: Candle[]): void {
    if (data.length < 3) return;

    for (let i = 1; i < data.length - 1; i++) {
      const prev = data[i - 1];
      const current = data[i];
      const next = data[i + 1];

      // Bullish FVG: Gap between previous high and next low
      if (prev.high < next.low) {
        const gap = next.low - prev.high;
        const threshold = this.getParameter('fvgThreshold') * prev.high;
        
        if (gap > threshold) {
          const fvg: FairValueGap = {
            start: prev.high,
            end: next.low,
            direction: 'bullish',
            strength: gap / prev.high,
            timestamp: current.timestamp
          };
          
          this.fairValueGaps.push(fvg);
          this.logger.debug('Bullish FVG detected', { gap: gap.toFixed(4), strength: fvg.strength.toFixed(4) });
        }
      }

      // Bearish FVG: Gap between previous low and next high
      if (prev.low > next.high) {
        const gap = prev.low - next.high;
        const threshold = this.getParameter('fvgThreshold') * prev.low;
        
        if (gap > threshold) {
          const fvg: FairValueGap = {
            start: next.high,
            end: prev.low,
            direction: 'bearish',
            strength: gap / prev.low,
            timestamp: current.timestamp
          };
          
          this.fairValueGaps.push(fvg);
          this.logger.debug('Bearish FVG detected', { gap: gap.toFixed(4), strength: fvg.strength.toFixed(4) });
        }
      }
    }
  }

  private updateOrderBlocks(data: Candle[]): void {
    if (data.length < 5) return;

    for (let i = 2; i < data.length - 2; i++) {
      const current = data[i];
      const next = data[i + 1];
      const next2 = data[i + 2];

      // Bullish Order Block: Strong move up after consolidation
      if (next.close > current.high && next2.close > next.close) {
        const blockSize = current.high - current.low;
        const threshold = this.getParameter('obThreshold') * current.close;
        
        if (blockSize > threshold) {
          const ob: OrderBlock = {
            start: current.low,
            end: current.high,
            direction: 'bullish',
            strength: blockSize / current.close,
            timestamp: current.timestamp,
            filled: false
          };
          
          this.orderBlocks.push(ob);
          this.logger.debug('Bullish OB detected', { size: blockSize.toFixed(4), strength: ob.strength.toFixed(4) });
        }
      }

      // Bearish Order Block: Strong move down after consolidation
      if (next.close < current.low && next2.close < next.close) {
        const blockSize = current.high - current.low;
        const threshold = this.getParameter('obThreshold') * current.close;
        
        if (blockSize > threshold) {
          const ob: OrderBlock = {
            start: current.low,
            end: current.high,
            direction: 'bearish',
            strength: blockSize / current.close,
            timestamp: current.timestamp,
            filled: false
          };
          
          this.orderBlocks.push(ob);
          this.logger.debug('Bearish OB detected', { size: blockSize.toFixed(4), strength: ob.strength.toFixed(4) });
        }
      }
    }
  }

  private updateTechnicalPatterns(data: Candle[]): void {
    // Engulfing patterns
    this.detectEngulfingPatterns(data);
    
    // Head and shoulders
    this.detectHeadAndShoulders(data);
    
    // Double tops/bottoms
    this.detectDoublePatterns(data);
    
    // Triangles and wedges
    this.detectTrianglePatterns(data);
  }

  private detectEngulfingPatterns(data: Candle[]): void {
    if (data.length < 2) return;

    for (let i = 1; i < data.length; i++) {
      const prev = data[i - 1];
      const current = data[i];

      // Bullish engulfing
      if (current.open < prev.close && current.close > prev.open && 
          current.high > prev.high && current.low < prev.low) {
        const pattern: TechnicalPattern = {
          type: 'engulfing',
          direction: 'bullish',
          confidence: 0.8,
          timestamp: current.timestamp
        };
        this.technicalPatterns.push(pattern);
        this.logger.debug('Bullish engulfing detected');
      }

      // Bearish engulfing
      if (current.open > prev.close && current.close < prev.open && 
          current.high > prev.high && current.low < prev.low) {
        const pattern: TechnicalPattern = {
          type: 'engulfing',
          direction: 'bearish',
          confidence: 0.8,
          timestamp: current.timestamp
        };
        this.technicalPatterns.push(pattern);
        this.logger.debug('Bearish engulfing detected');
      }
    }
  }

  private detectHeadAndShoulders(data: Candle[]): void {
    if (data.length < 7) return;

    // Simplified head and shoulders detection
    for (let i = 3; i < data.length - 3; i++) {
      const left = data[i - 3];
      const leftShoulder = data[i - 2];
      const head = data[i];
      const rightShoulder = data[i + 2];
      const right = data[i + 3];

      // Head and shoulders (bearish)
      if (head.high > leftShoulder.high && head.high > rightShoulder.high &&
          leftShoulder.high > left.high && rightShoulder.high > right.high) {
        const pattern: TechnicalPattern = {
          type: 'head_shoulders',
          direction: 'bearish',
          confidence: 0.85,
          timestamp: head.timestamp
        };
        this.technicalPatterns.push(pattern);
        this.logger.debug('Head and shoulders (bearish) detected');
      }

      // Inverse head and shoulders (bullish)
      if (head.low < leftShoulder.low && head.low < rightShoulder.low &&
          leftShoulder.low < left.low && rightShoulder.low < right.low) {
        const pattern: TechnicalPattern = {
          type: 'head_shoulders',
          direction: 'bullish',
          confidence: 0.85,
          timestamp: head.timestamp
        };
        this.technicalPatterns.push(pattern);
        this.logger.debug('Inverse head and shoulders (bullish) detected');
      }
    }
  }

  private detectDoublePatterns(data: Candle[]): void {
    if (data.length < 10) return;

    for (let i = 5; i < data.length - 5; i++) {
      const current = data[i];
      
      // Look for double tops
      const leftPeak = this.findPeak(data, i - 5, i);
      const rightPeak = this.findPeak(data, i, i + 5);
      
      if (leftPeak && rightPeak && 
          Math.abs(leftPeak.high - rightPeak.high) / leftPeak.high < 0.01) {
        const pattern: TechnicalPattern = {
          type: 'double_top',
          direction: 'bearish',
          confidence: 0.8,
          timestamp: current.timestamp
        };
        this.technicalPatterns.push(pattern);
        this.logger.debug('Double top detected');
      }

      // Look for double bottoms
      const leftTrough = this.findTrough(data, i - 5, i);
      const rightTrough = this.findTrough(data, i, i + 5);
      
      if (leftTrough && rightTrough && 
          Math.abs(leftTrough.low - rightTrough.low) / leftTrough.low < 0.01) {
        const pattern: TechnicalPattern = {
          type: 'double_bottom',
          direction: 'bullish',
          confidence: 0.8,
          timestamp: current.timestamp
        };
        this.technicalPatterns.push(pattern);
        this.logger.debug('Double bottom detected');
      }
    }
  }

  private detectTrianglePatterns(data: Candle[]): void {
    // Simplified triangle detection
    if (data.length < 10) return;

    const recent = data.slice(-10);
    const highs = recent.map(d => d.high);
    const lows = recent.map(d => d.low);

    const highSlope = this.calculateSlope(highs);
    const lowSlope = this.calculateSlope(lows);

    // Ascending triangle (bullish)
    if (Math.abs(highSlope) < 0.001 && lowSlope > 0.001) {
      const pattern: TechnicalPattern = {
        type: 'triangle',
        direction: 'bullish',
        confidence: 0.75,
        timestamp: data[data.length - 1].timestamp
      };
      this.technicalPatterns.push(pattern);
      this.logger.debug('Ascending triangle detected');
    }

    // Descending triangle (bearish)
    if (highSlope < -0.001 && Math.abs(lowSlope) < 0.001) {
      const pattern: TechnicalPattern = {
        type: 'triangle',
        direction: 'bearish',
        confidence: 0.75,
        timestamp: data[data.length - 1].timestamp
      };
      this.technicalPatterns.push(pattern);
      this.logger.debug('Descending triangle detected');
    }
  }

  private updateICTLevels(data: Candle[]): void {
    const currentPrice = data[data.length - 1].close;
    const liquidityThreshold = this.getParameter('liquidityThreshold');

    // Add FVGs as ICT levels
    for (const fvg of this.fairValueGaps) {
      if (fvg.direction === 'bullish' && currentPrice >= fvg.start && currentPrice <= fvg.end) {
        this.ictLevels.push({
          price: fvg.start,
          type: 'fvg',
          direction: 'bullish',
          strength: fvg.strength,
          timestamp: fvg.timestamp
        });
      } else if (fvg.direction === 'bearish' && currentPrice >= fvg.start && currentPrice <= fvg.end) {
        this.ictLevels.push({
          price: fvg.end,
          type: 'fvg',
          direction: 'bearish',
          strength: fvg.strength,
          timestamp: fvg.timestamp
        });
      }
    }

    // Add Order Blocks as ICT levels
    for (const ob of this.orderBlocks) {
      if (!ob.filled && currentPrice >= ob.start && currentPrice <= ob.end) {
        this.ictLevels.push({
          price: ob.direction === 'bullish' ? ob.start : ob.end,
          type: 'ob',
          direction: ob.direction,
          strength: ob.strength,
          timestamp: ob.timestamp
        });
      }
    }

    // Add liquidity levels (equal highs/lows)
    this.detectLiquidityLevels(data);
  }

  private detectLiquidityLevels(data: Candle[]): void {
    const liquidityThreshold = this.getParameter('liquidityThreshold');
    
    // Find equal highs
    for (let i = 0; i < data.length - 1; i++) {
      for (let j = i + 1; j < data.length; j++) {
        const diff = Math.abs(data[i].high - data[j].high) / data[i].high;
        if (diff < liquidityThreshold) {
          this.ictLevels.push({
            price: data[i].high,
            type: 'liquidity',
            direction: 'bearish',
            strength: 1 - diff,
            timestamp: data[j].timestamp
          });
        }
      }
    }

    // Find equal lows
    for (let i = 0; i < data.length - 1; i++) {
      for (let j = i + 1; j < data.length; j++) {
        const diff = Math.abs(data[i].low - data[j].low) / data[i].low;
        if (diff < liquidityThreshold) {
          this.ictLevels.push({
            price: data[i].low,
            type: 'liquidity',
            direction: 'bullish',
            strength: 1 - diff,
            timestamp: data[j].timestamp
          });
        }
      }
    }
  }

  private generateICTSignal(candle: Candle, data: Candle[]): TradeSignal | null {
    const currentPrice = candle.close;
    const minConfidence = this.getParameter('minConfidence');
    const patternConfirmation = this.getParameter('patternConfirmation');

    let direction: 'LONG' | 'SHORT' | 'CLOSE' | null = null;
    let confidence = 0;
    let ictLevel: ICTLevel | null = null;
    let pattern: TechnicalPattern | null = null;

    // Check for ICT level interactions
    for (const level of this.ictLevels) {
      const priceDiff = Math.abs(currentPrice - level.price) / level.price;
      
      if (priceDiff < 0.001) { // Within 0.1% of ICT level
        if (level.direction === 'bullish' && level.type === 'fvg') {
          direction = 'LONG';
          confidence = 0.7 + level.strength * 0.2;
          ictLevel = level;
        } else if (level.direction === 'bearish' && level.type === 'fvg') {
          direction = 'SHORT';
          confidence = 0.7 + level.strength * 0.2;
          ictLevel = level;
        } else if (level.direction === 'bullish' && level.type === 'ob') {
          direction = 'LONG';
          confidence = 0.8 + level.strength * 0.15;
          ictLevel = level;
        } else if (level.direction === 'bearish' && level.type === 'ob') {
          direction = 'SHORT';
          confidence = 0.8 + level.strength * 0.15;
          ictLevel = level;
        }
      }
    }

    // Look for technical pattern confirmation
    if (direction && confidence >= patternConfirmation) {
      const recentPatterns = this.technicalPatterns.filter(p => 
        p.timestamp > candle.timestamp - 300000 && // Last 5 minutes
        p.direction === (direction === 'LONG' ? 'bullish' : 'bearish')
      );

      if (recentPatterns.length > 0) {
        pattern = recentPatterns[recentPatterns.length - 1];
        confidence += 0.1; // Boost confidence with pattern confirmation
        this.logger.info('ICT signal confirmed by technical pattern', {
          ictLevel: ictLevel?.type,
          pattern: pattern.type,
          direction,
          confidence: confidence.toFixed(2)
        });
      }
    }

    // Close signal logic
    if (this.currentPosition && this.lastSignal) {
      const wasLong = this.currentPosition === 'long';
      const wasShort = this.currentPosition === 'short';
      
      // Close long position on bearish ICT level or pattern
      if (wasLong && (direction === 'SHORT' || 
          (pattern && pattern.direction === 'bearish'))) {
        direction = 'CLOSE';
        confidence = 0.9;
      }
      // Close short position on bullish ICT level or pattern
      else if (wasShort && (direction === 'LONG' || 
          (pattern && pattern.direction === 'bullish'))) {
        direction = 'CLOSE';
        confidence = 0.9;
      }
    }

    if (direction && confidence >= minConfidence) {
      // Update position tracking
      if (direction === 'LONG') this.currentPosition = 'long';
      else if (direction === 'SHORT') this.currentPosition = 'short';
      else if (direction === 'CLOSE') this.currentPosition = null;

      // Mark order blocks as filled
      if (ictLevel && ictLevel.type === 'ob') {
        const ob = this.orderBlocks.find(o => 
          o.timestamp === ictLevel!.timestamp && 
          o.direction === ictLevel!.direction
        );
        if (ob) ob.filled = true;
      }

      this.logger.info('ICT signal generated', {
        direction,
        confidence: confidence.toFixed(2),
        ictLevel: ictLevel?.type,
        pattern: pattern?.type,
        price: currentPrice
      });

      return this.createSignal(
        candle.symbol,
        direction,
        confidence,
        candle.close,
        1,
        this.calculateStopLoss(candle.close, direction),
        this.calculateTakeProfit(candle.close, direction)
      );
    }

    return null;
  }

  private cleanupOldLevels(): void {
    const maxFVG = this.getParameter('maxFVG');
    const maxOB = this.getParameter('maxOB');
    const maxPatterns = this.getParameter('maxPatterns');
    const currentTime = Date.now();

    // Remove old FVGs
    this.fairValueGaps = this.fairValueGaps
      .filter(fvg => currentTime - fvg.timestamp < 3600000) // 1 hour
      .slice(-maxFVG);

    // Remove old Order Blocks
    this.orderBlocks = this.orderBlocks
      .filter(ob => currentTime - ob.timestamp < 7200000) // 2 hours
      .slice(-maxOB);

    // Remove old patterns
    this.technicalPatterns = this.technicalPatterns
      .filter(p => currentTime - p.timestamp < 1800000) // 30 minutes
      .slice(-maxPatterns);

    // Remove old ICT levels
    this.ictLevels = this.ictLevels
      .filter(l => currentTime - l.timestamp < 3600000) // 1 hour
      .slice(-100);
  }

  private findPeak(data: Candle[], start: number, end: number): Candle | null {
    let peak = data[start];
    for (let i = start + 1; i <= end; i++) {
      if (data[i].high > peak.high) peak = data[i];
    }
    return peak;
  }

  private findTrough(data: Candle[], start: number, end: number): Candle | null {
    let trough = data[start];
    for (let i = start + 1; i <= end; i++) {
      if (data[i].low < trough.low) trough = data[i];
    }
    return trough;
  }

  private calculateSlope(values: number[]): number {
    if (values.length < 2) return 0;
    const n = values.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = values.reduce((sum, val) => sum + val, 0);
    const sumXY = values.reduce((sum, val, i) => sum + val * i, 0);
    const sumX2 = values.reduce((sum, val, i) => sum + i * i, 0);
    
    return (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  }

  private calculateStopLoss(price: number, direction: 'LONG' | 'SHORT' | 'CLOSE'): number {
    const stopLossPercent = 0.015; // 1.5% stop loss for ICT strategy
    
    if (direction === 'LONG') {
      return price * (1 - stopLossPercent);
    } else if (direction === 'SHORT') {
      return price * (1 + stopLossPercent);
    }
    
    return 0;
  }

  private calculateTakeProfit(price: number, direction: 'LONG' | 'SHORT' | 'CLOSE'): number {
    const takeProfitPercent = 0.03; // 3% take profit for ICT strategy
    
    if (direction === 'LONG') {
      return price * (1 + takeProfitPercent);
    } else if (direction === 'SHORT') {
      return price * (1 - takeProfitPercent);
    }
    
    return 0;
  }

  protected override async onInitialize(): Promise<void> {
    this.logger.info('ICT Strategy initialized with parameters', {
      fvgThreshold: this.getParameter('fvgThreshold'),
      obThreshold: this.getParameter('obThreshold'),
      liquidityThreshold: this.getParameter('liquidityThreshold'),
      patternConfirmation: this.getParameter('patternConfirmation'),
      minConfidence: this.getParameter('minConfidence')
    });
  }

  protected override async onCleanup(): Promise<void> {
    this.fairValueGaps = [];
    this.orderBlocks = [];
    this.technicalPatterns = [];
    this.ictLevels = [];
    this.lastSignal = null;
    this.currentPosition = null;
  }
}

// Auto-register the strategy
registerStrategy('ICTStrategy', ICTStrategy); 