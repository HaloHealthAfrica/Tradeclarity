import dotenv from 'dotenv';
import { SystemConfig, TwelveDataConfig, AlpacaConfig, StrategyConfig } from '../types';

// Load environment variables immediately
dotenv.config();

// Environment variable validation
const getRequiredEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

const getOptionalEnv = (key: string, defaultValue: string): string => {
  return process.env[key] || defaultValue;
};

// TwelveData configuration
const getTwelveDataConfig = (): TwelveDataConfig => {
  return {
    apiKey: getRequiredEnv('TWELVEDATA_API_KEY'),
    baseUrl: getOptionalEnv('TWELVEDATA_BASE_URL', 'https://api.twelvedata.com'),
    websocketUrl: getOptionalEnv('TWELVEDATA_WS_URL', 'wss://ws.twelvedata.com/v1/marketdata'),
    symbols: getOptionalEnv('TRADING_SYMBOLS', 'AAPL,MSFT,GOOGL,TSLA').split(','),
    intervals: getOptionalEnv('TRADING_INTERVALS', '1m,5m,15m').split(',')
  };
};

// Alpaca configuration
const getAlpacaConfig = (): AlpacaConfig => {
  return {
    apiKey: getRequiredEnv('ALPACA_API_KEY'),
    apiSecret: getRequiredEnv('ALPACA_API_SECRET'),
    baseUrl: getOptionalEnv('ALPACA_BASE_URL', 'https://paper-api.alpaca.markets'),
    paperTrading: getOptionalEnv('ALPACA_PAPER_TRADING', 'true') === 'true'
  };
};

// Strategy configurations
const getStrategyConfigs = (): StrategyConfig[] => {
  const defaultStrategies: StrategyConfig[] = [
    {
      name: 'EMAConfluence',
      symbols: ['AAPL', 'MSFT'],
      intervals: ['5m', '15m'],
      enabled: true,
      parameters: {
        fastEma: 9,
        slowEma: 21,
        rsiPeriod: 14,
        rsiOverbought: 70,
        rsiOversold: 30
      }
    },
    {
      name: 'SqueezeStrategy',
      symbols: ['TSLA', 'GOOGL'],
      intervals: ['1m', '5m'],
      enabled: true,
      parameters: {
        bbPeriod: 20,
        bbStdDev: 2,
        kcPeriod: 20,
        kcStdDev: 1.5
      }
    },
    {
      name: 'ICTStrategy',
      symbols: ['AAPL', 'MSFT', 'TSLA', 'GOOGL'],
      intervals: ['1m', '5m', '15m'],
      enabled: true,
      parameters: {
        fvgThreshold: 0.001,
        obThreshold: 0.002,
        liquidityThreshold: 0.005,
        patternConfirmation: 0.7,
        minConfidence: 0.75,
        maxFVG: 50,
        maxOB: 30,
        maxPatterns: 20
      }
    }
  ];

  // Override with environment variables if provided
  const strategyConfig = process.env.STRATEGY_CONFIG;
  if (strategyConfig) {
    try {
      return JSON.parse(strategyConfig);
    } catch (error) {
      console.warn('Invalid STRATEGY_CONFIG, using defaults');
      return defaultStrategies;
    }
  }

  return defaultStrategies;
};

// System configuration
export const getSystemConfig = (): SystemConfig => {
  return {
    twelveData: getTwelveDataConfig(),
    alpaca: getAlpacaConfig(),
    strategies: getStrategyConfigs(),
    cache: {
      maxSize: parseInt(getOptionalEnv('CACHE_MAX_SIZE', '1000')),
      ttl: parseInt(getOptionalEnv('CACHE_TTL', '3600')) // 1 hour
    },
    risk: {
      maxPositionSize: parseFloat(getOptionalEnv('MAX_POSITION_SIZE', '10000')),
      maxDailyLoss: parseFloat(getOptionalEnv('MAX_DAILY_LOSS', '1000')),
      maxDrawdown: parseFloat(getOptionalEnv('MAX_DRAWDOWN', '0.1')) // 10%
    }
  };
};

// Configuration validation
export const validateConfig = (config: SystemConfig): void => {
  const errors: string[] = [];

  if (!config.twelveData.apiKey) {
    errors.push('TWELVEDATA_API_KEY is required');
  }

  if (!config.alpaca.apiKey || !config.alpaca.apiSecret) {
    errors.push('ALPACA_API_KEY and ALPACA_API_SECRET are required');
  }

  if (config.strategies.length === 0) {
    errors.push('At least one strategy must be configured');
  }

  if (config.cache.maxSize <= 0) {
    errors.push('CACHE_MAX_SIZE must be positive');
  }

  if (config.risk.maxPositionSize <= 0) {
    errors.push('MAX_POSITION_SIZE must be positive');
  }

  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
  }
};

// Export singleton instance
export const systemConfig = getSystemConfig(); 