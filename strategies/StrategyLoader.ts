import { Strategy } from '../types/shared';
import { logger } from '../utils/logger';

// Strategy registry
const strategies = new Map<string, Strategy>();

export interface StrategyConfig {
  name: string;
  symbols: string[];
  intervals: string[];
  enabled: boolean;
  parameters?: Record<string, any>;
}

export const registerStrategy = (strategy: Strategy): void => {
  strategies.set(strategy.name, strategy);
  logger.info(`Strategy registered: ${strategy.name}`);
};

export const getAvailableStrategies = (): Strategy[] => {
  return Array.from(strategies.values());
};

export const getStrategyConfig = (name: string): Strategy | undefined => {
  return strategies.get(name);
};

export const discoverStrategies = (): void => {
  // Auto-discover strategies from the strategies directory
  logger.info('Discovering strategies...');
};

export const createStrategy = (config: StrategyConfig): Strategy => {
  return {
    name: config.name,
    symbols: config.symbols,
    intervals: config.intervals,
    enabled: config.enabled,
    parameters: config.parameters
  };
};

// Add missing exports
export const loadAllStrategies = (): void => {
  logger.info('Loading all strategies...');
  // This will be called when the module is imported
};

export const loadStrategy = (name: string): Strategy | undefined => {
  return getStrategyConfig(name);
};

// Export default strategies
export const defaultStrategies: Strategy[] = [
  {
    name: 'EMAConfluence',
    symbols: ['AAPL', 'MSFT'],
    intervals: ['5m', '15m'],
    enabled: true
  },
  {
    name: 'SqueezeStrategy',
    symbols: ['TSLA', 'GOOGL'],
    intervals: ['1m', '5m'],
    enabled: true
  }
];

// Register default strategies
defaultStrategies.forEach(strategy => registerStrategy(strategy)); 