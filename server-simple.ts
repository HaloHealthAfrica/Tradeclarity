import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import { logger } from './utils/logger';

// Load environment variables
dotenv.config();

class SimpleTradingSystem {
  private app: express.Application;
  private port: number;
  private isRunning = false;

  constructor() {
    this.port = parseInt(process.env.PORT || '3000');
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupGracefulShutdown();
  }

  private setupMiddleware(): void {
    this.app.use(cors());
    this.app.use(express.json());
    this.app.use((req, res, next) => {
      logger.info(`${req.method} ${req.path}`, { 
        userAgent: req.get('User-Agent'),
        ip: req.ip 
      });
      next();
    });
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: '1.0.0'
      });
    });

    // API status
    this.app.get('/api/status', (req, res) => {
      res.json({
        system: 'Paper Trading System',
        status: 'running',
        environment: process.env.NODE_ENV || 'development',
        timestamp: new Date().toISOString()
      });
    });

    // Trading status
    this.app.get('/api/trading/status', (req, res) => {
      res.json({
        trading: 'disabled',
        message: 'Trading is currently disabled for safety',
        timestamp: new Date().toISOString()
      });
    });

    // Market data status
    this.app.get('/api/market/status', (req, res) => {
      res.json({
        marketData: 'available',
        symbols: ['AAPL', 'MSFT', 'GOOGL', 'TSLA'],
        timestamp: new Date().toISOString()
      });
    });

    // Error handling
    this.app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      logger.error('Express error:', err);
      res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
      });
    });

    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        error: 'Not found',
        message: `Route ${req.originalUrl} not found`
      });
    });
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

  public async start(): Promise<void> {
    try {
      logger.info('Starting Simple Paper Trading System...');

      // Validate environment
      this.validateEnvironment();

      // Start server
      this.app.listen(this.port, () => {
        logger.info(`Server running on port ${this.port}`);
        logger.info(`Health check available at http://localhost:${this.port}/health`);
        logger.info(`API status at http://localhost:${this.port}/api/status`);
      });

      this.isRunning = true;
      logger.info('Simple Paper Trading System started successfully');

    } catch (error) {
      logger.fatal('Failed to start trading system', error as Error);
      process.exit(1);
    }
  }

  public async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    logger.info('Stopping Simple Paper Trading System...');
    this.isRunning = false;
    logger.info('Simple Paper Trading System stopped successfully');
  }

  private validateEnvironment(): void {
    const requiredVars = [
      'TWELVEDATA_API_KEY',
      'ALPACA_API_KEY',
      'ALPACA_API_SECRET'
    ];

    const missing = requiredVars.filter(varName => !process.env[varName]);
    
    if (missing.length > 0) {
      logger.warn('Missing environment variables:', missing);
      logger.info('System will run in demo mode');
    } else {
      logger.info('All required environment variables are set');
    }
  }
}

// Start the system
const tradingSystem = new SimpleTradingSystem();

// Handle command line arguments
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Simple Paper Trading System

Usage:
  npm run start:simple    # Start simplified version
  npm start              # Start full version

Environment Variables:
  TWELVEDATA_API_KEY     # TwelveData API key (optional for demo)
  ALPACA_API_KEY         # Alpaca API key (optional for demo)
  ALPACA_API_SECRET      # Alpaca API secret (optional for demo)
  PORT                   # Server port (default: 3000)
  NODE_ENV               # Environment (development/production)

Examples:
  PORT=3000 npm run start:simple
  `);
  process.exit(0);
}

// Start the system
tradingSystem.start().catch((error) => {
  logger.fatal('Failed to start trading system', error);
  process.exit(1);
}); 