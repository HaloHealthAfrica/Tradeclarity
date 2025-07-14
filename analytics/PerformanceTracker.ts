import { createModuleLogger } from '../utils/logger';
import { Pool } from 'pg';

const logger = createModuleLogger('PerformanceTracker');

export interface PerformanceMetrics {
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
  profitFactor: number;
  totalVolume: number;
  activePositions: number;
  dailyReturns: DailyReturn[];
  monthlyReturns: MonthlyReturn[];
  strategyPerformance: StrategyPerformance[];
}

export interface DailyReturn {
  date: string;
  pnl: number;
  trades: number;
  volume: number;
  drawdown: number;
}

export interface MonthlyReturn {
  month: string;
  return: number;
  trades: number;
  winRate: number;
  volume: number;
}

export interface StrategyPerformance {
  strategy: string;
  totalSignals: number;
  executedTrades: number;
  winRate: number;
  totalPnL: number;
  averageReturn: number;
  sharpeRatio: number;
}

export class PerformanceTracker {
  private pool: Pool;
  private isTracking = false;
  private updateInterval: NodeJS.Timeout | null = null;

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

    logger.info('PerformanceTracker initialized with database connection');
  }

  /**
   * Start performance tracking
   */
  async startTracking(): Promise<void> {
    if (this.isTracking) {
      logger.warn('Performance tracking is already running');
      return;
    }

    this.isTracking = true;
    
    // Update metrics every 5 minutes
    this.updateInterval = setInterval(async () => {
      try {
        await this.updateMetrics();
      } catch (error) {
        logger.error('Error updating performance metrics:', error as Error);
      }
    }, 5 * 60 * 1000);

    // Initial metrics update
    await this.updateMetrics();
    
    logger.info('Performance tracking started');
  }

  /**
   * Stop performance tracking
   */
  stopTracking(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    this.isTracking = false;
    logger.info('Performance tracking stopped');
  }

  /**
   * Get current performance metrics
   */
  async getPerformanceMetrics(days: number = 30): Promise<PerformanceMetrics> {
    try {
      logger.info('Getting performance metrics', { days });

      // Get overall performance from database
      const overallQuery = `
        SELECT 
          COUNT(*) as total_signals,
          COUNT(CASE WHEN status = 'executed' THEN 1 END) as executed_trades,
          COUNT(CASE WHEN status = 'executed' AND pnl > 0 THEN 1 END) as winning_trades,
          COUNT(CASE WHEN status = 'executed' AND pnl < 0 THEN 1 END) as losing_trades,
          COALESCE(SUM(CASE WHEN status = 'executed' THEN pnl ELSE 0 END), 0) as total_pnl,
          COALESCE(SUM(CASE WHEN status = 'executed' AND pnl > 0 THEN pnl ELSE 0 END), 0) as total_wins,
          COALESCE(SUM(CASE WHEN status = 'executed' AND pnl < 0 THEN ABS(pnl) ELSE 0 END), 0) as total_losses,
          COALESCE(SUM(volume), 0) as total_volume,
          COUNT(CASE WHEN status = 'open' THEN 1 END) as active_positions,
          COALESCE(SUM(CASE WHEN status = 'open' THEN unrealized_pnl ELSE 0 END), 0) as unrealized_pnl
        FROM signals 
        WHERE created_at >= NOW() - INTERVAL '${days} days'
      `;

      const overallResult = await this.pool.query(overallQuery);
      const overallData = overallResult.rows[0];

      const totalTrades = parseInt(overallData.executed_trades) || 0;
      const winningTrades = parseInt(overallData.winning_trades) || 0;
      const losingTrades = parseInt(overallData.losing_trades) || 0;
      const totalPnL = parseFloat(overallData.total_pnl) || 0;
      const totalWins = parseFloat(overallData.total_wins) || 0;
      const totalLosses = parseFloat(overallData.total_losses) || 0;
      const totalVolume = parseFloat(overallData.total_volume) || 0;
      const activePositions = parseInt(overallData.active_positions) || 0;
      const unrealizedPnL = parseFloat(overallData.unrealized_pnl) || 0;

      const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
      const averageWin = winningTrades > 0 ? totalWins / winningTrades : 0;
      const averageLoss = losingTrades > 0 ? totalLosses / losingTrades : 0;
      const profitFactor = totalLosses > 0 ? totalWins / totalLosses : 0;

      // Calculate max drawdown
      const drawdownQuery = `
        SELECT 
          COALESCE(MIN(daily_pnl), 0) as max_drawdown
        FROM (
          SELECT 
            DATE(created_at) as trade_date,
            SUM(CASE WHEN status = 'executed' THEN pnl ELSE 0 END) as daily_pnl
          FROM signals 
          WHERE created_at >= NOW() - INTERVAL '${days} days'
          GROUP BY DATE(created_at)
          ORDER BY trade_date
        ) daily_performance
      `;

      const drawdownResult = await this.pool.query(drawdownQuery);
      const maxDrawdown = Math.abs(parseFloat(drawdownResult.rows[0]?.max_drawdown || '0'));

      // Calculate Sharpe ratio (simplified)
      const sharpeRatio = this.calculateSharpeRatio(totalPnL, maxDrawdown);

      // Get daily returns
      const dailyReturns = await this.getDailyReturns(days);

      // Get monthly returns
      const monthlyReturns = await this.getMonthlyReturns(days);

      // Get strategy performance
      const strategyPerformance = await this.getStrategyPerformance(days);

      const metrics: PerformanceMetrics = {
        totalPnL,
        realizedPnL: totalPnL,
        unrealizedPnL,
        totalTrades,
        winningTrades,
        losingTrades,
        winRate,
        averageWin,
        averageLoss,
        maxDrawdown,
        sharpeRatio,
        profitFactor,
        totalVolume,
        activePositions,
        dailyReturns,
        monthlyReturns,
        strategyPerformance
      };

      logger.info('Performance metrics calculated', {
        totalPnL: `$${totalPnL.toFixed(2)}`,
        winRate: `${winRate.toFixed(2)}%`,
        totalTrades
      });

      return metrics;
    } catch (error) {
      logger.error('Error getting performance metrics:', error as Error);
      throw error;
    }
  }

  /**
   * Get daily returns from database
   */
  private async getDailyReturns(days: number): Promise<DailyReturn[]> {
    try {
      const query = `
        SELECT 
          DATE(created_at) as trade_date,
          SUM(CASE WHEN status = 'executed' THEN pnl ELSE 0 END) as daily_pnl,
          COUNT(CASE WHEN status = 'executed' THEN 1 END) as daily_trades,
          SUM(volume) as daily_volume
        FROM signals 
        WHERE created_at >= NOW() - INTERVAL '${days} days'
        GROUP BY DATE(created_at)
        ORDER BY trade_date DESC
      `;

      const result = await this.pool.query(query);
      
      const dailyReturns: DailyReturn[] = result.rows.map(row => {
        const pnl = parseFloat(row.daily_pnl) || 0;
        const trades = parseInt(row.daily_trades) || 0;
        const volume = parseFloat(row.daily_volume) || 0;
        
        return {
          date: row.trade_date,
          pnl,
          trades,
          volume,
          drawdown: 0 // Would need cumulative calculation for actual drawdown
        };
      });

      return dailyReturns;
    } catch (error) {
      logger.error('Error getting daily returns:', error as Error);
      return [];
    }
  }

  /**
   * Get monthly returns from database
   */
  private async getMonthlyReturns(days: number): Promise<MonthlyReturn[]> {
    try {
      const query = `
        SELECT 
          TO_CHAR(created_at, 'YYYY-MM') as month,
          SUM(CASE WHEN status = 'executed' THEN pnl ELSE 0 END) as monthly_pnl,
          COUNT(CASE WHEN status = 'executed' THEN 1 END) as monthly_trades,
          COUNT(CASE WHEN status = 'executed' AND pnl > 0 THEN 1 END) as winning_trades,
          SUM(volume) as monthly_volume
        FROM signals 
        WHERE created_at >= NOW() - INTERVAL '${days} days'
        GROUP BY TO_CHAR(created_at, 'YYYY-MM')
        ORDER BY month DESC
      `;

      const result = await this.pool.query(query);
      
      const monthlyReturns: MonthlyReturn[] = result.rows.map(row => {
        const return_ = parseFloat(row.monthly_pnl) || 0;
        const trades = parseInt(row.monthly_trades) || 0;
        const winningTrades = parseInt(row.winning_trades) || 0;
        const volume = parseFloat(row.monthly_volume) || 0;
        
        const winRate = trades > 0 ? (winningTrades / trades) * 100 : 0;
        
        return {
          month: row.month,
          return: return_,
          trades,
          winRate,
          volume
        };
      });

      return monthlyReturns;
    } catch (error) {
      logger.error('Error getting monthly returns:', error as Error);
      return [];
    }
  }

  /**
   * Get strategy performance from database
   */
  private async getStrategyPerformance(days: number): Promise<StrategyPerformance[]> {
    try {
      const query = `
        SELECT 
          pattern as strategy_name,
          COUNT(*) as total_signals,
          COUNT(CASE WHEN status = 'executed' THEN 1 END) as executed_trades,
          COUNT(CASE WHEN status = 'executed' AND pnl > 0 THEN 1 END) as winning_trades,
          COALESCE(SUM(CASE WHEN status = 'executed' THEN pnl ELSE 0 END), 0) as total_pnl,
          AVG(confidence) as avg_confidence
        FROM signals 
        WHERE pattern IS NOT NULL
        AND created_at >= NOW() - INTERVAL '${days} days'
        GROUP BY pattern
        ORDER BY total_pnl DESC
      `;

      const result = await this.pool.query(query);
      
      const strategyPerformance: StrategyPerformance[] = result.rows.map(row => {
        const totalSignals = parseInt(row.total_signals) || 0;
        const executedTrades = parseInt(row.executed_trades) || 0;
        const winningTrades = parseInt(row.winning_trades) || 0;
        const totalPnL = parseFloat(row.total_pnl) || 0;
        const avgConfidence = parseFloat(row.avg_confidence) || 0;

        const winRate = executedTrades > 0 ? (winningTrades / executedTrades) * 100 : 0;
        const averageReturn = executedTrades > 0 ? totalPnL / executedTrades : 0;
        const sharpeRatio = avgConfidence / 100; // Simplified

        return {
          strategy: row.strategy_name || 'Unknown',
          totalSignals,
          executedTrades,
          winRate,
          totalPnL,
          averageReturn,
          sharpeRatio
        };
      });

      return strategyPerformance;
    } catch (error) {
      logger.error('Error getting strategy performance:', error as Error);
      return [];
    }
  }

  /**
   * Calculate Sharpe ratio (simplified)
   */
  private calculateSharpeRatio(return_: number, risk: number): number {
    if (risk === 0) return 0;
    return return_ / risk;
  }

  /**
   * Update metrics in database
   */
  private async updateMetrics(): Promise<void> {
    try {
      const metrics = await this.getPerformanceMetrics(1); // Today's metrics
      
      // Store metrics in analytics table
      const insertQuery = `
        INSERT INTO analytics (
          user_id, date, signals_generated, signals_successful, 
          total_pnl, win_rate, avg_confidence, patterns_used
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8
        )
        ON CONFLICT (user_id, date) 
        DO UPDATE SET
          signals_generated = EXCLUDED.signals_generated,
          signals_successful = EXCLUDED.signals_successful,
          total_pnl = EXCLUDED.total_pnl,
          win_rate = EXCLUDED.win_rate,
          avg_confidence = EXCLUDED.avg_confidence,
          patterns_used = EXCLUDED.patterns_used
      `;

      await this.pool.query(insertQuery, [
        'system', // user_id
        new Date().toISOString().split('T')[0], // today's date
        metrics.totalTrades,
        metrics.winningTrades,
        metrics.totalPnL,
        metrics.winRate,
        metrics.sharpeRatio * 100, // Convert to percentage
        JSON.stringify(metrics.strategyPerformance.map(s => s.strategy))
      ]);

      logger.info('Performance metrics updated in database');
    } catch (error) {
      logger.error('Error updating metrics:', error as Error);
    }
  }

  /**
   * Get performance comparison between strategies
   */
  async compareStrategies(strategies: string[], days: number = 30): Promise<{
    [strategy: string]: {
      totalPnL: number;
      winRate: number;
      totalTrades: number;
      sharpeRatio: number;
    };
  }> {
    try {
      const comparison: { [strategy: string]: any } = {};

      for (const strategy of strategies) {
        const query = `
          SELECT 
            COUNT(*) as total_signals,
            COUNT(CASE WHEN status = 'executed' THEN 1 END) as executed_trades,
            COUNT(CASE WHEN status = 'executed' AND pnl > 0 THEN 1 END) as winning_trades,
            COALESCE(SUM(CASE WHEN status = 'executed' THEN pnl ELSE 0 END), 0) as total_pnl,
            AVG(confidence) as avg_confidence
          FROM signals 
          WHERE pattern = $1
          AND created_at >= NOW() - INTERVAL '${days} days'
        `;

        const result = await this.pool.query(query, [strategy]);
        const data = result.rows[0];

        if (data) {
          const totalTrades = parseInt(data.executed_trades) || 0;
          const winningTrades = parseInt(data.winning_trades) || 0;
          const totalPnL = parseFloat(data.total_pnl) || 0;
          const avgConfidence = parseFloat(data.avg_confidence) || 0;

          const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
          const sharpeRatio = avgConfidence / 100;

          comparison[strategy] = {
            totalPnL,
            winRate,
            totalTrades,
            sharpeRatio
          };
        }
      }

      return comparison;
    } catch (error) {
      logger.error('Error comparing strategies:', error as Error);
      return {};
    }
  }

  /**
   * Get risk metrics
   */
  async getRiskMetrics(days: number = 30): Promise<{
    volatility: number;
    maxDrawdown: number;
    var95: number; // Value at Risk (95%)
    currentExposure: number;
    dailyLossLimit: number;
  }> {
    try {
      // Get daily returns for volatility calculation
      const dailyReturns = await this.getDailyReturns(days);
      
      if (dailyReturns.length === 0) {
        return {
          volatility: 0,
          maxDrawdown: 0,
          var95: 0,
          currentExposure: 0,
          dailyLossLimit: 1000
        };
      }

      // Calculate volatility
      const returns = dailyReturns.map(d => d.pnl);
      const meanReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
      const variance = returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / returns.length;
      const volatility = Math.sqrt(variance);

      // Calculate max drawdown
      const maxDrawdown = Math.max(...dailyReturns.map(d => Math.abs(d.pnl)));

      // Calculate VaR (95%)
      const sortedReturns = returns.sort((a, b) => a - b);
      const varIndex = Math.floor(sortedReturns.length * 0.05);
      const var95 = sortedReturns[varIndex] || 0;

      // Get current exposure
      const exposureQuery = `
        SELECT 
          COUNT(CASE WHEN status = 'open' THEN 1 END) as active_positions,
          COALESCE(SUM(CASE WHEN status = 'open' THEN ABS(unrealized_pnl) ELSE 0 END), 0) as total_exposure
        FROM signals 
        WHERE created_at >= NOW() - INTERVAL '${days} days'
      `;

      const exposureResult = await this.pool.query(exposureQuery);
      const exposureData = exposureResult.rows[0];
      const currentExposure = parseFloat(exposureData.total_exposure) || 0;

      return {
        volatility,
        maxDrawdown,
        var95,
        currentExposure,
        dailyLossLimit: 1000 // Default, should come from user settings
      };
    } catch (error) {
      logger.error('Error getting risk metrics:', error as Error);
      return {
        volatility: 0,
        maxDrawdown: 0,
        var95: 0,
        currentExposure: 0,
        dailyLossLimit: 1000
      };
    }
  }

  /**
   * Export performance data to CSV
   */
  exportToCSV(metrics: PerformanceMetrics): string {
    try {
      let csv = 'Date,PnL,Trades,Volume,Drawdown\n';
      
      for (const daily of metrics.dailyReturns) {
        csv += `${daily.date},${daily.pnl},${daily.trades},${daily.volume},${daily.drawdown}\n`;
      }
      
      return csv;
    } catch (error) {
      logger.error('Error exporting to CSV:', error as Error);
      return '';
    }
  }

  /**
   * Get tracking status
   */
  getStatus(): { isTracking: boolean; lastUpdate: string | null } {
    return {
      isTracking: this.isTracking,
      lastUpdate: this.isTracking ? new Date().toISOString() : null
    };
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    await this.pool.end();
    logger.info('PerformanceTracker database connection closed');
  }
}

// Export singleton instance
export const performanceTracker = new PerformanceTracker();