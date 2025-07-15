import { Strategy, Candle, TradeSignal } from '../types';
import { createModuleLogger } from '../utils/logger';
import { getHistory } from '../cache/historicalCache';

const logger = createModuleLogger('BaseStrategy');

export abstract class BaseStrategy implements Strategy {
  public abstract name: string;
  public abstract symbols: string[];
  public abstract intervals: string[];
  public enabled: boolean = true;
  public parameters: Record<string, any> = {};
  
  protected logger = createModuleLogger('BaseStrategy');
  protected initialized = false;

  constructor(parameters: Record<string, any> = {}) {
    this.parameters = parameters;
  }

  public async initialize(): Promise<void> {
    if (this.initialized) {
      this.logger.warn('Strategy already initialized');
      return;
    }

    try {
      this.logger.info('Initializing strategy', {
        name: this.name,
        symbols: this.symbols,
        intervals: this.intervals,
        parameters: this.parameters
      });

      // Load historical data for warm-up
      await this.loadHistoricalData();
      
      // Call strategy-specific initialization
      await this.onInitialize();
      
      this.initialized = true;
      this.logger.info('Strategy initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize strategy', error as Error);
      throw error;
    }
  }

  public async onCandle(candle: Candle): Promise<TradeSignal | null> {
    if (!this.initialized) {
      this.logger.warn('Strategy not initialized, skipping candle');
      return null;
    }

    if (!this.enabled) {
      return null;
    }

    try {
      this.logger.debug('Processing candle', {
        symbol: candle.symbol,
        interval: candle.interval,
        price: candle.close,
        timestamp: new Date(candle.timestamp).toISOString()
      });

      // Call strategy-specific candle processing
      const signal = await this.processCandle(candle);
      
      if (signal) {
        this.logger.info('Signal generated', {
          symbol: signal.symbol,
          direction: signal.direction,
          confidence: signal.confidence
        });
      }

      return signal;
    } catch (error) {
      this.logger.error('Error processing candle', error as Error, {
        symbol: candle.symbol,
        interval: candle.interval
      });
      return null;
    }
  }

  public async onTick(tick: any): Promise<TradeSignal | null> {
    // Default implementation - override in subclasses if needed
    return null;
  }

  public async cleanup(): Promise<void> {
    try {
      this.logger.info('Cleaning up strategy');
      await this.onCleanup();
      this.initialized = false;
      this.logger.info('Strategy cleanup completed');
    } catch (error) {
      this.logger.error('Error during strategy cleanup', error as Error);
    }
  }

  // Abstract methods that must be implemented by subclasses
  protected abstract processCandle(candle: Candle): Promise<TradeSignal | null>;
  
  // Optional methods that can be overridden
  protected async onInitialize(): Promise<void> {
    // Override in subclasses for custom initialization
  }

  protected async onCleanup(): Promise<void> {
    // Override in subclasses for custom cleanup
  }

  // Utility methods for common strategy operations
  protected async getHistoricalData(symbol: string, interval: string, lookback: number = 100): Promise<Candle[]> {
    return getHistory(symbol, interval, lookback);
  }

  protected createSignal(
    symbol: string,
    direction: 'LONG' | 'SHORT' | 'CLOSE',
    confidence: number,
    price?: number,
    quantity?: number,
    stopLoss?: number,
    takeProfit?: number
  ): TradeSignal {
    const signal: TradeSignal = {
      symbol,
      direction,
      confidence,
      strategy: this.name,
      timestamp: Date.now()
    };

    if (price !== undefined) signal.price = price;
    if (quantity !== undefined) signal.quantity = quantity;
    if (stopLoss !== undefined) signal.stopLoss = stopLoss;
    if (takeProfit !== undefined) signal.takeProfit = takeProfit;

    return signal;
  }

  protected validateSignal(signal: TradeSignal): boolean {
    if (signal.confidence < 0 || signal.confidence > 1) {
      this.logger.warn('Invalid signal confidence', { confidence: signal.confidence });
      return false;
    }

    if (!this.symbols.includes(signal.symbol)) {
      this.logger.warn('Signal for unsubscribed symbol', { symbol: signal.symbol });
      return false;
    }

    return true;
  }

  // Parameter management
  public getParameter(key: string, defaultValue?: any): any {
    return this.parameters[key] ?? defaultValue;
  }

  public setParameter(key: string, value: any): void {
    this.parameters[key] = value;
    this.logger.debug('Parameter updated', { key, value });
  }

  // Strategy state management
  public enable(): void {
    this.enabled = true;
    this.logger.info('Strategy enabled');
  }

  public disable(): void {
    this.enabled = false;
    this.logger.info('Strategy disabled');
  }

  public isEnabled(): boolean {
    return this.enabled && this.initialized;
  }

  // Performance tracking
  protected trackPerformance(signal: TradeSignal): void {
    // Override in subclasses to track strategy performance
    this.logger.debug('Signal performance tracked', {
      symbol: signal.symbol,
      direction: signal.direction,
      confidence: signal.confidence
    });
  }

  private async loadHistoricalData(): Promise<void> {
    try {
      for (const symbol of this.symbols) {
        for (const interval of this.intervals) {
          const data = await this.getHistoricalData(symbol, interval, 100);
          this.logger.debug(`Loaded ${data.length} historical candles for ${symbol}_${interval}`);
        }
      }
    } catch (error) {
      this.logger.warn('Failed to load some historical data', error as Error);
    }
  }
}