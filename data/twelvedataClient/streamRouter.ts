import { Candle } from '../../types';
import { createModuleLogger } from '../../utils/logger';

const logger = createModuleLogger('StreamRouter');

type Listener = (candle: Candle) => void;

interface ListenerInfo {
  fn: Listener;
  module: string;
  timestamp: number;
}

const listeners: Record<string, ListenerInfo[]> = {};

export const streamRouter = {
  subscribe: (symbol: string, tf: string, fn: Listener, module: string = 'unknown') => {
    const key = `${symbol}_${tf}`;
    if (!listeners[key]) listeners[key] = [];
    
    const listenerInfo: ListenerInfo = {
      fn,
      module,
      timestamp: Date.now()
    };
    
    listeners[key].push(listenerInfo);
    logger.info(`Subscribed to ${key}`, { module, totalListeners: listeners[key].length });
  },

  notify: (symbol: string, tf: string, candle: Candle) => {
    const key = `${symbol}_${tf}`;
    const keyListeners = listeners[key];
    
    if (!keyListeners || keyListeners.length === 0) {
      logger.debug(`No listeners for ${key}`);
      return;
    }

    logger.debug(`Notifying ${keyListeners.length} listeners for ${key}`);
    
    keyListeners.forEach((listenerInfo, index) => {
      try {
        listenerInfo.fn(candle);
      } catch (error) {
        logger.error(`Error in listener ${index} for ${key}`, error as Error, { 
          module: listenerInfo.module 
        });
      }
    });
  },

  unsubscribe: (symbol: string, tf: string, fn: Listener) => {
    const key = `${symbol}_${tf}`;
    const keyListeners = listeners[key];
    
    if (keyListeners) {
      const initialLength = keyListeners.length;
      const filtered = keyListeners.filter(listener => listener.fn !== fn);
      listeners[key] = filtered;
      
      const removed = initialLength - filtered.length;
      if (removed > 0) {
        logger.info(`Unsubscribed from ${key}`, { removed, remaining: filtered.length });
      }
    }
  },

  getListenerCount: (symbol: string, tf: string): number => {
    const key = `${symbol}_${tf}`;
    return listeners[key]?.length || 0;
  },

  getActiveSubscriptions: (): Record<string, number> => {
    const result: Record<string, number> = {};
    for (const [key, keyListeners] of Object.entries(listeners)) {
      result[key] = keyListeners.length;
    }
    return result;
  },

  clearAll: () => {
    const totalListeners = Object.values(listeners).reduce((sum, arr) => sum + arr.length, 0);
    Object.keys(listeners).forEach(key => delete listeners[key]);
    logger.info('Cleared all stream router subscriptions', { totalListeners });
  }
};
