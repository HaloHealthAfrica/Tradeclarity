import { Candle, TradeSignal } from '../types';
import { BaseStrategy } from './BaseStrategy';
import { registerStrategy } from './StrategyLoader';

/**
 * Example Strategy Template
 * 
 * This is a template showing how to create a new strategy.
 * To add a new strategy:
 * 1. Copy this file and rename it
 * 2. Implement the processCandle method
 * 3. Add the import to strategies/index.ts
 * 4. Add configuration to config/systemConfig.ts
 */
export class ExampleStrategy extends BaseStrategy {
  public name = 'ExampleStrategy';
  public symbols = ['AAPL'];
  public intervals = ['5m'];

  private lastPrice: number = 0;
  private signalCount: number = 0;

  constructor(parameters: Record<string, any> = {}) {
    super(parameters);
    
    // Set default parameters
    this.setParameter('priceChangeThreshold', parameters.priceChangeThreshold || 0.01);
    this.setParameter('maxSignalsPerDay', parameters.maxSignalsPerDay || 5);
    this.setParameter('minConfidence', parameters.minConfidence || 0.6);
  }

  protected async processCandle(candle: Candle): Promise<TradeSignal | null> {
    try {
      // Simple example: Generate signal on significant price change
      if (this.lastPrice === 0) {
        this.lastPrice = candle.close;
        return null;
      }

      const priceChange = (candle.close - this.lastPrice) / this.lastPrice;
      const threshold = this.getParameter('priceChangeThreshold');
      const maxSignals = this.getParameter('maxSignalsPerDay');
      const minConfidence = this.getParameter('minConfidence');

      // Check if we've exceeded daily signal limit
      if (this.signalCount >= maxSignals) {
        this.logger.debug('Daily signal limit reached');
        return null;
      }

      let direction: 'LONG' | 'SHORT' | 'CLOSE' | null = null;
      let confidence = 0;

      // Generate signal based on price change
      if (priceChange > threshold) {
        direction = 'LONG';
        confidence = Math.min(0.8, 0.6 + (priceChange / threshold) * 0.2);
      } else if (priceChange < -threshold) {
        direction = 'SHORT';
        confidence = Math.min(0.8, 0.6 + (Math.abs(priceChange) / threshold) * 0.2);
      }

      if (direction && confidence >= minConfidence) {
        this.signalCount++;
        this.lastPrice = candle.close;
        
        this.logger.info('Example signal generated', {
          priceChange: priceChange.toFixed(4),
          direction,
          confidence: confidence.toFixed(2)
        });

        return this.createSignal(
          candle.symbol,
          direction,
          confidence,
          candle.close,
          1
        );
      }

      this.lastPrice = candle.close;
      return null;
    } catch (error) {
      this.logger.error('Error processing candle in Example Strategy', error as Error);
      return null;
    }
  }

  protected override async onInitialize(): Promise<void> {
    this.logger.info('Example Strategy initialized with parameters', {
      priceChangeThreshold: this.getParameter('priceChangeThreshold'),
      maxSignalsPerDay: this.getParameter('maxSignalsPerDay'),
      minConfidence: this.getParameter('minConfidence')
    });
  }

  protected override async onCleanup(): Promise<void> {
    this.lastPrice = 0;
    this.signalCount = 0;
  }
}

// Auto-register the strategy
registerStrategy('ExampleStrategy', ExampleStrategy); 