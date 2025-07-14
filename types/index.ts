// Core data types
export interface Candle {
  symbol: string;
  interval: string;
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TradeSignal {
  symbol: string;
  direction: 'LONG' | 'SHORT' | 'CLOSE';
  confidence: number;
  strategy: string;
  timestamp: number;
  price?: number;
  quantity?: number;
  stopLoss?: number;
  takeProfit?: number;
}

export interface Trade {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  price: number;
  timestamp: number;
  status: 'pending' | 'filled' | 'cancelled' | 'rejected';
  strategy: string;
}

export interface Position {
  symbol: string;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  unrealizedPnL: number;
  strategy: string;
  entryTime: number;
}

// Storage interface
export interface IStorage {
  get(key: string): Promise<any>;
  set(key: string, value: any): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  keys(): Promise<string[]>;
}

// Configuration types
export interface TwelveDataConfig {
  apiKey: string;
  baseUrl: string;
  websocketUrl: string;
  symbols: string[];
  intervals: string[];
}

export interface AlpacaConfig {
  apiKey: string;
  apiSecret: string;
  baseUrl: string;
  paperTrading: boolean;
}

export interface StrategyConfig {
  name: string;
  symbols: string[];
  intervals: string[];
  enabled: boolean;
  parameters: Record<string, any>;
}

export interface SystemConfig {
  twelveData: TwelveDataConfig;
  alpaca: AlpacaConfig;
  strategies: StrategyConfig[];
  cache: {
    maxSize: number;
    ttl: number;
  };
  risk: {
    maxPositionSize: number;
    maxDailyLoss: number;
    maxDrawdown: number;
  };
}

// Event types
export interface MarketDataEvent {
  type: 'candle' | 'tick' | 'trade';
  data: Candle | any;
  symbol: string;
  interval: string;
  timestamp: number;
}

export interface TradeEvent {
  type: 'signal' | 'execution' | 'position_update';
  data: TradeSignal | Trade | Position;
  timestamp: number;
}

// Strategy interface
export interface Strategy {
  name: string;
  symbols: string[];
  intervals: string[];
  enabled: boolean;
  
  initialize(): Promise<void>;
  onCandle(candle: Candle): Promise<TradeSignal | null>;
  onTick(tick: any): Promise<TradeSignal | null>;
  cleanup(): Promise<void>;
}

// Error types
export class TradingSystemError extends Error {
  constructor(
    message: string,
    public code: string,
    public context?: Record<string, any>
  ) {
    super(message);
    this.name = 'TradingSystemError';
  }
}

export class DataError extends TradingSystemError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'DATA_ERROR', context);
    this.name = 'DataError';
  }
}

export class TradeError extends TradingSystemError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'TRADE_ERROR', context);
    this.name = 'TradeError';
  }
}

// Utility types
export type Timeframe = '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d';

export type OrderSide = 'buy' | 'sell';

export type OrderType = 'market' | 'limit' | 'stop' | 'stop_limit';

export type OrderStatus = 'pending' | 'filled' | 'cancelled' | 'rejected';

// Cache types
export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  maxSize: number;
} 