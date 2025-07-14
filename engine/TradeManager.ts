import { TradeSignal, Trade, TradeError } from '../types';
import { placeOrder } from '../broker/alpacaClient';
import { createModuleLogger } from '../utils/logger';

const logger = createModuleLogger('TradeManager');

export const executeTrade = async (signal: TradeSignal): Promise<Trade | null> => {
  try {
    logger.info('Executing trade', {
      symbol: signal.symbol,
      direction: signal.direction,
      confidence: signal.confidence
    });

    const side = signal.direction === 'LONG' ? 'buy' : 'sell';
    const quantity = signal.quantity || 1; // Default to 1 share

    const orderResponse = await placeOrder(signal.symbol, quantity, side);
    
    if (!orderResponse || !orderResponse.id) {
      logger.error('Invalid order response from broker', { orderResponse });
      return null;
    }

    const trade: Trade = {
      id: orderResponse.id,
      symbol: signal.symbol,
      side,
      quantity,
      price: orderResponse.filled_avg_price || signal.price || 0,
      timestamp: Date.now(),
      status: orderResponse.status || 'pending',
      strategy: signal.strategy
    };

    logger.info('Trade executed successfully', {
      tradeId: trade.id,
      symbol: trade.symbol,
      side: trade.side,
      quantity: trade.quantity,
      price: trade.price
    });

    return trade;
  } catch (error) {
    logger.error('Failed to execute trade', error as Error, {
      symbol: signal.symbol,
      direction: signal.direction
    });
    throw new TradeError('Failed to execute trade', {
      signal,
      error: error instanceof Error ? error.message : String(error)
    });
  }
};
