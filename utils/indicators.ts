/**
 * Technical Indicators for Trading Strategies
 * 
 * This module provides common technical indicators used in trading strategies:
 * - EMA (Exponential Moving Average)
 * - RSI (Relative Strength Index)
 * - MACD (Moving Average Convergence Divergence)
 * - Volume analysis
 * - Support/Resistance levels
 */

/**
 * Calculate Exponential Moving Average (EMA)
 * @param prices Array of price values
 * @param period EMA period
 * @returns EMA value
 */
export function calculateEMA(prices: number[], period: number): number {
  if (prices.length < period) {
    throw new Error(`Insufficient data for EMA calculation. Need ${period} values, got ${prices.length}`);
  }

  const multiplier = 2 / (period + 1);
  let ema = prices[0];

  for (let i = 1; i < prices.length; i++) {
    ema = (prices[i] * multiplier) + (ema * (1 - multiplier));
  }

  return ema;
}

/**
 * Calculate Simple Moving Average (SMA)
 * @param prices Array of price values
 * @param period SMA period
 * @returns SMA value
 */
export function calculateSMA(prices: number[], period: number): number {
  if (prices.length < period) {
    throw new Error(`Insufficient data for SMA calculation. Need ${period} values, got ${prices.length}`);
  }

  const sum = prices.slice(-period).reduce((acc, price) => acc + price, 0);
  return sum / period;
}

/**
 * Calculate Relative Strength Index (RSI)
 * @param prices Array of price values
 * @param period RSI period (default: 14)
 * @returns RSI value (0-100)
 */
export function calculateRSI(prices: number[], period: number = 14): number {
  if (prices.length < period + 1) {
    throw new Error(`Insufficient data for RSI calculation. Need ${period + 1} values, got ${prices.length}`);
  }

  let gains = 0;
  let losses = 0;

  // Calculate initial gains and losses
  for (let i = 1; i <= period; i++) {
    const change = prices[i] - prices[i - 1];
    if (change > 0) {
      gains += change;
    } else {
      losses -= change;
    }
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  // Calculate RSI for remaining periods
  for (let i = period + 1; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    let currentGain = 0;
    let currentLoss = 0;

    if (change > 0) {
      currentGain = change;
    } else {
      currentLoss = -change;
    }

    avgGain = (avgGain * (period - 1) + currentGain) / period;
    avgLoss = (avgLoss * (period - 1) + currentLoss) / period;
  }

  if (avgLoss === 0) return 100;
  
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

/**
 * Calculate MACD (Moving Average Convergence Divergence)
 * @param prices Array of price values
 * @param fastPeriod Fast EMA period (default: 12)
 * @param slowPeriod Slow EMA period (default: 26)
 * @param signalPeriod Signal line period (default: 9)
 * @returns MACD object with macd, signal, and histogram values
 */
export function calculateMACD(
  prices: number[], 
  fastPeriod: number = 12, 
  slowPeriod: number = 26, 
  signalPeriod: number = 9
): { macd: number; signal: number; histogram: number } {
  if (prices.length < slowPeriod) {
    throw new Error(`Insufficient data for MACD calculation. Need ${slowPeriod} values, got ${prices.length}`);
  }

  // Calculate fast and slow EMAs
  const fastEMA = calculateEMA(prices, fastPeriod);
  const slowEMA = calculateEMA(prices, slowPeriod);

  // Calculate MACD line
  const macdLine = fastEMA - slowEMA;

  // Calculate signal line (EMA of MACD line)
  // For simplicity, we'll use the current MACD value as signal
  // In a full implementation, you'd need to track MACD values over time
  const signalLine = macdLine; // Simplified - should be EMA of MACD values

  // Calculate histogram
  const histogram = macdLine - signalLine;

  return {
    macd: macdLine,
    signal: signalLine,
    histogram: histogram
  };
}

/**
 * Calculate Bollinger Bands
 * @param prices Array of price values
 * @param period Period for SMA calculation (default: 20)
 * @param stdDev Standard deviation multiplier (default: 2)
 * @returns Object with upper, middle, and lower bands
 */
export function calculateBollingerBands(
  prices: number[], 
  period: number = 20, 
  stdDev: number = 2
): { upper: number; middle: number; lower: number } {
  if (prices.length < period) {
    throw new Error(`Insufficient data for Bollinger Bands calculation. Need ${period} values, got ${prices.length}`);
  }

  const sma = calculateSMA(prices, period);
  const recentPrices = prices.slice(-period);
  
  // Calculate standard deviation
  const variance = recentPrices.reduce((sum, price) => sum + Math.pow(price - sma, 2), 0) / period;
  const standardDeviation = Math.sqrt(variance);

  return {
    upper: sma + (standardDeviation * stdDev),
    middle: sma,
    lower: sma - (standardDeviation * stdDev)
  };
}

/**
 * Calculate Average True Range (ATR)
 * @param highs Array of high prices
 * @param lows Array of low prices
 * @param closes Array of close prices
 * @param period ATR period (default: 14)
 * @returns ATR value
 */
export function calculateATR(
  highs: number[], 
  lows: number[], 
  closes: number[], 
  period: number = 14
): number {
  if (highs.length < period + 1 || lows.length < period + 1 || closes.length < period + 1) {
    throw new Error(`Insufficient data for ATR calculation. Need ${period + 1} values`);
  }

  const trueRanges: number[] = [];

  for (let i = 1; i < highs.length; i++) {
    const highLow = highs[i] - lows[i];
    const highClose = Math.abs(highs[i] - closes[i - 1]);
    const lowClose = Math.abs(lows[i] - closes[i - 1]);

    const trueRange = Math.max(highLow, highClose, lowClose);
    trueRanges.push(trueRange);
  }

  // Calculate average of true ranges
  const sum = trueRanges.slice(-period).reduce((acc, tr) => acc + tr, 0);
  return sum / period;
}

/**
 * Calculate Stochastic Oscillator
 * @param highs Array of high prices
 * @param lows Array of low prices
 * @param closes Array of close prices
 * @param kPeriod K period (default: 14)
 * @param dPeriod D period (default: 3)
 * @returns Object with %K and %D values
 */
export function calculateStochastic(
  highs: number[], 
  lows: number[], 
  closes: number[], 
  kPeriod: number = 14, 
  dPeriod: number = 3
): { k: number; d: number } {
  if (highs.length < kPeriod || lows.length < kPeriod || closes.length < kPeriod) {
    throw new Error(`Insufficient data for Stochastic calculation. Need ${kPeriod} values`);
  }

  const recentHighs = highs.slice(-kPeriod);
  const recentLows = lows.slice(-kPeriod);
  const recentCloses = closes.slice(-kPeriod);

  const highestHigh = Math.max(...recentHighs);
  const lowestLow = Math.min(...recentLows);
  const currentClose = recentCloses[recentCloses.length - 1];

  const k = ((currentClose - lowestLow) / (highestHigh - lowestLow)) * 100;

  // For simplicity, D is the same as K in this implementation
  // In a full implementation, D would be an SMA of K values
  const d = k;

  return { k, d };
}

/**
 * Calculate Volume Weighted Average Price (VWAP)
 * @param prices Array of price values
 * @param volumes Array of volume values
 * @returns VWAP value
 */
export function calculateVWAP(prices: number[], volumes: number[]): number {
  if (prices.length !== volumes.length) {
    throw new Error('Price and volume arrays must have the same length');
  }

  if (prices.length === 0) {
    throw new Error('Cannot calculate VWAP with empty data');
  }

  const totalVolume = volumes.reduce((sum, volume) => sum + volume, 0);
  const volumePriceSum = prices.reduce((sum, price, index) => sum + (price * volumes[index]), 0);

  return volumePriceSum / totalVolume;
}

/**
 * Calculate Fibonacci Retracement Levels
 * @param high High price
 * @param low Low price
 * @returns Object with Fibonacci retracement levels
 */
export function calculateFibonacciRetracements(high: number, low: number): {
  r0: number;
  r236: number;
  r382: number;
  r500: number;
  r618: number;
  r786: number;
  r100: number;
} {
  const range = high - low;

  return {
    r0: high,
    r236: high - (range * 0.236),
    r382: high - (range * 0.382),
    r500: high - (range * 0.500),
    r618: high - (range * 0.618),
    r786: high - (range * 0.786),
    r100: low
  };
}

/**
 * Calculate Fibonacci Extension Levels
 * @param high High price
 * @param low Low price
 * @returns Object with Fibonacci extension levels
 */
export function calculateFibonacciExtensions(high: number, low: number): {
  e127: number;
  e161: number;
  e200: number;
  e261: number;
  e314: number;
} {
  const range = high - low;

  return {
    e127: high + (range * 1.27),
    e161: high + (range * 1.618),
    e200: high + (range * 2.0),
    e261: high + (range * 2.618),
    e314: high + (range * 3.14)
  };
}

/**
 * Detect candlestick patterns
 * @param open Open price
 * @param high High price
 * @param low Low price
 * @param close Close price
 * @returns Object with detected patterns
 */
export function detectCandlestickPatterns(
  open: number, 
  high: number, 
  low: number, 
  close: number
): {
  doji: boolean;
  hammer: boolean;
  shootingStar: boolean;
  engulfing: boolean;
  marubozu: boolean;
} {
  const bodySize = Math.abs(close - open);
  const totalRange = high - low;
  const bodyRatio = bodySize / totalRange;
  const upperShadow = high - Math.max(open, close);
  const lowerShadow = Math.min(open, close) - low;

  return {
    doji: bodyRatio < 0.1,
    hammer: lowerShadow > 2 * bodySize && upperShadow < bodySize,
    shootingStar: upperShadow > 2 * bodySize && lowerShadow < bodySize,
    engulfing: false, // Would need previous candle for comparison
    marubozu: bodyRatio > 0.8 && (upperShadow < bodySize * 0.1 || lowerShadow < bodySize * 0.1)
  };
}

/**
 * Calculate support and resistance levels
 * @param prices Array of price values
 * @param lookback Number of periods to look back
 * @returns Object with support and resistance levels
 */
export function calculateSupportResistance(
  prices: number[], 
  lookback: number = 20
): { support: number; resistance: number } {
  if (prices.length < lookback) {
    throw new Error(`Insufficient data for support/resistance calculation. Need ${lookback} values, got ${prices.length}`);
  }

  const recentPrices = prices.slice(-lookback);
  const support = Math.min(...recentPrices);
  const resistance = Math.max(...recentPrices);

  return { support, resistance };
}