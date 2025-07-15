"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const logger_1 = require("./utils/logger");
const logger = (0, logger_1.createModuleLogger)('SimpleTradingSystem');
class SimpleTradingSystem {
    constructor() {
        this.isRunning = false;
        this.port = parseInt(process.env.PORT || '8080');
        this.app = express();
        this.setupMiddleware();
        this.setupRoutes();
        this.setupGracefulShutdown();
    }
    setupMiddleware() {
        this.app.use(cors());
        this.app.use(express.json());
        
        // Logging middleware
        this.app.use(function (req, res, next) {
            logger.info(`${req.method} ${req.path}`, {
                userAgent: req.get('User-Agent'),
                ip: req.ip
            });
            next();
        });
    }
    setupRoutes() {
        // API Routes
        this.app.get('/api/health', function (req, res) {
            res.json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                version: '1.0.0'
            });
        });
        this.app.get('/api/status', function (req, res) {
            res.json({
                system: 'Paper Trading System',
                status: 'running',
                environment: process.env.NODE_ENV || 'development',
                timestamp: new Date().toISOString()
            });
        });
        this.app.get('/api/trading/status', function (req, res) {
            res.json({
                trading: 'disabled',
                message: 'Trading is currently disabled for safety',
                timestamp: new Date().toISOString()
            });
        });
        this.app.get('/api/market/status', function (req, res) {
            res.json({
                marketData: 'available',
                symbols: ['AAPL', 'MSFT', 'GOOGL', 'TSLA'],
                timestamp: new Date().toISOString()
            });
        });

        // Strategy Management Endpoints
        this.app.get('/api/trading/strategies', function (req, res) {
            res.json({
                strategies: [
                    {
                        id: '1',
                        name: 'EMA Confluence',
                        status: 'active',
                        performance: {
                            totalPnL: 1250.50,
                            winRate: 68.5,
                            totalTrades: 45
                        },
                        lastSignal: {
                            id: 'sig_001',
                            symbol: 'AAPL',
                            type: 'BUY',
                            strategy: 'EMA Confluence',
                            price: 150.25,
                            timestamp: new Date().toISOString(),
                            confidence: 0.85,
                            status: 'executed'
                        }
                    },
                    {
                        id: '2',
                        name: 'Squeeze Strategy',
                        status: 'active',
                        performance: {
                            totalPnL: 890.75,
                            winRate: 72.3,
                            totalTrades: 32
                        },
                        lastSignal: {
                            id: 'sig_002',
                            symbol: 'TSLA',
                            type: 'SELL',
                            strategy: 'Squeeze Strategy',
                            price: 245.80,
                            timestamp: new Date().toISOString(),
                            confidence: 0.78,
                            status: 'pending'
                        }
                    },
                    {
                        id: '3',
                        name: 'ICT Strategy',
                        status: 'inactive',
                        performance: {
                            totalPnL: -120.30,
                            winRate: 45.2,
                            totalTrades: 18
                        }
                    }
                ]
            });
        });

        this.app.get('/api/trading/signals', function (req, res) {
            const limit = parseInt(req.query.limit) || 10;
            res.json({
                signals: [
                    {
                        id: 'sig_001',
                        symbol: 'AAPL',
                        type: 'BUY',
                        strategy: 'EMA Confluence',
                        price: 150.25,
                        timestamp: new Date().toISOString(),
                        confidence: 0.85,
                        status: 'executed'
                    },
                    {
                        id: 'sig_002',
                        symbol: 'TSLA',
                        type: 'SELL',
                        strategy: 'Squeeze Strategy',
                        price: 245.80,
                        timestamp: new Date().toISOString(),
                        confidence: 0.78,
                        status: 'pending'
                    },
                    {
                        id: 'sig_003',
                        symbol: 'MSFT',
                        type: 'BUY',
                        strategy: 'ICT Strategy',
                        price: 320.45,
                        timestamp: new Date().toISOString(),
                        confidence: 0.92,
                        status: 'executed'
                    }
                ].slice(0, limit)
            });
        });

        // Scanner Endpoints
        this.app.get('/api/scanner/results', function (req, res) {
            res.json({
                results: [
                    {
                        symbol: 'AAPL',
                        pattern: 'Bullish Breakout',
                        confidence: 0.85,
                        price: 150.25,
                        volume: 45000000,
                        timestamp: new Date().toISOString(),
                        indicators: {
                            rsi: 65.2,
                            macd: 0.45,
                            ema: 148.90
                        }
                    },
                    {
                        symbol: 'TSLA',
                        pattern: 'Squeeze Release',
                        confidence: 0.78,
                        price: 245.80,
                        volume: 32000000,
                        timestamp: new Date().toISOString(),
                        indicators: {
                            rsi: 72.1,
                            macd: -0.12,
                            ema: 242.30
                        }
                    },
                    {
                        symbol: 'MSFT',
                        pattern: 'Support Bounce',
                        confidence: 0.92,
                        price: 320.45,
                        volume: 28000000,
                        timestamp: new Date().toISOString(),
                        indicators: {
                            rsi: 58.7,
                            macd: 0.23,
                            ema: 318.90
                        }
                    }
                ]
            });
        });

        this.app.get('/api/scanner/status', function (req, res) {
            res.json({
                status: 'running',
                lastScan: new Date().toISOString(),
                symbolsScanned: 150,
                patternsFound: 12,
                nextScan: new Date(Date.now() + 5 * 60 * 1000).toISOString()
            });
        });

        // Dashboard Endpoint
        this.app.get('/api/dashboard', function (req, res) {
            res.json({
                summary: {
                    totalPnL: 2020.95,
                    winRate: 68.5,
                    totalTrades: 95,
                    activeStrategies: 3,
                    portfolioValue: 125000.00
                },
                recentSignals: [
                    {
                        id: 'sig_001',
                        symbol: 'AAPL',
                        type: 'BUY',
                        price: 150.25,
                        timestamp: new Date().toISOString(),
                        confidence: 0.85
                    },
                    {
                        id: 'sig_002',
                        symbol: 'TSLA',
                        type: 'SELL',
                        price: 245.80,
                        timestamp: new Date().toISOString(),
                        confidence: 0.78
                    }
                ],
                topPerformers: [
                    { symbol: 'AAPL', pnl: 1250.50, change: 8.3 },
                    { symbol: 'MSFT', pnl: 890.75, change: 5.2 },
                    { symbol: 'GOOGL', pnl: 650.20, change: 3.8 }
                ]
            });
        });

        // Portfolio Endpoint
        this.app.get('/api/portfolio', function (req, res) {
            res.json({
                totalValue: 125000.00,
                cash: 25000.00,
                positions: [
                    {
                        symbol: 'AAPL',
                        quantity: 100,
                        avgPrice: 145.25,
                        currentPrice: 150.25,
                        marketValue: 15025.00,
                        pnl: 500.00,
                        pnlPercent: 3.4
                    },
                    {
                        symbol: 'MSFT',
                        quantity: 50,
                        avgPrice: 315.80,
                        currentPrice: 320.45,
                        marketValue: 16022.50,
                        pnl: 232.50,
                        pnlPercent: 1.5
                    },
                    {
                        symbol: 'TSLA',
                        quantity: 75,
                        avgPrice: 240.00,
                        currentPrice: 245.80,
                        marketValue: 18435.00,
                        pnl: 435.00,
                        pnlPercent: 2.4
                    }
                ],
                performance: {
                    dailyPnL: 125.50,
                    weeklyPnL: 890.75,
                    monthlyPnL: 2020.95,
                    totalReturn: 16.2
                }
            });
        });

        // Trading Metrics Endpoint
        this.app.get('/api/trading/metrics', function (req, res) {
            res.json({
                metrics: {
                    totalTrades: 95,
                    winningTrades: 65,
                    losingTrades: 30,
                    winRate: 68.5,
                    averageWin: 125.50,
                    averageLoss: -85.30,
                    profitFactor: 1.47,
                    maxDrawdown: -8.5,
                    sharpeRatio: 1.2
                },
                recentActivity: [
                    {
                        timestamp: new Date().toISOString(),
                        action: 'BUY',
                        symbol: 'AAPL',
                        quantity: 100,
                        price: 150.25,
                        status: 'executed'
                    },
                    {
                        timestamp: new Date(Date.now() - 3600000).toISOString(),
                        action: 'SELL',
                        symbol: 'TSLA',
                        quantity: 50,
                        price: 245.80,
                        status: 'executed'
                    }
                ]
            });
        });

        // Analysis Endpoints
        this.app.get('/api/analysis/metrics', function (req, res) {
            res.json({
                performance: {
                    totalReturn: 16.2,
                    annualizedReturn: 18.5,
                    volatility: 12.3,
                    sharpeRatio: 1.2,
                    maxDrawdown: -8.5
                },
                riskMetrics: {
                    beta: 0.95,
                    alpha: 2.1,
                    sortinoRatio: 1.4,
                    calmarRatio: 1.8
                }
            });
        });

        this.app.get('/api/analysis/trades', function (req, res) {
            res.json({
                trades: [
                    {
                        id: 'trade_001',
                        symbol: 'AAPL',
                        entryDate: '2024-01-15T10:30:00Z',
                        exitDate: '2024-01-16T14:45:00Z',
                        entryPrice: 145.25,
                        exitPrice: 150.25,
                        quantity: 100,
                        side: 'LONG',
                        pnl: 500.00,
                        pnlPercent: 3.4,
                        duration: 1.2,
                        strategy: 'EMA Confluence'
                    },
                    {
                        id: 'trade_002',
                        symbol: 'TSLA',
                        entryDate: '2024-01-14T09:15:00Z',
                        exitDate: '2024-01-15T11:20:00Z',
                        entryPrice: 240.00,
                        exitPrice: 245.80,
                        quantity: 50,
                        side: 'LONG',
                        pnl: 290.00,
                        pnlPercent: 2.4,
                        duration: 1.1,
                        strategy: 'Squeeze Strategy'
                    }
                ]
            });
        });

        this.app.get('/api/analysis/performance', function (req, res) {
            res.json({
                monthlyReturns: [
                    { month: '2024-01', return: 5.2, trades: 12, winRate: 65 },
                    { month: '2023-12', return: 3.8, trades: 8, winRate: 62 },
                    { month: '2023-11', return: 6.1, trades: 15, winRate: 68 }
                ],
                strategyPerformance: [
                    {
                        strategy: 'EMA Confluence',
                        totalPnL: 1250.50,
                        winRate: 68.5,
                        totalTrades: 45,
                        avgTrade: 27.8
                    },
                    {
                        strategy: 'Squeeze Strategy',
                        totalPnL: 890.75,
                        winRate: 72.3,
                        totalTrades: 32,
                        avgTrade: 27.8
                    }
                ]
            });
        });

        // Market Data Endpoints
        this.app.get('/api/market-data/quote/:symbol', function (req, res) {
            const symbol = req.params.symbol;
            res.json({
                symbol: symbol,
                price: 150.25 + Math.random() * 10,
                volume: 45000000,
                change: 2.5,
                changePercent: 1.7,
                timestamp: new Date().toISOString()
            });
        });

        this.app.get('/api/market-data/quotes', function (req, res) {
            const symbols = ['AAPL', 'MSFT', 'GOOGL', 'TSLA', 'AMZN', 'META'];
            res.json({
                quotes: symbols.map(symbol => ({
                    symbol: symbol,
                    price: 100 + Math.random() * 200,
                    volume: 20000000 + Math.random() * 50000000,
                    change: (Math.random() - 0.5) * 10,
                    changePercent: (Math.random() - 0.5) * 5,
                    timestamp: new Date().toISOString()
                }))
            });
        });

        // Serve static files (frontend) after all API routes
        const possiblePaths = [
            path.join(__dirname, 'frontend/build'),
            path.join(process.cwd(), 'frontend/build'),
            path.join(__dirname, '../frontend/build'),
            path.join(__dirname, '../../frontend/build'),
            '/app/frontend/build'
        ];
        
        let staticPath = null;
        for (const p of possiblePaths) {
            if (fs.existsSync(p)) {
                staticPath = p;
                break;
            }
        }
        
        if (!staticPath) {
            logger.error('Could not find frontend build directory. Tried paths:', possiblePaths);
            // Don't throw error, just log and continue without frontend
            logger.warn('Frontend build directory not found, serving API only');
            return;
        }
        
        logger.info('Serving static files from:', staticPath);
        this.app.use(express.static(staticPath));
        
        // Serve React app for all other routes
        this.app.get('*', (req, res) => {
            if (!staticPath) {
                return res.status(404).json({ 
                    error: 'Frontend not available',
                    message: 'API endpoints are available at /api/*',
                    availableEndpoints: [
                        '/api/health',
                        '/api/dashboard',
                        '/api/scanner/*',
                        '/api/market-data/*',
                        '/api/historical/*',
                        '/api/backtest/*'
                    ]
                });
            }
            
            const indexPath = path.join(staticPath, 'index.html');
            logger.info('Serving index.html from:', indexPath);
            
            if (!fs.existsSync(indexPath)) {
                logger.error('index.html not found at:', indexPath);
                return res.status(500).json({ error: 'Frontend index.html not found' });
            }
            
            res.sendFile(indexPath, (err) => {
                if (err) {
                    logger.error('Error serving index.html:', err);
                    res.status(500).json({ error: 'Failed to serve frontend' });
                }
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
                logger.info(`Health check available at http://localhost:${this.port}/api/health`);
                logger.info(`Frontend available at http://localhost:${this.port}`);
                logger.info(`Admin panel available at http://localhost:${this.port}/admin`);
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
        // Check if we have the hardcoded API key or environment variable
        const hasTwelveDataKey = process.env.TWELVEDATA_API_KEY || '6ff49cbdd0b34f58a11e6b16ce18a095';
        const hasAlpacaKey = process.env.ALPACA_API_KEY;
        const hasAlpacaSecret = process.env.ALPACA_API_SECRET;

        const missing = [];
        if (!hasTwelveDataKey) missing.push('TWELVEDATA_API_KEY');
        if (!hasAlpacaKey) missing.push('ALPACA_API_KEY');
        if (!hasAlpacaSecret) missing.push('ALPACA_API_SECRET');
        
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

Endpoints:
  GET  /api/health       # Health check
  GET  /api/status       # System status
  GET  /api/trading/status # Trading status
  GET  /api/market/status  # Market data status
  GET  /api/admin/keys   # Get API key status
  POST /api/admin/keys   # Update API keys
  GET  /api/admin/system # System information
  GET  /                 # Frontend application
  GET  /admin            # Admin panel
`);
    process.exit(0);
}

tradingSystem.start().catch((error) => {
    logger.fatal('Failed to start trading system', error);
    process.exit(1);
});
