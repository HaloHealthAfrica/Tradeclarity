const dotenv = require('dotenv');
const express = require('express');
const cors = require('cors');

// Load environment variables
dotenv.config();

// Simple logger
const logger = {
  info: (message, context) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] INFO [SYSTEM] ${message}`, context || '');
  },
  warn: (message, context) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] WARN [SYSTEM] ${message}`, context || '');
  },
  error: (message, error, context) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ERROR [SYSTEM] ${message}`, error || '', context || '');
  },
  fatal: (message, error) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] FATAL [SYSTEM] ${message}`, error || '');
  }
};

class SimpleTradingSystem {
  constructor() {
    this.port = parseInt(process.env.PORT || '8080');
    this.app = express();
    this.isRunning = false;
    this.setupMiddleware();
    this.setupRoutes();
    this.setupGracefulShutdown();
  }

  setupMiddleware() {
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

  setupRoutes() {
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
    this.app.use((err, req, res, next) => {
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

  setupGracefulShutdown() {
    const shutdown = async (signal) => {
      logger.info(`Received ${signal}, shutting down gracefully...`);
      
      try {
        await this.stop();
        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown', error);
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
      logger.fatal('Unhandled rejection', reason);
      process.exit(1);
    });
  }

  async start() {
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
      logger.fatal('Failed to start trading system', error);
      process.exit(1);
    }
  }

  async stop() {
    if (!this.isRunning) {
      return;
    }

    logger.info('Stopping Simple Paper Trading System...');
    this.isRunning = false;
    logger.info('Simple Paper Trading System stopped successfully');
  }

  validateEnvironment() {
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
  npm run start:prod    # Start production version
  npm start            # Start full version

Environment Variables:
  TWELVEDATA_API_KEY     # TwelveData API key (optional for demo)
  ALPACA_API_KEY         # Alpaca API key (optional for demo)
  ALPACA_API_SECRET      # Alpaca API secret (optional for demo)
  PORT                   # Server port (default: 8080)
  NODE_ENV               # Environment (development/production)

Examples:
  PORT=8080 npm run start:prod
  `);
  process.exit(0);
}

// Start the system
tradingSystem.start().catch((error) => {
  logger.fatal('Failed to start trading system', error);
  process.exit(1);
}); 