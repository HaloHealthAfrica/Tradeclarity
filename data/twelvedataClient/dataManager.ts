import { fetchHistoricalCandles } from './restClient';
import { updateCache } from '../../cache/historicalCache';

export const initializeSymbol = async (symbol: string, tf: string) => {
    const candles = await fetchHistoricalCandles(symbol, tf, 100);
    candles.reverse().forEach(c => updateCache(symbol, tf, c));
};
