// EMAConfluence.ts
import { Candle, TradeSignal } from '../types';
import { BaseStrategy } from './BaseStrategy';
import { registerStrategy } from './StrategyLoader';

export class EMAConfluence extends BaseStrategy {
  public name = 'EMAConfluence';
  public symbols = ['AAPL', 'MSFT'];
  public intervals = ['5m', '15m'];

  private fastEma: number[] = [];
  private slowEma: number[] = [];
  private rsiValues: number[] = [];
  private lastSignal: TradeSignal | null = null;

  constructor(parameters: Record<string, any> = {}) {
    super(parameters);
    
    // Set default parameters
    this.setParameter('fastEma', parameters.fastEma || 9);
    this.setParameter('slowEma', parameters.slowEma || 21);
    this.setParameter('rsiPeriod', parameters.rsiPeriod || 14);
    this.setParameter('rsiOverbought', parameters.rsiOverbought || 70);
    this.setParameter('rsiOversold', parameters.rsiOversold || 30);
    this.setParameter('minConfidence', parameters.minConfidence || 0.7);
  }

  protected async processCandle(candle: Candle): Promise<TradeSignal | null> {
    try {
      // Get historical data for calculations
      const historicalData = await this.getHistoricalData(candle.symbol, candle.interval, 100);
      
      if (historicalData.length < this.getParameter('slowEma')) {
        this.logger.debug('Insufficient historical data for calculations');
        return null;
      }

      // Calculate indicators
      const fastEma = this.calculateEMA(historicalData, this.getParameter('fastEma'));
      const slowEma = this.calculateEMA(historicalData, this.getParameter('slowEma'));
      const rsi = this.calculateRSI(historicalData, this.getParameter('rsiPeriod'));

      // Store latest values
      this.fastEma.push(fastEma);
      this.slowEma.push(slowEma);
      this.rsiValues.push(rsi);

      // Keep only recent values
      if (this.fastEma.length > 10) {
        this.fastEma.shift();
        this.slowEma.shift();
        this.rsiValues.shift();
      }

      // Generate signal based on confluence
      const signal = this.generateSignal(candle, fastEma, slowEma, rsi);
      
      if (signal) {
        this.lastSignal = signal;
        this.trackPerformance(signal);
      }

      return signal;
    } catch (error) {
      this.logger.error('Error processing candle in EMA Confluence', error as Error);
      return null;
    }
  }

  private calculateEMA(data: Candle[], period: number): number {
    const multiplier = 2 / (period + 1);
    let ema = data[0].close;

    for (let i = 1; i < data.length; i++) {
      ema = (data[i].close * multiplier) + (ema * (1 - multiplier));
    }

    return ema;
  }

  private calculateRSI(data: Candle[], period: number): number {
    if (data.length < period + 1) return 50;

    let gains = 0;
    let losses = 0;

    for (let i = 1; i <= period; i++) {
      const change = data[i].close - data[i - 1].close;
      if (change > 0) {
        gains += change;
      } else {
        losses -= change;
      }
    }

    const avgGain = gains / period;
    const avgLoss = losses / period;
    const rs = avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));

    return rsi;
  }

  private generateSignal(candle: Candle, fastEma: number, slowEma: number, rsi: number): TradeSignal | null {
    const minConfidence = this.getParameter('minConfidence');
    const rsiOverbought = this.getParameter('rsiOverbought');
    const rsiOversold = this.getParameter('rsiOversold');

    let direction: 'LONG' | 'SHORT' | 'CLOSE' | null = null;
    let confidence = 0;

    // EMA crossover logic
    const emaBullish = fastEma > slowEma;
    const emaBearish = fastEma < slowEma;
    const rsiBullish = rsi < rsiOversold;
    const rsiBearish = rsi > rsiOverbought;

    // Long signal: Fast EMA above slow EMA + RSI oversold
    if (emaBullish && rsiBullish) {
      direction = 'LONG';
      confidence = 0.8;
    }
    // Short signal: Fast EMA below slow EMA + RSI overbought
    else if (emaBearish && rsiBearish) {
      direction = 'SHORT';
      confidence = 0.8;
    }
    // Close signal: EMA crossover
    else if (this.lastSignal && this.lastSignal.direction !== 'CLOSE') {
      const wasLong = this.lastSignal.direction === 'LONG';
      const wasShort = this.lastSignal.direction === 'SHORT';
      
      if ((wasLong && emaBearish) || (wasShort && emaBullish)) {
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
    const stopLossPercent = 0.02; // 2% stop loss
    
    if (direction === 'LONG') {
      return price * (1 - stopLossPercent);
    } else if (direction === 'SHORT') {
      return price * (1 + stopLossPercent);
    }
    
    return 0;
  }

  private calculateTakeProfit(price: number, direction: 'LONG' | 'SHORT' | 'CLOSE'): number {
    const takeProfitPercent = 0.04; // 4% take profit
    
    if (direction === 'LONG') {
      return price * (1 + takeProfitPercent);
    } else if (direction === 'SHORT') {
      return price * (1 - takeProfitPercent);
    }
    
    return 0;
  }

  protected override async onInitialize(): Promise<void> {
    this.logger.info('EMA Confluence strategy initialized with parameters', {
      fastEma: this.getParameter('fastEma'),
      slowEma: this.getParameter('slowEma'),
      rsiPeriod: this.getParameter('rsiPeriod'),
      minConfidence: this.getParameter('minConfidence')
    });
  }

  protected override async onCleanup(): Promise<void> {
    this.fastEma = [];
    this.slowEma = [];
    this.rsiValues = [];
    this.lastSignal = null;
  }
}

// Auto-register the strategy
registerStrategy('EMAConfluence', EMAConfluence);