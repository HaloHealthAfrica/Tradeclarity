import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createModuleLogger } from '../../utils/logger';
import { EndOfDayAnalyzer } from '../../analytics/EndOfDayAnalyzer';
import { backtester, BacktestConfig, BacktestResult } from '../../analytics/Backtester';
import { marketDataStorage, MarketDataQuery, MarketDataStats } from '../../analytics/MarketDataStorage';
import { algorithmOptimizer, OptimizationConfig, OptimizationResult } from '../../analytics/AlgorithmOptimizer';

const logger = createModuleLogger('EndOfDayService');
const router = express.Router();

// Initialize services
const eodAnalyzer = new EndOfDayAnalyzer();

/**
 * End-of-Day Analysis Microservice
 * 
 * Features:
 * - Daily performance reports
 * - Market analysis
 * - Strategy performance tracking
 * - Risk assessment
 * - Next day outlook
 * - Automated daily analysis
 */
export class EndOfDayService {
  private app: express.Application;
  private port: number;
  private isRunning = false;

  constructor(port: number = 3006) {
    this.port = port;
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
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
        service: 'end-of-day',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
      });
    });

    // API routes
    this.app.use('/api/v1/analysis', this.createAnalysisRoutes());
  }

  /**
   * Create analysis management routes
   */
  private createAnalysisRoutes() {
    const router = express.Router();

    // Generate end-of-day report
    router.post('/generate', async (req, res) => {
      try {
        const report = await eodAnalyzer.generateDailyReport(req.body.date, req.body.symbols);
        
        res.json({
          success: true,
          message: 'End-of-day report generated successfully',
          data: report
        });
      } catch (error) {
        logger.error('Error generating end-of-day report:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to generate end-of-day report'
        });
      }
    });

    // Get latest end-of-day report
    router.get('/latest', (req, res) => {
      try {
        const reports = eodAnalyzer.getHistoricalReports(1);
        const latestReport = reports[reports.length - 1];
        
        if (!latestReport) {
          return res.status(404).json({
            success: false,
            error: 'No end-of-day reports found'
          });
        }
        
        res.json({
          success: true,
          data: latestReport
        });
      } catch (error) {
        logger.error('Error getting latest report:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to get latest report'
        });
      }
    });

    // Get historical reports
    router.get('/historical', (req, res) => {
      try {
        const { days = 30 } = req.query;
        const reports = eodAnalyzer.getHistoricalReports(parseInt(days as string));
        
        res.json({
          success: true,
          data: {
            reports,
            count: reports.length,
            dateRange: {
              from: reports[0]?.date,
              to: reports[reports.length - 1]?.date
            }
          }
        });
      } catch (error) {
        logger.error('Error getting historical reports:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to get historical reports'
        });
      }
    });

    // Get performance summary
    router.get('/performance', (req, res) => {
      try {
        const { days = 30 } = req.query;
        const reports = eodAnalyzer.getHistoricalReports(parseInt(days as string));
        
        if (reports.length === 0) {
          return res.status(404).json({
            success: false,
            error: 'No performance data available'
          });
        }

        // Calculate performance summary
        const totalPnL = reports.reduce((sum, report) => sum + report.performance.totalPnL, 0);
        const totalTrades = reports.reduce((sum, report) => sum + report.performance.totalTrades, 0);
        const avgWinRate = reports.reduce((sum, report) => sum + report.performance.winRate, 0) / reports.length;
        const avgDailyPnL = totalPnL / reports.length;

        const performanceSummary = {
          period: `${days} days`,
          totalPnL,
          avgDailyPnL,
          totalTrades,
          avgWinRate,
          bestDay: reports.reduce((best, report) => 
            report.performance.totalPnL > best.performance.totalPnL ? report : best
          ),
          worstDay: reports.reduce((worst, report) => 
            report.performance.totalPnL < worst.performance.totalPnL ? report : worst
          ),
          profitableDays: reports.filter(r => r.performance.totalPnL > 0).length,
          losingDays: reports.filter(r => r.performance.totalPnL < 0).length
        };
        
        res.json({
          success: true,
          data: performanceSummary
        });
      } catch (error) {
        logger.error('Error getting performance summary:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to get performance summary'
        });
      }
    });

    // Get strategy performance
    router.get('/strategies', (req, res) => {
      try {
        const { days = 30 } = req.query;
        const reports = eodAnalyzer.getHistoricalReports(parseInt(days as string));
        
        if (reports.length === 0) {
          return res.status(404).json({
            success: false,
            error: 'No strategy data available'
          });
        }

        // Aggregate strategy performance
        const strategyMap = new Map<string, any>();
        
        reports.forEach(report => {
          report.strategyPerformance.forEach(strategy => {
            if (!strategyMap.has(strategy.strategyName)) {
              strategyMap.set(strategy.strategyName, {
                strategyName: strategy.strategyName,
                totalSignals: 0,
                executedTrades: 0,
                totalPnL: 0,
                winRates: [],
                maxDrawdowns: [],
                sharpeRatios: []
              });
            }
            
            const aggregated = strategyMap.get(strategy.strategyName);
            aggregated.totalSignals += strategy.totalSignals;
            aggregated.executedTrades += strategy.executedTrades;
            aggregated.totalPnL += strategy.totalPnL;
            aggregated.winRates.push(strategy.winRate);
            aggregated.maxDrawdowns.push(strategy.maxDrawdown);
            aggregated.sharpeRatios.push(strategy.sharpeRatio);
          });
        });

        // Calculate averages
        const strategyPerformance = Array.from(strategyMap.values()).map(strategy => ({
          ...strategy,
          avgWinRate: strategy.winRates.reduce((sum: number, rate: number) => sum + rate, 0) / strategy.winRates.length,
          avgMaxDrawdown: strategy.maxDrawdowns.reduce((sum: number, dd: number) => sum + dd, 0) / strategy.maxDrawdowns.length,
          avgSharpeRatio: strategy.sharpeRatios.reduce((sum: number, sr: number) => sum + sr, 0) / strategy.sharpeRatios.length
        }));
        
        res.json({
          success: true,
          data: strategyPerformance
        });
      } catch (error) {
        logger.error('Error getting strategy performance:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to get strategy performance'
        });
      }
    });

    // Export report to JSON
    router.get('/export/:date', (req, res) => {
      try {
        const { date } = req.params;
        const reports = eodAnalyzer.getHistoricalReports(365); // Get full year
        const report = reports.find(r => r.date === date);
        
        if (!report) {
          return res.status(404).json({
            success: false,
            error: 'Report not found for specified date'
          });
        }
        
        const jsonReport = eodAnalyzer.exportReport(report);
        
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="eod-report-${date}.json"`);
        res.send(jsonReport);
      } catch (error) {
        logger.error('Error exporting report:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to export report'
        });
      }
    });

    // Start automated analysis
    router.post('/automate/start', async (req, res) => {
      try {
        await eodAnalyzer.startAutomatedAnalysis();
        
        res.json({
          success: true,
          message: 'Automated end-of-day analysis started'
        });
      } catch (error) {
        logger.error('Error starting automated analysis:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to start automated analysis'
        });
      }
    });

    // Stop automated analysis
    router.post('/automate/stop', (req, res) => {
      try {
        eodAnalyzer.stopAutomatedAnalysis();
        
        res.json({
          success: true,
          message: 'Automated end-of-day analysis stopped'
        });
      } catch (error) {
        logger.error('Error stopping automated analysis:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to stop automated analysis'
        });
      }
    });

    return router;
  }

  /**
   * Start the end-of-day service
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('EndOfDayService is already running');
      return;
    }

    try {
      this.app.listen(this.port, () => {
        logger.info(`EndOfDayService started on port ${this.port}`);
      });

      this.isRunning = true;
    } catch (error) {
      logger.error('Failed to start EndOfDayService', error as Error);
      throw error;
    }
  }

  /**
   * Stop the end-of-day service
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('EndOfDayService is not running');
      return;
    }

    this.isRunning = false;
    logger.info('EndOfDayService stopped');
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      port: this.port,
      uptime: process.uptime()
    };
  }
} 