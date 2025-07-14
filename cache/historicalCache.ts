import { Candle, CacheEntry, CacheStats, DataError } from '../types';
import { createModuleLogger } from '../utils/logger';

const logger = createModuleLogger('HistoricalCache');

interface CacheData {
  candles: Candle[];
  lastUpdate: number;
  stats: CacheStats;
}

const cache: Record<string, CacheData> = {};
const maxCacheSize = 1000;
const defaultTTL = 3600000; // 1 hour in milliseconds

export const getHistory = (symbol: string, tf: string, lookback: number): Candle[] => {
  try {
    const key = `${symbol}_${tf}`;
    const cacheData = cache[key];
    
    if (!cacheData) {
      logger.debug(`Cache miss for ${key}`);
      return [];
    }

    // Check if cache is stale
    const now = Date.now();
    if (now - cacheData.lastUpdate > defaultTTL) {
      logger.warn(`Cache expired for ${key}, clearing`);
      delete cache[key];
      return [];
    }

    const candles = cacheData.candles.slice(-lookback);
    cacheData.stats.hits++;
    
    logger.debug(`Cache hit for ${key}, returned ${candles.length} candles`);
    return candles;
  } catch (error) {
    logger.error(`Error getting history for ${symbol}_${tf}`, error as Error);
    throw new DataError(`Failed to get history for ${symbol}_${tf}`, { symbol, tf, lookback });
  }
};

export const updateCache = (symbol: string, tf: string, newCandle: Candle): void => {
  try {
    const key = `${symbol}_${tf}`;
    
    if (!cache[key]) {
      cache[key] = {
        candles: [],
        lastUpdate: Date.now(),
        stats: { hits: 0, misses: 0, size: 0, maxSize: maxCacheSize }
      };
    }

    const cacheData = cache[key];
    cacheData.candles.push(newCandle);
    cacheData.lastUpdate = Date.now();
    cacheData.stats.size = cacheData.candles.length;

    // Trim oldest candles if exceeding max size
    if (cacheData.candles.length > maxCacheSize) {
      const removed = cacheData.candles.length - maxCacheSize;
      cacheData.candles.splice(0, removed);
      logger.debug(`Trimmed ${removed} old candles from ${key}`);
    }

    logger.debug(`Updated cache for ${key}, total candles: ${cacheData.candles.length}`);
  } catch (error) {
    logger.error(`Error updating cache for ${symbol}_${tf}`, error as Error);
    throw new DataError(`Failed to update cache for ${symbol}_${tf}`, { symbol, tf, newCandle });
  }
};

export const getCacheStats = (): Record<string, CacheStats> => {
  const stats: Record<string, CacheStats> = {};
  for (const [key, data] of Object.entries(cache)) {
    stats[key] = { ...data.stats };
  }
  return stats;
};

export const clearCache = (symbol?: string, tf?: string): void => {
  if (symbol && tf) {
    const key = `${symbol}_${tf}`;
    delete cache[key];
    logger.info(`Cleared cache for ${key}`);
  } else {
    Object.keys(cache).forEach(key => delete cache[key]);
    logger.info('Cleared all cache');
  }
};

export const getCacheKeys = (): string[] => {
  return Object.keys(cache);
};
