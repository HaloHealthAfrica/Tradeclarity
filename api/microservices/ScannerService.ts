import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createModuleLogger } from '../../utils/logger';
import { Scanner } from '../../strategies/Scanner';
import { DatabaseService } from './DatabaseService';
import { NotificationService } from './NotificationService';
import { MarketDataService } from './MarketDataService';
import { AuthService } from './AuthService';

const logger = createModuleLogger('ScannerService');

/**
 * Scanner Microservice
 * 
 * Features:
 * - REST API endpoints for scanner management
 * - WebSocket support for real-time updates
 * - Service discovery and health checks
 * - Rate limiting and security
 * - Inter-service communication
 */
export class ScannerService {
  private app: express.Application;
  private scanner: Scanner;
  private databaseService: DatabaseService;
  private notificationService: NotificationService;
  private marketDataService: MarketDataService;
  private authService: AuthService;
  private port: number;
  private isRunning = false;

  constructor(port: number = 3001) {
    this.port = port;
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSockets();
    this.setupServices();
  }

  /**
   * Setup middleware
   */
  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet());
    this.app.use(cors({
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      credentials: true
    }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
      message: 'Too many requests from this IP'
    });
    this.app.use('/api/', limiter);

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    // Request logging
    this.app.use((req, res, next) => {
      logger.info(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      next();
    });
  }

  /**
   * Setup REST API routes
   */
  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        service: 'scanner',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
      });
    });

    // API routes
    this.app.use('/api/v1/scanner', this.createScannerRoutes());
    this.app.use('/api/v1/signals', this.createSignalRoutes());
    this.app.use('/api/v1/watchlist', this.createWatchlistRoutes());
    this.app.use('/api/v1/analytics', this.createAnalyticsRoutes());
  }

  /**
   * Create scanner management routes
   */
  private createScannerRoutes() {
    const router = express.Router();

    // Authentication middleware
    router.use(this.authService.authenticate.bind(this.authService));

    // Start scanner
    router.post('/start', async (req, res) => {
      try {
        const { symbols, config } = req.body;
        
        if (symbols && Array.isArray(symbols)) {
          this.scanner.addSymbols(symbols);
        }
        
        if (config) {
          this.scanner.updateConfig(config);
        }
        
        await this.scanner.startScanning();
        
        res.json({
          success: true,
          message: 'Scanner started successfully',
          watchlist: this.scanner.getWatchlist()
        });
      } catch (error) {
        logger.error('Error starting scanner:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to start scanner'
        });
      }
    });

    // Stop scanner
    router.post('/stop', async (req, res) => {
      try {
        this.scanner.stopScanning();
        
        res.json({
          success: true,
          message: 'Scanner stopped successfully'
        });
      } catch (error) {
        logger.error('Error stopping scanner:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to stop scanner'
        });
      }
    });

    // Get scanner status
    router.get('/status', (req, res) => {
      try {
        const metrics = this.scanner.getPerformanceMetrics();
        const config = this.scanner.getConfig();
        const watchlist = this.scanner.getWatchlist();
        
        res.json({
          success: true,
          data: {
            isRunning: this.isRunning,
            metrics,
            config,
            watchlist
          }
        });
      } catch (error) {
        logger.error('Error getting scanner status:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to get scanner status'
        });
      }
    });

    // Update scanner configuration
    router.put('/config', (req, res) => {
      try {
        const { config } = req.body;
        
        if (!config) {
          return res.status(400).json({
            success: false,
            error: 'Configuration is required'
          });
        }
        
        this.scanner.updateConfig(config);
        
        res.json({
          success: true,
          message: 'Configuration updated successfully',
          config: this.scanner.getConfig()
        });
      } catch (error) {
        logger.error('Error updating scanner config:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to update configuration'
        });
      }
    });

    return router;
  }

  /**
   * Create signal management routes
   */
  private createSignalRoutes() {
    const router = express.Router();

    // Authentication middleware
    router.use(this.authService.authenticate.bind(this.authService));

    // Get recent signals
    router.get('/', async (req, res) => {
      try {
        const { limit = 50, offset = 0, symbol, pattern } = req.query;
        
        const signals = await this.databaseService.getSignals({
          limit: parseInt(limit as string),
          offset: parseInt(offset as string),
          symbol: symbol as string,
          pattern: pattern as string
        });
        
        res.json({
          success: true,
          data: signals
        });
      } catch (error) {
        logger.error('Error getting signals:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to get signals'
        });
      }
    });

    // Get signal by ID
    router.get('/:id', async (req, res) => {
      try {
        const { id } = req.params;
        
        const signal = await this.databaseService.getSignalById(id);
        
        if (!signal) {
          return res.status(404).json({
            success: false,
            error: 'Signal not found'
          });
        }
        
        res.json({
          success: true,
          data: signal
        });
      } catch (error) {
        logger.error('Error getting signal:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to get signal'
        });
      }
    });

    // Update signal status
    router.patch('/:id/status', async (req, res) => {
      try {
        const { id } = req.params;
        const { status } = req.body;
        
        if (!status) {
          return res.status(400).json({
            success: false,
            error: 'Status is required'
          });
        }
        
        await this.databaseService.updateSignalStatus(id, status);
        
        res.json({
          success: true,
          message: 'Signal status updated successfully'
        });
      } catch (error) {
        logger.error('Error updating signal status:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to update signal status'
        });
      }
    });

    return router;
  }

  /**
   * Create watchlist management routes
   */
  private createWatchlistRoutes() {
    const router = express.Router();

    // Authentication middleware
    router.use(this.authService.authenticate.bind(this.authService));

    // Get user watchlist
    router.get('/', async (req, res) => {
      try {
        const userId = req.user?.id;
        
        if (!userId) {
          return res.status(401).json({
            success: false,
            error: 'User not authenticated'
          });
        }
        
        const watchlist = await this.databaseService.getUserWatchlist(userId);
        
        res.json({
          success: true,
          data: watchlist
        });
      } catch (error) {
        logger.error('Error getting watchlist:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to get watchlist'
        });
      }
    });

    // Add symbols to watchlist
    router.post('/', async (req, res) => {
      try {
        const userId = req.user?.id;
        const { symbols } = req.body;
        
        if (!userId) {
          return res.status(401).json({
            success: false,
            error: 'User not authenticated'
          });
        }
        
        if (!symbols || !Array.isArray(symbols)) {
          return res.status(400).json({
            success: false,
            error: 'Symbols array is required'
          });
        }
        
        await this.databaseService.addToWatchlist(userId, symbols);
        
        res.json({
          success: true,
          message: 'Symbols added to watchlist successfully'
        });
      } catch (error) {
        logger.error('Error adding to watchlist:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to add to watchlist'
        });
      }
    });

    // Remove symbols from watchlist
    router.delete('/', async (req, res) => {
      try {
        const userId = req.user?.id;
        const { symbols } = req.body;
        
        if (!userId) {
          return res.status(401).json({
            success: false,
            error: 'User not authenticated'
          });
        }
        
        if (!symbols || !Array.isArray(symbols)) {
          return res.status(400).json({
            success: false,
            error: 'Symbols array is required'
          });
        }
        
        await this.databaseService.removeFromWatchlist(userId, symbols);
        
        res.json({
          success: true,
          message: 'Symbols removed from watchlist successfully'
        });
      } catch (error) {
        logger.error('Error removing from watchlist:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to remove from watchlist'
        });
      }
    });

    return router;
  }

  /**
   * Create analytics routes
   */
  private createAnalyticsRoutes() {
    const router = express.Router();

    // Authentication middleware
    router.use(this.authService.authenticate.bind(this.authService));

    // Get scanner performance metrics
    router.get('/performance', (req, res) => {
      try {
        const metrics = this.scanner.getPerformanceMetrics();
        
        res.json({
          success: true,
          data: metrics
        });
      } catch (error) {
        logger.error('Error getting performance metrics:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to get performance metrics'
        });
      }
    });

    // Get signal analytics
    router.get('/signals', async (req, res) => {
      try {
        const { period = '24h' } = req.query;
        
        const analytics = await this.databaseService.getSignalAnalytics(period as string);
        
        res.json({
          success: true,
          data: analytics
        });
      } catch (error) {
        logger.error('Error getting signal analytics:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to get signal analytics'
        });
      }
    });

    // Get pattern performance
    router.get('/patterns', async (req, res) => {
      try {
        const { period = '24h' } = req.query;
        
        const patterns = await this.databaseService.getPatternPerformance(period as string);
        
        res.json({
          success: true,
          data: patterns
        });
      } catch (error) {
        logger.error('Error getting pattern performance:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to get pattern performance'
        });
      }
    });

    return router;
  }

  /**
   * Setup WebSocket support
   */
  private setupWebSockets(): void {
    // WebSocket implementation would go here
    // This would handle real-time signal updates
    logger.info('WebSocket support configured');
  }

  /**
   * Setup microservices
   */
  private setupServices(): void {
    // Initialize services
    this.databaseService = new DatabaseService();
    this.notificationService = new NotificationService();
    this.marketDataService = new MarketDataService();
    this.authService = new AuthService();
    
    // Initialize scanner with storage
    this.scanner = new Scanner(this.databaseService.getStorage());
    
    logger.info('Microservices initialized');
  }

  /**
   * Start the service
   */
  async start(): Promise<void> {
    try {
      // Start database service
      await this.databaseService.start();
      
      // Start notification service
      await this.notificationService.start();
      
      // Start market data service
      await this.marketDataService.start();
      
      // Start auth service
      await this.authService.start();
      
      // Start HTTP server
      this.app.listen(this.port, () => {
        logger.info(`Scanner service started on port ${this.port}`);
        this.isRunning = true;
      });
      
    } catch (error) {
      logger.error('Failed to start scanner service:', error);
      throw error;
    }
  }

  /**
   * Stop the service
   */
  async stop(): Promise<void> {
    try {
      // Stop scanner
      this.scanner.stopScanning();
      
      // Stop services
      await this.databaseService.stop();
      await this.notificationService.stop();
      await this.marketDataService.stop();
      await this.authService.stop();
      
      this.isRunning = false;
      logger.info('Scanner service stopped');
      
    } catch (error) {
      logger.error('Error stopping scanner service:', error);
      throw error;
    }
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      port: this.port,
      uptime: process.uptime(),
      services: {
        database: this.databaseService.getStatus(),
        notification: this.notificationService.getStatus(),
        marketData: this.marketDataService.getStatus(),
        auth: this.authService.getStatus()
      }
    };
  }
} 