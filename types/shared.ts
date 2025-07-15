export interface Strategy {
  name: string;
  symbols: string[];
  intervals: string[];
  enabled: boolean;
  parameters?: Record<string, any>;
}

export interface Signal {
  symbol: string;
  direction: 'LONG' | 'SHORT';
  confidence: number;
  strategy: string;
  timestamp: number;
  entry?: number;
  stop?: number;
  target?: number;
  positionSize?: number;
  marketContext?: MarketContext;
  expectedHold?: number;
  optimalEntry?: number;
  optionsData?: any;
}

export interface InsertSignal {
  symbol: string;
  direction: 'LONG' | 'SHORT';
  confidence: number;
  strategy: string;
  timestamp: number;
  entry?: number;
  stop?: number;
  target?: number;
  positionSize?: number;
  marketContext?: MarketContext;
  expectedHold?: number;
  optimalEntry?: number;
  optionsData?: any;
}

export interface MarketData {
  symbol: string;
  price: number;
  volume: number;
  timestamp: number;
  technicalIndicators?: TechnicalIndicators;
  priceChange?: number;
  volatility?: number;
}

export interface EnhancedMarketData extends MarketData {
  symbol: string;
  price: number;
  volume: number;
  timestamp: number;
  technicalIndicators?: TechnicalIndicators;
  priceChange?: number;
  volatility?: number;
}

export interface TechnicalIndicators {
  rsi?: number;
  macd?: {
    macd: number;
    signal: number;
    histogram: number;
  };
  ema?: {
    ema9: number;
    ema21: number;
  };
  bollingerBands?: {
    upper: number;
    middle: number;
    lower: number;
  };
  atr?: number;
  adx?: number;
}

export interface MarketContext {
  trend: 'BULLISH' | 'BEARISH' | 'SIDEWAYS';
  volatility: 'LOW' | 'MEDIUM' | 'HIGH';
  volume: 'LOW' | 'MEDIUM' | 'HIGH';
  session: 'PRE_MARKET' | 'REGULAR' | 'AFTER_HOURS';
  regime: 'TRENDING' | 'RANGING' | 'BREAKOUT';
} 