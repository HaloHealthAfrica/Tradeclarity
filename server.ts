import dotenv from 'dotenv';
import { systemConfig, validateConfig } from './config/systemConfig';
import { logger } from './utils/logger';
import { webSocketClient, startWebSocket, stopWebSocket } from './data/twelvedataClient/websocketClient';
import { strategyRunner } from './engine/StrategyRunner';
import { tradeOrchestrator } from './engine/TradeOrchestrator';
import { getCacheStats } from './cache/historicalCache';
import { getOpenPositions, getTotalUnrealizedPnL } from './engine/PositionTracker';

// Import strategies to ensure auto-registration
import './strategies';

// Load environment variables
dotenv.config();

class TradingSystem {
  private isRunning = false;
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.setupGracefulShutdown();
  }

  public async start(): Promise<void> {
    try {
      logger.info('Starting Paper Trading System...');

      // Validate configuration
      validateConfig(systemConfig);
      logger.info('Configuration validated successfully');

      // Start WebSocket connection
      startWebSocket();
      logger.info('WebSocket client started');

      // Start strategy runner
      await strategyRunner.start();
      logger.info('Strategy runner started');

      // Start health monitoring
      this.startHealthMonitoring();

      this.isRunning = true;
      logger.info('Paper Trading System started successfully');

    } catch (error) {
      logger.fatal('Failed to start trading system', error as Error);
      process.exit(1);
    }
  }

  public async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    logger.info('Stopping Paper Trading System...');

    // Stop health monitoring
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    // Stop strategy runner
    await strategyRunner.stop();
    logger.info('Strategy runner stopped');

    // Stop WebSocket connection
    stopWebSocket();
    logger.info('WebSocket client stopped');

    this.isRunning = false;
    logger.info('Paper Trading System stopped successfully');
  }

  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, 30000); // Every 30 seconds
  }

  private performHealthCheck(): void {
    try {
      const health = {
        timestamp: new Date().toISOString(),
        systemRunning: this.isRunning,
        websocketConnected: webSocketClient.isConnectionActive(),
        activeStrategies: strategyRunner.getActiveStrategies(),
        openPositions: getOpenPositions(),
        totalUnrealizedPnL: getTotalUnrealizedPnL(),
        dailyPnL: tradeOrchestrator.getDailyPnL(),
        cacheStats: getCacheStats(),
        riskMetrics: tradeOrchestrator.getRiskMetrics()
      };

      logger.info('Health check completed', health);

      // Check for critical issues
      if (!webSocketClient.isConnectionActive()) {
        logger.warn('WebSocket connection is down');
      }

      if (health.dailyPnL <= -systemConfig.risk.maxDailyLoss) {
        logger.error('Daily loss limit reached', { dailyPnL: health.dailyPnL });
      }

    } catch (error) {
      logger.error('Health check failed', error as Error);
    }
  }

  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, shutting down gracefully...`);
      
      try {
        await this.stop();
        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown', error as Error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('uncaughtException', (error) => {
      logger.fatal('Uncaught exception', error);
      process.exit(1);
    });
    process.on('unhandledRejection', (reason) => {
      logger.fatal('Unhandled rejection', reason as Error);
      process.exit(1);
    });
  }
}

// Start the trading system
const tradingSystem = new TradingSystem();

// Handle command line arguments
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Paper Trading System

Usage:
  npm run dev          # Start in development mode
  npm start           # Start in production mode
  npm run build       # Build the project

Environment Variables:
  TWELVEDATA_API_KEY     # TwelveData API key (required)
  ALPACA_API_KEY         # Alpaca API key (required)
  ALPACA_API_SECRET      # Alpaca API secret (required)
  LOG_LEVEL              # Log level (DEBUG, INFO, WARN, ERROR, FATAL)
  TRADING_SYMBOLS        # Comma-separated list of symbols
  TRADING_INTERVALS      # Comma-separated list of intervals
  MAX_POSITION_SIZE      # Maximum position size in USD
  MAX_DAILY_LOSS         # Maximum daily loss in USD
  MAX_DRAWDOWN           # Maximum drawdown as decimal

Examples:
  TWELVEDATA_API_KEY=your_key ALPACA_API_KEY=your_key ALPACA_API_SECRET=your_secret npm run dev
  `);
  process.exit(0);
}

// Start the system
tradingSystem.start().catch((error) => {
  logger.fatal('Failed to start trading system', error);
  process.exit(1);
});