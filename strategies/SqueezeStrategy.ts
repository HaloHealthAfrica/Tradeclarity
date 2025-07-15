// SqueezeStrategy.ts
import { Candle, TradeSignal } from '../types';
import { BaseStrategy } from './BaseStrategy';
import { registerStrategy } from './StrategyLoader';

export class SqueezeStrategy extends BaseStrategy {
  public name = 'SqueezeStrategy';
  public symbols = ['TSLA', 'GOOGL'];
  public intervals = ['1m', '5m'];

  private bbValues: { upper: number; lower: number; middle: number }[] = [];
  private kcValues: { upper: number; lower: number; middle: number }[] = [];
  private squeezeState: 'squeezed' | 'expanded' | 'neutral' = 'neutral';
  private lastSignal: TradeSignal | null = null;

  constructor(parameters: Record<string, any> = {}) {
    super(parameters);
    
    // Set default parameters
    this.setParameter('bbPeriod', parameters.bbPeriod || 20);
    this.setParameter('bbStdDev', parameters.bbStdDev || 2);
    this.setParameter('kcPeriod', parameters.kcPeriod || 20);
    this.setParameter('kcStdDev', parameters.kcStdDev || 1.5);
    this.setParameter('minConfidence', parameters.minConfidence || 0.75);
  }

  protected async processCandle(candle: Candle): Promise<TradeSignal | null> {
    try {
      // Get historical data for calculations
      const historicalData = await this.getHistoricalData(candle.symbol, candle.interval, 100);
      
      if (historicalData.length < this.getParameter('bbPeriod')) {
        this.logger.debug('Insufficient historical data for calculations');
        return null;
      }

      // Calculate Bollinger Bands
      const bb = this.calculateBollingerBands(historicalData, this.getParameter('bbPeriod'), this.getParameter('bbStdDev'));
      
      // Calculate Keltner Channels
      const kc = this.calculateKeltnerChannels(historicalData, this.getParameter('kcPeriod'), this.getParameter('kcStdDev'));

      // Store values
      this.bbValues.push(bb);
      this.kcValues.push(kc);

      // Keep only recent values
      if (this.bbValues.length > 10) {
        this.bbValues.shift();
        this.kcValues.shift();
      }

      // Determine squeeze state
      this.updateSqueezeState();

      // Generate signal based on squeeze breakout
      const signal = this.generateSignal(candle, bb, kc);
      
      if (signal) {
        this.lastSignal = signal;
        this.trackPerformance(signal);
      }

      return signal;
    } catch (error) {
      this.logger.error('Error processing candle in Squeeze Strategy', error as Error);
      return null;
    }
  }

  private calculateBollingerBands(data: Candle[], period: number, stdDev: number) {
    const closes = data.slice(-period).map(d => d.close);
    const sma = closes.reduce((sum, close) => sum + close, 0) / period;
    
    const variance = closes.reduce((sum, close) => sum + Math.pow(close - sma, 2), 0) / period;
    const standardDeviation = Math.sqrt(variance);
    
    return {
      upper: sma + (standardDeviation * stdDev),
      lower: sma - (standardDeviation * stdDev),
      middle: sma
    };
  }

  private calculateKeltnerChannels(data: Candle[], period: number, stdDev: number) {
    const recentData = data.slice(-period);
    const highs = recentData.map(d => d.high);
    const lows = recentData.map(d => d.low);
    const closes = recentData.map(d => d.close);
    
    const typicalPrice = recentData.map(d => (d.high + d.low + d.close) / 3);
    const sma = typicalPrice.reduce((sum, price) => sum + price, 0) / period;
    
    const atr = this.calculateATR(recentData);
    
    return {
      upper: sma + (atr * stdDev),
      lower: sma - (atr * stdDev),
      middle: sma
    };
  }

  private calculateATR(data: Candle[]): number {
    const trueRanges: number[] = [];
    
    for (let i = 1; i < data.length; i++) {
      const high = data[i].high;
      const low = data[i].low;
      const prevClose = data[i - 1].close;
      
      const tr1 = high - low;
      const tr2 = Math.abs(high - prevClose);
      const tr3 = Math.abs(low - prevClose);
      
      trueRanges.push(Math.max(tr1, tr2, tr3));
    }
    
    return trueRanges.reduce((sum, tr) => sum + tr, 0) / trueRanges.length;
  }

  private updateSqueezeState(): void {
    if (this.bbValues.length < 2 || this.kcValues.length < 2) return;

    const currentBB = this.bbValues[this.bbValues.length - 1];
    const currentKC = this.kcValues[this.kcValues.length - 1];
    const prevBB = this.bbValues[this.bbValues.length - 2];
    const prevKC = this.kcValues[this.kcValues.length - 2];

    // Check if Bollinger Bands are inside Keltner Channels (squeeze)
    const bbInsideKC = currentBB.upper < currentKC.upper && currentBB.lower > currentKC.lower;
    const prevBBInsideKC = prevBB.upper < prevKC.upper && prevBB.lower > prevKC.lower;

    if (bbInsideKC && prevBBInsideKC) {
      this.squeezeState = 'squeezed';
    } else if (!bbInsideKC && prevBBInsideKC) {
      this.squeezeState = 'expanded';
    } else {
      this.squeezeState = 'neutral';
    }
  }

  private generateSignal(candle: Candle, bb: any, kc: any): TradeSignal | null {
    const minConfidence = this.getParameter('minConfidence');
    
    let direction: 'LONG' | 'SHORT' | 'CLOSE' | null = null;
    let confidence = 0;

    // Breakout signals
    if (this.squeezeState === 'expanded') {
      const price = candle.close;
      const bbUpper = bb.upper;
      const bbLower = bb.lower;
      const kcUpper = kc.upper;
      const kcLower = kc.lower;

      // Long signal: Price breaks above upper bands
      if (price > bbUpper && price > kcUpper) {
        direction = 'LONG';
        confidence = 0.85;
      }
      // Short signal: Price breaks below lower bands
      else if (price < bbLower && price < kcLower) {
        direction = 'SHORT';
        confidence = 0.85;
      }
    }
    // Close signal: Return to squeeze or opposite breakout
    else if (this.lastSignal && this.lastSignal.direction !== 'CLOSE') {
      const wasLong = this.lastSignal.direction === 'LONG';
      const wasShort = this.lastSignal.direction === 'SHORT';
      const price = candle.close;
      const bbLower = bb.lower;
      const bbUpper = bb.upper;

      if ((wasLong && price < bbLower) || (wasShort && price > bbUpper)) {
        direction = 'CLOSE';
        confidence = 0.9;
      }
    }

    if (direction && confidence >= minConfidence) {
      return this.createSignal(
        candle.symbol,
        direction,
        confidence,
        candle.close,
        1, // Default quantity
        this.calculateStopLoss(candle.close, direction),
        this.calculateTakeProfit(candle.close, direction)
      );
    }

    return null;
  }

  private calculateStopLoss(price: number, direction: 'LONG' | 'SHORT' | 'CLOSE'): number {
    const stopLossPercent = 0.015; // 1.5% stop loss for squeeze strategy
    
    if (direction === 'LONG') {
      return price * (1 - stopLossPercent);
    } else if (direction === 'SHORT') {
      return price * (1 + stopLossPercent);
    }
    
    return 0;
  }

  private calculateTakeProfit(price: number, direction: 'LONG' | 'SHORT' | 'CLOSE'): number {
    const takeProfitPercent = 0.03; // 3% take profit for squeeze strategy
    
    if (direction === 'LONG') {
      return price * (1 + takeProfitPercent);
    } else if (direction === 'SHORT') {
      return price * (1 - takeProfitPercent);
    }
    
    return 0;
  }

  protected override async onInitialize(): Promise<void> {
    this.logger.info('Squeeze Strategy initialized with parameters', {
      bbPeriod: this.getParameter('bbPeriod'),
      bbStdDev: this.getParameter('bbStdDev'),
      kcPeriod: this.getParameter('kcPeriod'),
      kcStdDev: this.getParameter('kcStdDev'),
      minConfidence: this.getParameter('minConfidence')
    });
  }

  protected override async onCleanup(): Promise<void> {
    this.bbValues = [];
    this.kcValues = [];
    this.squeezeState = 'neutral';
    this.lastSignal = null;
  }
}

// Auto-register the strategy
registerStrategy(new SqueezeStrategy());