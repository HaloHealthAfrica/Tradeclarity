import { TradeSignal, Trade, Position, TradeError } from '../types';
import { evaluateSignal } from './SignalEvaluator';
import { executeTrade } from './TradeManager';
import { trackPosition, getOpenPositions } from './PositionTracker';
import { createModuleLogger } from '../utils/logger';
import { systemConfig } from '../config/systemConfig';

const logger = createModuleLogger('TradeOrchestrator');

interface RiskCheckResult {
  passed: boolean;
  reason?: string;
}

class TradeOrchestrator {
  private dailyPnL = 0;
  private maxDailyLoss: number;
  private maxPositionSize: number;
  private maxDrawdown: number;

  constructor() {
    this.maxDailyLoss = systemConfig.risk.maxDailyLoss;
    this.maxPositionSize = systemConfig.risk.maxPositionSize;
    this.maxDrawdown = systemConfig.risk.maxDrawdown;
  }

  public async handleSignal(signal: TradeSignal): Promise<Trade | null> {
    try {
      logger.info('Processing trade signal', {
        symbol: signal.symbol,
        direction: signal.direction,
        confidence: signal.confidence,
        strategy: signal.strategy
      });

      // Evaluate signal quality
      if (!evaluateSignal(signal)) {
        logger.warn('Signal rejected by evaluator', {
          symbol: signal.symbol,
          confidence: signal.confidence
        });
        return null;
      }

      // Perform risk checks
      const riskCheck = await this.performRiskChecks(signal);
      if (!riskCheck.passed) {
        logger.warn('Signal rejected due to risk limits', {
          symbol: signal.symbol,
          reason: riskCheck.reason
        });
        return null;
      }

      // Execute the trade
      const trade = await executeTrade(signal);
      if (trade) {
        await trackPosition(signal.symbol, trade);
        this.updateDailyPnL(trade);
        
        logger.info('Trade executed successfully', {
          symbol: trade.symbol,
          side: trade.side,
          quantity: trade.quantity,
          price: trade.price
        });
      }

      return trade;
    } catch (error) {
      logger.error('Error handling trade signal', error as Error, {
        symbol: signal.symbol,
        direction: signal.direction
      });
      throw new TradeError('Failed to handle trade signal', {
        signal,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private async performRiskChecks(signal: TradeSignal): Promise<RiskCheckResult> {
    // Check daily loss limit
    if (this.dailyPnL <= -this.maxDailyLoss) {
      return { passed: false, reason: 'Daily loss limit exceeded' };
    }

    // Check position size limit
    const openPositions = getOpenPositions();
    const totalPositionValue = Object.values(openPositions).reduce((sum, pos) => {
      return sum + (pos.quantity * pos.currentPrice);
    }, 0);

    if (totalPositionValue >= this.maxPositionSize) {
      return { passed: false, reason: 'Maximum position size exceeded' };
    }

    // Check drawdown limit
    const currentDrawdown = this.calculateDrawdown();
    if (currentDrawdown >= this.maxDrawdown) {
      return { passed: false, reason: 'Maximum drawdown exceeded' };
    }

    // Check for existing position in same symbol
    const existingPosition = openPositions[signal.symbol];
    if (existingPosition && signal.direction !== 'CLOSE') {
      logger.warn('Position already exists for symbol', {
        symbol: signal.symbol,
        existingQuantity: existingPosition.quantity
      });
      return { passed: false, reason: 'Position already exists for symbol' };
    }

    return { passed: true };
  }

  private calculateDrawdown(): number {
    // Simplified drawdown calculation
    // In a real system, this would track peak equity and current equity
    return Math.abs(this.dailyPnL) / this.maxPositionSize;
  }

  private updateDailyPnL(trade: Trade): void {
    // Simplified PnL calculation
    // In a real system, this would calculate realized PnL from closed positions
    const position = getOpenPositions()[trade.symbol];
    if (position) {
      const unrealizedPnL = (trade.price - position.averagePrice) * trade.quantity;
      this.dailyPnL += unrealizedPnL;
    }
  }

  public getDailyPnL(): number {
    return this.dailyPnL;
  }

  public resetDailyPnL(): void {
    this.dailyPnL = 0;
    logger.info('Daily PnL reset');
  }

  public getRiskMetrics(): Record<string, number> {
    return {
      dailyPnL: this.dailyPnL,
      maxDailyLoss: this.maxDailyLoss,
      maxPositionSize: this.maxPositionSize,
      maxDrawdown: this.maxDrawdown,
      currentDrawdown: this.calculateDrawdown()
    };
  }
}

// Export singleton instance
export const tradeOrchestrator = new TradeOrchestrator();

// Legacy function for backward compatibility
export const handleSignal = async (signal: TradeSignal): Promise<Trade | null> => {
  return await tradeOrchestrator.handleSignal(signal);
};
