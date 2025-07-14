import { createModuleLogger } from '../utils/logger';
import { Pool } from 'pg';

const logger = createModuleLogger('EndOfDayAnalyzer');

export interface DailyPerformance {
  date: string;
  totalPnL: number;
  realizedPnL: number;
  unrealizedPnL: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  averageWin: number;
  averageLoss: number;
  maxDrawdown: number;
  sharpeRatio: number;
  totalVolume: number;
  activePositions: number;
  riskMetrics: {
    dailyLoss: number;
    maxDailyLoss: number;
    positionExposure: number;
    maxPositionSize: number;
  };
}

export interface MarketAnalysis {
  date: string;
  session: 'premarket' | 'intraday' | 'afterhours';
  marketConditions: {
    volatility: 'low' | 'medium' | 'high';
    trend: 'bullish' | 'bearish' | 'sideways';
    volume: 'low' | 'medium' | 'high';
  };
  topPerformers: Array<{
    symbol: string;
    change: number;
    volume: number;
  }>;
  worstPerformers: Array<{
    symbol: string;
    change: number;
    volume: number;
  }>;
  sectorPerformance: Record<string, number>;
}

export interface StrategyPerformance {
  strategyName: string;
  totalSignals: number;
  executedTrades: number;
  winRate: number;
  totalPnL: number;
  averageReturn: number;
  maxDrawdown: number;
  sharpeRatio: number;
}

export interface EndOfDayReport {
  date: string;
  timestamp: string;
  performance: DailyPerformance;
  marketAnalysis: MarketAnalysis;
  strategyPerformance: StrategyPerformance[];
  riskAssessment: {
    riskLevel: 'low' | 'medium' | 'high';
    riskFactors: string[];
    recommendations: string[];
  };
  nextDayOutlook: {
    marketBias: 'bullish' | 'bearish' | 'neutral';
    keyLevels: Record<string, { support: number; resistance: number }>;
    watchlist: string[];
  };
}

export class EndOfDayAnalyzer {
  private dailyReports: EndOfDayReport[] = [];
  private isRunning = false;
  private pool: Pool;
  private analysisInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Initialize PostgreSQL connection
    this.pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'scanner_db',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'password',
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    logger.info('EndOfDayAnalyzer initialized with database connection');
  }

  /**
   * Generate comprehensive end-of-day report
   */
  async generateEndOfDayReport(): Promise<EndOfDayReport> {
    try {
      logger.info('Generating end-of-day report');

      const date = new Date().toISOString().split('T')[0];
      const timestamp = new Date().toISOString();

      // Calculate daily performance from database
      const performance = await this.calculateDailyPerformance(date);

      // Analyze market conditions from real data
      const marketAnalysis = await this.analyzeMarketConditions(date);

      // Get strategy performance from database
      const strategyPerformance = await this.analyzeStrategyPerformance(date);

      // Assess risk level
      const riskAssessment = await this.assessRiskLevel(performance, marketAnalysis);

      // Generate next day outlook
      const nextDayOutlook = await this.generateNextDayOutlook(marketAnalysis);

      const report: EndOfDayReport = {
        date,
        timestamp,
        performance,
        marketAnalysis,
        strategyPerformance,
        riskAssessment,
        nextDayOutlook
      };

      // Store report in database
      await this.storeReport(report);

      this.dailyReports.push(report);
      logger.info('End-of-day report generated successfully');

      return report;
    } catch (error) {
      logger.error('Error generating end-of-day report:', error as Error);
      throw error;
    }
  }

  /**
   * Calculate daily performance from database
   */
  private async calculateDailyPerformance(date: string): Promise<DailyPerformance> {
    try {
      // Get all signals for the date
      const signalsQuery = `
        SELECT 
          COUNT(*) as total_signals,
          COUNT(CASE WHEN status = 'executed' THEN 1 END) as executed_trades,
          COUNT(CASE WHEN status = 'executed' AND pnl > 0 THEN 1 END) as winning_trades,
          COUNT(CASE WHEN status = 'executed' AND pnl < 0 THEN 1 END) as losing_trades,
          COALESCE(SUM(CASE WHEN status = 'executed' THEN pnl ELSE 0 END), 0) as total_pnl,
          COALESCE(SUM(CASE WHEN status = 'executed' AND pnl > 0 THEN pnl ELSE 0 END), 0) as realized_pnl,
          COALESCE(SUM(CASE WHEN status = 'open' THEN unrealized_pnl ELSE 0 END), 0) as unrealized_pnl,
          COALESCE(SUM(volume), 0) as total_volume,
          COUNT(CASE WHEN status = 'open' THEN 1 END) as active_positions
        FROM signals 
        WHERE DATE(created_at) = $1
      `;

      const signalsResult = await this.pool.query(signalsQuery, [date]);
      const signalsData = signalsResult.rows[0];

      // Calculate metrics
      const totalTrades = parseInt(signalsData.executed_trades) || 0;
      const winningTrades = parseInt(signalsData.winning_trades) || 0;
      const losingTrades = parseInt(signalsData.losing_trades) || 0;
      const totalPnL = parseFloat(signalsData.total_pnl) || 0;
      const realizedPnL = parseFloat(signalsData.realized_pnl) || 0;
      const unrealizedPnL = parseFloat(signalsData.unrealized_pnl) || 0;
      const totalVolume = parseFloat(signalsData.total_volume) || 0;
      const activePositions = parseInt(signalsData.active_positions) || 0;

      const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
      const averageWin = winningTrades > 0 ? realizedPnL / winningTrades : 0;
      const averageLoss = losingTrades > 0 ? (realizedPnL - totalPnL) / losingTrades : 0;

      // Calculate max drawdown from daily performance
      const drawdownQuery = `
        SELECT 
          COALESCE(MIN(daily_pnl), 0) as max_drawdown
        FROM (
          SELECT 
            DATE(created_at) as trade_date,
            SUM(CASE WHEN status = 'executed' THEN pnl ELSE 0 END) as daily_pnl
          FROM signals 
          WHERE created_at >= $1::date - INTERVAL '30 days'
          GROUP BY DATE(created_at)
          ORDER BY trade_date
        ) daily_performance
      `;

      const drawdownResult = await this.pool.query(drawdownQuery, [date]);
      const maxDrawdown = Math.abs(parseFloat(drawdownResult.rows[0]?.max_drawdown || '0'));

      // Calculate Sharpe ratio (simplified)
      const sharpeRatio = this.calculateSharpeRatio(totalPnL, maxDrawdown);

      // Get risk metrics from user preferences or defaults
      const riskMetrics = {
        dailyLoss: Math.abs(totalPnL < 0 ? totalPnL : 0),
        maxDailyLoss: 1000, // Default, should come from user settings
        positionExposure: activePositions * 1000, // Estimate
        maxPositionSize: 5000 // Default, should come from user settings
      };

      return {
        date,
        totalPnL,
        realizedPnL,
        unrealizedPnL,
        totalTrades,
        winningTrades,
        losingTrades,
        winRate,
        averageWin,
        averageLoss,
        maxDrawdown,
        sharpeRatio,
        totalVolume,
        activePositions,
        riskMetrics
      };
    } catch (error) {
      logger.error('Error calculating daily performance:', error as Error);
      throw error;
    }
  }

  /**
   * Analyze market conditions from real data
   */
  private async analyzeMarketConditions(date: string): Promise<MarketAnalysis> {
    try {
      // Get market session based on current time
      const now = new Date();
      const hour = now.getHours();
      let session: 'premarket' | 'intraday' | 'afterhours' = 'intraday';
      
      if (hour < 9 || (hour === 9 && now.getMinutes() < 30)) {
        session = 'premarket';
      } else if (hour >= 16) {
        session = 'afterhours';
      }

      // Get top and worst performers from signals
      const performersQuery = `
        SELECT 
          symbol,
          COUNT(*) as signal_count,
          AVG(confidence) as avg_confidence,
          SUM(CASE WHEN status = 'executed' THEN pnl ELSE 0 END) as total_pnl,
          SUM(volume) as total_volume
        FROM signals 
        WHERE DATE(created_at) = $1
        GROUP BY symbol
        ORDER BY total_pnl DESC
        LIMIT 10
      `;

      const performersResult = await this.pool.query(performersQuery, [date]);
      
      const topPerformers = performersResult.rows
        .filter(row => parseFloat(row.total_pnl) > 0)
        .slice(0, 5)
        .map(row => ({
          symbol: row.symbol,
          change: parseFloat(row.total_pnl) / 100, // Convert to percentage
          volume: parseFloat(row.total_volume) || 0
        }));

      const worstPerformers = performersResult.rows
        .filter(row => parseFloat(row.total_pnl) < 0)
        .slice(0, 5)
        .map(row => ({
          symbol: row.symbol,
          change: parseFloat(row.total_pnl) / 100, // Convert to percentage
          volume: parseFloat(row.total_volume) || 0
        }));

      // Calculate sector performance (simplified - would need sector mapping)
      const sectorPerformance = {
        'Technology': 1.2, // Mock for now, would need sector data
        'Healthcare': -0.5,
        'Financial': 0.8,
        'Consumer': 0.3
      };

      // Assess market conditions based on signal patterns
      const volatility = this.assessVolatility(performersResult.rows);
      const trend = this.assessTrend(performersResult.rows);
      const volume = this.assessVolume(performersResult.rows);

      return {
        date,
        session,
        marketConditions: {
          volatility,
          trend,
          volume
        },
        topPerformers,
        worstPerformers,
        sectorPerformance
      };
    } catch (error) {
      logger.error('Error analyzing market conditions:', error as Error);
      throw error;
    }
  }

  /**
   * Analyze strategy performance from database
   */
  private async analyzeStrategyPerformance(date: string): Promise<StrategyPerformance[]> {
    try {
      // Get strategy performance from signals
      const strategyQuery = `
        SELECT 
          pattern as strategy_name,
          COUNT(*) as total_signals,
          COUNT(CASE WHEN status = 'executed' THEN 1 END) as executed_trades,
          COUNT(CASE WHEN status = 'executed' AND pnl > 0 THEN 1 END) as winning_trades,
          COALESCE(SUM(CASE WHEN status = 'executed' THEN pnl ELSE 0 END), 0) as total_pnl,
          AVG(confidence) as avg_confidence
        FROM signals 
        WHERE DATE(created_at) = $1
        GROUP BY pattern
        ORDER BY total_pnl DESC
      `;

      const strategyResult = await this.pool.query(strategyQuery, [date]);
      
      const strategies: StrategyPerformance[] = strategyResult.rows.map(row => {
        const totalSignals = parseInt(row.total_signals) || 0;
        const executedTrades = parseInt(row.executed_trades) || 0;
        const winningTrades = parseInt(row.winning_trades) || 0;
        const totalPnL = parseFloat(row.total_pnl) || 0;
        const avgConfidence = parseFloat(row.avg_confidence) || 0;

        const winRate = executedTrades > 0 ? (winningTrades / executedTrades) * 100 : 0;
        const averageReturn = executedTrades > 0 ? totalPnL / executedTrades : 0;

        // Calculate max drawdown for this strategy
        const maxDrawdown = Math.abs(totalPnL < 0 ? totalPnL : 0) / 100; // Simplified
        const sharpeRatio = this.calculateSharpeRatio(averageReturn, maxDrawdown);

        return {
          strategyName: row.strategy_name || 'Unknown',
          totalSignals,
          executedTrades,
          winRate,
          totalPnL,
          averageReturn,
          maxDrawdown,
          sharpeRatio
        };
      });

      return strategies;
    } catch (error) {
      logger.error('Error analyzing strategy performance:', error as Error);
      throw error;
    }
  }

  /**
   * Assess risk level based on real data
   */
  private async assessRiskLevel(
    performance: DailyPerformance, 
    marketAnalysis: MarketAnalysis
  ): Promise<{ riskLevel: 'low' | 'medium' | 'high'; riskFactors: string[]; recommendations: string[] }> {
    try {
      const riskFactors: string[] = [];
      const recommendations: string[] = [];

      // Assess risk based on performance
      if (performance.totalPnL < -performance.riskMetrics.maxDailyLoss * 0.5) {
        riskFactors.push('Approaching daily loss limit');
        recommendations.push('Consider reducing position sizes');
      }

      if (performance.maxDrawdown > 0.1) {
        riskFactors.push('High drawdown detected');
        recommendations.push('Review risk management parameters');
      }

      if (performance.winRate < 50) {
        riskFactors.push('Low win rate');
        recommendations.push('Review strategy parameters');
      }

      // Assess risk based on market conditions
      if (marketAnalysis.marketConditions.volatility === 'high') {
        riskFactors.push('High market volatility');
        recommendations.push('Reduce position sizes and tighten stops');
      }

      if (marketAnalysis.marketConditions.trend === 'bearish') {
        riskFactors.push('Bearish market trend');
        recommendations.push('Consider defensive positioning');
      }

      // Determine overall risk level
      let riskLevel: 'low' | 'medium' | 'high' = 'low';
      if (riskFactors.length >= 3) riskLevel = 'high';
      else if (riskFactors.length >= 1) riskLevel = 'medium';

      return { riskLevel, riskFactors, recommendations };
    } catch (error) {
      logger.error('Error assessing risk level:', error as Error);
      throw error;
    }
  }

  /**
   * Generate next day outlook based on real data
   */
  private async generateNextDayOutlook(marketAnalysis: MarketAnalysis): Promise<{
    marketBias: 'bullish' | 'bearish' | 'neutral';
    keyLevels: Record<string, { support: number; resistance: number }>;
    watchlist: string[];
  }> {
    try {
      // Determine market bias based on current conditions
      let marketBias: 'bullish' | 'bearish' | 'neutral' = 'neutral';
      
      if (marketAnalysis.marketConditions.trend === 'bullish' && 
          marketAnalysis.marketConditions.volatility === 'low') {
        marketBias = 'bullish';
      } else if (marketAnalysis.marketConditions.trend === 'bearish' && 
                 marketAnalysis.marketConditions.volatility === 'high') {
        marketBias = 'bearish';
      }

      // Get key levels from recent signals
      const levelsQuery = `
        SELECT 
          symbol,
          AVG(entry_price) as avg_entry,
          MIN(entry_price) as min_price,
          MAX(entry_price) as max_price
        FROM signals 
        WHERE created_at >= NOW() - INTERVAL '7 days'
        GROUP BY symbol
        HAVING COUNT(*) >= 3
        ORDER BY COUNT(*) DESC
        LIMIT 10
      `;

      const levelsResult = await this.pool.query(levelsQuery);
      
      const keyLevels: Record<string, { support: number; resistance: number }> = {};
      levelsResult.rows.forEach(row => {
        const avgPrice = parseFloat(row.avg_entry);
        const minPrice = parseFloat(row.min_price);
        const maxPrice = parseFloat(row.max_price);
        
        keyLevels[row.symbol] = {
          support: minPrice * 0.98, // 2% below min
          resistance: maxPrice * 1.02 // 2% above max
        };
      });

      // Generate watchlist from top performers
      const watchlist = marketAnalysis.topPerformers.map(p => p.symbol);

      return { marketBias, keyLevels, watchlist };
    } catch (error) {
      logger.error('Error generating next day outlook:', error as Error);
      throw error;
    }
  }

  /**
   * Store report in database
   */
  private async storeReport(report: EndOfDayReport): Promise<void> {
    try {
      const insertQuery = `
        INSERT INTO analytics (
          user_id, date, signals_generated, signals_successful, 
          total_pnl, win_rate, avg_confidence, patterns_used
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8
        )
      `;

      // For now, using a default user ID (1)
      // In a real system, this would be the system user or aggregated across all users
      await this.pool.query(insertQuery, [
        'system', // user_id
        report.date,
        report.performance.totalTrades,
        report.performance.winningTrades,
        report.performance.totalPnL,
        report.performance.winRate,
        report.strategyPerformance.reduce((sum, s) => sum + s.sharpeRatio, 0) / report.strategyPerformance.length,
        JSON.stringify(report.strategyPerformance.map(s => s.strategyName))
      ]);

      logger.info('Report stored in database');
    } catch (error) {
      logger.error('Error storing report:', error as Error);
      // Don't throw error here to avoid breaking the report generation
    }
  }

  /**
   * Assess market volatility based on signal data
   */
  private assessVolatility(signals: any[]): 'low' | 'medium' | 'high' {
    if (signals.length === 0) return 'medium';
    
    const avgConfidence = signals.reduce((sum, s) => sum + parseFloat(s.avg_confidence || 0), 0) / signals.length;
    const signalCount = signals.length;
    
    if (signalCount > 20 && avgConfidence > 80) return 'high';
    if (signalCount < 5 && avgConfidence < 60) return 'low';
    return 'medium';
  }

  /**
   * Assess market trend based on signal data
   */
  private assessTrend(signals: any[]): 'bullish' | 'bearish' | 'sideways' {
    if (signals.length === 0) return 'sideways';
    
    const totalPnL = signals.reduce((sum, s) => sum + parseFloat(s.total_pnl || 0), 0);
    const positiveSignals = signals.filter(s => parseFloat(s.total_pnl || 0) > 0).length;
    const negativeSignals = signals.filter(s => parseFloat(s.total_pnl || 0) < 0).length;
    
    if (totalPnL > 0 && positiveSignals > negativeSignals) return 'bullish';
    if (totalPnL < 0 && negativeSignals > positiveSignals) return 'bearish';
    return 'sideways';
  }

  /**
   * Assess market volume based on signal data
   */
  private assessVolume(signals: any[]): 'low' | 'medium' | 'high' {
    if (signals.length === 0) return 'medium';
    
    const totalVolume = signals.reduce((sum, s) => sum + parseFloat(s.total_volume || 0), 0);
    const avgVolume = totalVolume / signals.length;
    
    if (avgVolume > 1000000) return 'high';
    if (avgVolume < 100000) return 'low';
    return 'medium';
  }

  /**
   * Calculate Sharpe ratio (simplified)
   */
  private calculateSharpeRatio(return_: number, risk: number): number {
    if (risk === 0) return 0;
    return return_ / risk;
  }

  /**
   * Get historical reports from database
   */
  async getHistoricalReports(days: number = 30): Promise<EndOfDayReport[]> {
    try {
      const query = `
        SELECT * FROM analytics 
        WHERE date >= NOW() - INTERVAL '${days} days'
        ORDER BY date DESC
      `;
      
      const result = await this.pool.query(query);
      
      // Convert database records to report format
      return result.rows.map(row => ({
        date: row.date,
        timestamp: row.created_at,
        performance: {
          date: row.date,
          totalPnL: parseFloat(row.total_pnl) || 0,
          realizedPnL: parseFloat(row.total_pnl) || 0,
          unrealizedPnL: 0,
          totalTrades: parseInt(row.signals_generated) || 0,
          winningTrades: parseInt(row.signals_successful) || 0,
          losingTrades: parseInt(row.signals_generated) - parseInt(row.signals_successful),
          winRate: parseFloat(row.win_rate) || 0,
          averageWin: 0,
          averageLoss: 0,
          maxDrawdown: 0,
          sharpeRatio: parseFloat(row.avg_confidence) || 0,
          totalVolume: 0,
          activePositions: 0,
          riskMetrics: {
            dailyLoss: 0,
            maxDailyLoss: 1000,
            positionExposure: 0,
            maxPositionSize: 5000
          }
        },
        marketAnalysis: {
          date: row.date,
          session: 'intraday',
          marketConditions: {
            volatility: 'medium',
            trend: 'sideways',
            volume: 'medium'
          },
          topPerformers: [],
          worstPerformers: [],
          sectorPerformance: {}
        },
        strategyPerformance: [],
        riskAssessment: {
          riskLevel: 'low',
          riskFactors: [],
          recommendations: []
        },
        nextDayOutlook: {
          marketBias: 'neutral',
          keyLevels: {},
          watchlist: []
        }
      }));
    } catch (error) {
      logger.error('Error getting historical reports:', error as Error);
      return [];
    }
  }

  /**
   * Export report to JSON
   */
  exportReport(report: EndOfDayReport): string {
    return JSON.stringify(report, null, 2);
  }

  /**
   * Start automated analysis
   */
  async startAutomatedAnalysis(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Automated analysis is already running');
      return;
    }

    this.isRunning = true;
    
    // Run analysis every day at market close (4:00 PM EST)
    this.analysisInterval = setInterval(async () => {
      const now = new Date();
      const hour = now.getHours();
      const minute = now.getMinutes();
      
      // Check if it's market close time (4:00 PM EST)
      if (hour === 16 && minute === 0) {
        try {
          await this.generateEndOfDayReport();
        } catch (error) {
          logger.error('Error in automated analysis:', error as Error);
        }
      }
    }, 60000); // Check every minute

    logger.info('Automated analysis started');
  }

  /**
   * Stop automated analysis
   */
  stopAutomatedAnalysis(): void {
    if (this.analysisInterval) {
      clearInterval(this.analysisInterval);
      this.analysisInterval = null;
    }
    this.isRunning = false;
    logger.info('Automated analysis stopped');
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      reportsGenerated: this.dailyReports.length,
      lastReport: this.dailyReports[this.dailyReports.length - 1]?.date || null
    };
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    await this.pool.end();
    logger.info('EndOfDayAnalyzer database connection closed');
  }
} 