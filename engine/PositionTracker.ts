import { Position, Trade } from '../types';
import { createModuleLogger } from '../utils/logger';

const logger = createModuleLogger('PositionTracker');

const openPositions: Record<string, Position> = {};

export const trackPosition = async (symbol: string, trade: Trade): Promise<void> => {
  try {
    logger.info('Tracking position', {
      symbol,
      tradeId: trade.id,
      side: trade.side,
      quantity: trade.quantity,
      price: trade.price
    });

    const existingPosition = openPositions[symbol];
    
    if (existingPosition) {
      // Update existing position
      const isLongPosition = existingPosition.quantity > 0;
      const isBuyOrder = trade.side === 'buy';
      
      if (isLongPosition === isBuyOrder) {
        // Same direction - add to position
        const totalQuantity = existingPosition.quantity + trade.quantity;
        const totalValue = (existingPosition.quantity * existingPosition.averagePrice) + 
                          (trade.quantity * trade.price);
        const newAveragePrice = totalValue / totalQuantity;
        
        openPositions[symbol] = {
          ...existingPosition,
          quantity: totalQuantity,
          averagePrice: newAveragePrice,
          currentPrice: trade.price,
          unrealizedPnL: (trade.price - newAveragePrice) * totalQuantity
        };
      } else {
        // Opposite direction - reduce or close position
        const remainingQuantity = existingPosition.quantity - trade.quantity;
        
        if (remainingQuantity === 0) {
          // Position closed
          delete openPositions[symbol];
          logger.info('Position closed', { symbol });
        } else if (remainingQuantity > 0) {
          // Position reduced
          openPositions[symbol] = {
            ...existingPosition,
            quantity: remainingQuantity,
            currentPrice: trade.price,
            unrealizedPnL: (trade.price - existingPosition.averagePrice) * remainingQuantity
          };
        } else {
          // Position reversed
          openPositions[symbol] = {
            symbol,
            quantity: Math.abs(remainingQuantity),
            averagePrice: trade.price,
            currentPrice: trade.price,
            unrealizedPnL: 0,
            strategy: trade.strategy,
            entryTime: Date.now()
          };
        }
      }
    } else {
      // New position
      openPositions[symbol] = {
        symbol,
        quantity: trade.quantity,
        averagePrice: trade.price,
        currentPrice: trade.price,
        unrealizedPnL: 0,
        strategy: trade.strategy,
        entryTime: Date.now()
      };
    }

    logger.info('Position updated', {
      symbol,
      quantity: openPositions[symbol]?.quantity || 0,
      averagePrice: openPositions[symbol]?.averagePrice || 0
    });
  } catch (error) {
    logger.error('Error tracking position', error as Error, { symbol, trade });
    throw error;
  }
};

export const getOpenPositions = (): Record<string, Position> => {
  return { ...openPositions };
};

export const getPosition = (symbol: string): Position | null => {
  return openPositions[symbol] || null;
};

export const updatePositionPrice = (symbol: string, currentPrice: number): void => {
  const position = openPositions[symbol];
  if (position) {
    position.currentPrice = currentPrice;
    position.unrealizedPnL = (currentPrice - position.averagePrice) * position.quantity;
  }
};

export const closePosition = (symbol: string): Position | null => {
  const position = openPositions[symbol];
  if (position) {
    delete openPositions[symbol];
    logger.info('Position manually closed', { symbol, quantity: position.quantity });
    return position;
  }
  return null;
};

export const getTotalUnrealizedPnL = (): number => {
  return Object.values(openPositions).reduce((total, position) => {
    return total + position.unrealizedPnL;
  }, 0);
};

export const getPositionCount = (): number => {
  return Object.keys(openPositions).length;
};
