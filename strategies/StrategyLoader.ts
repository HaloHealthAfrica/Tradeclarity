import { createModuleLogger } from '../utils/logger';
import { Pool } from 'pg';
import { BaseStrategy } from './BaseStrategy';
import { EMAConfluence } from './EMAConfluence';
import { SqueezeStrategy } from './SqueezeStrategy';
import { ICTStrategy } from './ICTStrategy';
import { FVGStrategy } from './FVGStrategy';

const logger = createModuleLogger('StrategyLoader');

export interface StrategyConfig {
  name: string;
  enabled: boolean;
  parameters: Record<string, any>;
  riskSettings: {
    maxPositionSize: number;
    maxDailyLoss: number;
    stopLoss: number;
    takeProfit: number;
  };
  performance: {
    totalSignals: number;
    winRate: number;
    avgReturn: number;
    sharpeRatio: number;
    lastUpdated: string;
  };
}

export interface StrategyInstance {
  strategy: BaseStrategy;
  config: StrategyConfig;
}

export class StrategyLoader {
  private strategies: Map<string, StrategyInstance> = new Map();
  private pool: Pool;

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

    logger.info('StrategyLoader initialized with database connection');
  }

  /**
   * Load all strategies from database
   */
  async loadStrategies(): Promise<void> {
    try {
      logger.info('Loading strategies from database');

      // Get strategy configurations from database
      const configQuery = `
        SELECT 
          pattern as strategy_name,
          COUNT(*) as total_signals,
          COUNT(CASE WHEN status = 'executed' THEN 1 END) as executed_trades,
          COUNT(CASE WHEN status = 'executed' AND pnl > 0 THEN 1 END) as winning_trades,
          COALESCE(SUM(CASE WHEN status = 'executed' THEN pnl ELSE 0 END), 0) as total_pnl,
          AVG(confidence) as avg_confidence,
          MAX(created_at) as last_updated
        FROM signals 
        WHERE pattern IS NOT NULL
        GROUP BY pattern
        ORDER BY total_pnl DESC
      `;

      const configResult = await this.pool.query(configQuery);
      
      for (const row of configResult.rows) {
        const strategyName = row.strategy_name;
        const totalSignals = parseInt(row.total_signals) || 0;
        const executedTrades = parseInt(row.executed_trades) || 0;
        const winningTrades = parseInt(row.winning_trades) || 0;
        const totalPnL = parseFloat(row.total_pnl) || 0;
        const avgConfidence = parseFloat(row.avg_confidence) || 0;
        const lastUpdated = row.last_updated;

        const winRate = executedTrades > 0 ? (winningTrades / executedTrades) * 100 : 0;
        const avgReturn = executedTrades > 0 ? totalPnL / executedTrades : 0;

        // Create strategy configuration
        const config: StrategyConfig = {
          name: strategyName,
          enabled: true, // Default to enabled
          parameters: this.getDefaultParameters(strategyName),
          riskSettings: {
            maxPositionSize: 5000,
            maxDailyLoss: 1000,
            stopLoss: 2.0,
            takeProfit: 4.0
          },
          performance: {
            totalSignals,
            winRate,
            avgReturn,
            sharpeRatio: avgConfidence / 100, // Simplified
            lastUpdated: lastUpdated
          }
        };

        // Create strategy instance
        const strategy = this.createStrategyInstance(strategyName, config);
        if (strategy) {
          this.strategies.set(strategyName, {
            strategy,
            config
          });

          logger.info(`Loaded strategy: ${strategyName}`, {
            totalSignals,
            winRate: `${winRate.toFixed(2)}%`,
            avgReturn: `$${avgReturn.toFixed(2)}`
          });
        }
      }

      logger.info(`Loaded ${this.strategies.size} strategies from database`);
    } catch (error) {
      logger.error('Error loading strategies from database:', error as Error);
      // Fallback to loading default strategies
      await this.loadDefaultStrategies();
    }
  }

  /**
   * Load default strategies when database is not available
   */
  private async loadDefaultStrategies(): Promise<void> {
    logger.info('Loading default strategies');

    const defaultStrategies = [
      {
        name: 'EMAConfluence',
        config: {
          name: 'EMAConfluence',
          enabled: true,
          parameters: {
            shortPeriod: 9,
            longPeriod: 21,
            rsiPeriod: 14,
            rsiOverbought: 70,
            rsiOversold: 30
          },
          riskSettings: {
            maxPositionSize: 5000,
            maxDailyLoss: 1000,
            stopLoss: 2.0,
            takeProfit: 4.0
          },
          performance: {
            totalSignals: 0,
            winRate: 0,
            avgReturn: 0,
            sharpeRatio: 0,
            lastUpdated: new Date().toISOString()
          }
        }
      },
      {
        name: 'SqueezeStrategy',
        config: {
          name: 'SqueezeStrategy',
          enabled: true,
          parameters: {
            bbPeriod: 20,
            bbStdDev: 2,
            kcPeriod: 20,
            kcStdDev: 1.5
          },
          riskSettings: {
            maxPositionSize: 5000,
            maxDailyLoss: 1000,
            stopLoss: 2.0,
            takeProfit: 4.0
          },
          performance: {
            totalSignals: 0,
            winRate: 0,
            avgReturn: 0,
            sharpeRatio: 0,
            lastUpdated: new Date().toISOString()
          }
        }
      },
      {
        name: 'ICTStrategy',
        config: {
          name: 'ICTStrategy',
          enabled: true,
          parameters: {
            sessionStart: '09:30',
            sessionEnd: '16:00',
            timeZone: 'America/New_York'
          },
          riskSettings: {
            maxPositionSize: 5000,
            maxDailyLoss: 1000,
            stopLoss: 2.0,
            takeProfit: 4.0
          },
          performance: {
            totalSignals: 0,
            winRate: 0,
            avgReturn: 0,
            sharpeRatio: 0,
            lastUpdated: new Date().toISOString()
          }
        }
      },
      {
        name: 'FVGStrategy',
        config: {
          name: 'FVGStrategy',
          enabled: true,
          parameters: {
            minGapSize: 0.1,
            minVolumeRatio: 1.5
          },
          riskSettings: {
            maxPositionSize: 5000,
            maxDailyLoss: 1000,
            stopLoss: 2.0,
            takeProfit: 4.0
          },
          performance: {
            totalSignals: 0,
            winRate: 0,
            avgReturn: 0,
            sharpeRatio: 0,
            lastUpdated: new Date().toISOString()
          }
        }
      }
    ];

    for (const { name, config } of defaultStrategies) {
      const strategy = this.createStrategyInstance(name, config);
      if (strategy) {
        this.strategies.set(name, {
          strategy,
          config
        });
      }
    }

    logger.info(`Loaded ${this.strategies.size} default strategies`);
  }

  /**
   * Create strategy instance based on name
   */
  private createStrategyInstance(name: string, config: StrategyConfig): BaseStrategy | null {
    try {
      switch (name) {
        case 'EMAConfluence':
          return new EMAConfluence(config.parameters);
        case 'SqueezeStrategy':
          return new SqueezeStrategy(config.parameters);
        case 'ICTStrategy':
          return new ICTStrategy(config.parameters);
        case 'FVGStrategy':
          return new FVGStrategy(config.parameters);
        default:
          logger.warn(`Unknown strategy: ${name}`);
          return null;
      }
    } catch (error) {
      logger.error(`Error creating strategy instance for ${name}:`, error as Error);
      return null;
    }
  }

  /**
   * Get default parameters for strategy
   */
  private getDefaultParameters(strategyName: string): Record<string, any> {
    switch (strategyName) {
      case 'EMAConfluence':
        return {
          shortPeriod: 9,
          longPeriod: 21,
          rsiPeriod: 14,
          rsiOverbought: 70,
          rsiOversold: 30
        };
      case 'SqueezeStrategy':
        return {
          bbPeriod: 20,
          bbStdDev: 2,
          kcPeriod: 20,
          kcStdDev: 1.5
        };
      case 'ICTStrategy':
        return {
          sessionStart: '09:30',
          sessionEnd: '16:00',
          timeZone: 'America/New_York'
        };
      case 'FVGStrategy':
        return {
          minGapSize: 0.1,
          minVolumeRatio: 1.5
        };
      default:
        return {};
    }
  }

  /**
   * Get all loaded strategies
   */
  getAllStrategies(): StrategyInstance[] {
    return Array.from(this.strategies.values());
  }

  /**
   * Get strategy by name
   */
  getStrategy(name: string): StrategyInstance | null {
    return this.strategies.get(name) || null;
  }

  /**
   * Get enabled strategies
   */
  getEnabledStrategies(): StrategyInstance[] {
    return Array.from(this.strategies.values()).filter(instance => instance.config.enabled);
  }

  /**
   * Update strategy configuration
   */
  async updateStrategyConfig(name: string, config: Partial<StrategyConfig>): Promise<boolean> {
    try {
      const instance = this.strategies.get(name);
      if (!instance) {
        logger.warn(`Strategy ${name} not found`);
        return false;
      }

      // Update configuration
      Object.assign(instance.config, config);

      // Store updated configuration in database
      await this.storeStrategyConfig(name, instance.config);

      logger.info(`Updated strategy configuration for ${name}`);
      return true;
    } catch (error) {
      logger.error(`Error updating strategy configuration for ${name}:`, error as Error);
      return false;
    }
  }

  /**
   * Store strategy configuration in database
   */
  private async storeStrategyConfig(name: string, config: StrategyConfig): Promise<void> {
    try {
      // This would typically store in a strategies table
      // For now, we'll update the signals table with strategy metadata
      const updateQuery = `
        UPDATE signals 
        SET 
          confidence = $1,
          pattern = $2
        WHERE pattern = $3
        AND created_at = (
          SELECT MAX(created_at) 
          FROM signals 
          WHERE pattern = $3
        )
      `;

      await this.pool.query(updateQuery, [
        config.performance.sharpeRatio * 100, // Store as confidence
        name,
        name
      ]);

      logger.info(`Stored strategy configuration for ${name}`);
    } catch (error) {
      logger.error(`Error storing strategy configuration for ${name}:`, error as Error);
      // Don't throw error to avoid breaking the update process
    }
  }

  /**
   * Get strategy performance from database
   */
  async getStrategyPerformance(name: string, days: number = 30): Promise<{
    totalSignals: number;
    winRate: number;
    avgReturn: number;
    sharpeRatio: number;
    totalPnL: number;
    trades: Array<{
      date: string;
      symbol: string;
      pnl: number;
      confidence: number;
    }>;
  }> {
    try {
      const performanceQuery = `
        SELECT 
          COUNT(*) as total_signals,
          COUNT(CASE WHEN status = 'executed' THEN 1 END) as executed_trades,
          COUNT(CASE WHEN status = 'executed' AND pnl > 0 THEN 1 END) as winning_trades,
          COALESCE(SUM(CASE WHEN status = 'executed' THEN pnl ELSE 0 END), 0) as total_pnl,
          AVG(confidence) as avg_confidence,
          symbol,
          DATE(created_at) as trade_date,
          pnl,
          confidence
        FROM signals 
        WHERE pattern = $1
        AND created_at >= NOW() - INTERVAL '${days} days'
        GROUP BY symbol, DATE(created_at), pnl, confidence
        ORDER BY trade_date DESC
      `;

      const result = await this.pool.query(performanceQuery, [name]);
      
      if (result.rows.length === 0) {
        return {
          totalSignals: 0,
          winRate: 0,
          avgReturn: 0,
          sharpeRatio: 0,
          totalPnL: 0,
          trades: []
        };
      }

      const totalSignals = parseInt(result.rows[0].total_signals) || 0;
      const executedTrades = parseInt(result.rows[0].executed_trades) || 0;
      const winningTrades = parseInt(result.rows[0].winning_trades) || 0;
      const totalPnL = parseFloat(result.rows[0].total_pnl) || 0;
      const avgConfidence = parseFloat(result.rows[0].avg_confidence) || 0;

      const winRate = executedTrades > 0 ? (winningTrades / executedTrades) * 100 : 0;
      const avgReturn = executedTrades > 0 ? totalPnL / executedTrades : 0;

      const trades = result.rows
        .filter(row => row.pnl !== null)
        .map(row => ({
          date: row.trade_date,
          symbol: row.symbol,
          pnl: parseFloat(row.pnl) || 0,
          confidence: parseFloat(row.confidence) || 0
        }));

      return {
        totalSignals,
        winRate,
        avgReturn,
        sharpeRatio: avgConfidence / 100,
        totalPnL,
        trades
      };
    } catch (error) {
      logger.error(`Error getting strategy performance for ${name}:`, error as Error);
      return {
        totalSignals: 0,
        winRate: 0,
        avgReturn: 0,
        sharpeRatio: 0,
        totalPnL: 0,
        trades: []
      };
    }
  }

  /**
   * Enable/disable strategy
   */
  async toggleStrategy(name: string, enabled: boolean): Promise<boolean> {
    try {
      const instance = this.strategies.get(name);
      if (!instance) {
        logger.warn(`Strategy ${name} not found`);
        return false;
      }

      instance.config.enabled = enabled;
      await this.storeStrategyConfig(name, instance.config);

      logger.info(`${enabled ? 'Enabled' : 'Disabled'} strategy: ${name}`);
      return true;
    } catch (error) {
      logger.error(`Error toggling strategy ${name}:`, error as Error);
      return false;
    }
  }

  /**
   * Get strategy statistics
   */
  async getStrategyStats(): Promise<{
    totalStrategies: number;
    enabledStrategies: number;
    totalSignals: number;
    totalPnL: number;
    avgWinRate: number;
  }> {
    try {
      const statsQuery = `
        SELECT 
          COUNT(DISTINCT pattern) as total_strategies,
          COUNT(*) as total_signals,
          COUNT(CASE WHEN status = 'executed' THEN 1 END) as executed_trades,
          COUNT(CASE WHEN status = 'executed' AND pnl > 0 THEN 1 END) as winning_trades,
          COALESCE(SUM(CASE WHEN status = 'executed' THEN pnl ELSE 0 END), 0) as total_pnl
        FROM signals 
        WHERE pattern IS NOT NULL
      `;

      const result = await this.pool.query(statsQuery);
      const row = result.rows[0];

      const totalStrategies = parseInt(row.total_strategies) || 0;
      const totalSignals = parseInt(row.total_signals) || 0;
      const executedTrades = parseInt(row.executed_trades) || 0;
      const winningTrades = parseInt(row.winning_trades) || 0;
      const totalPnL = parseFloat(row.total_pnl) || 0;

      const avgWinRate = executedTrades > 0 ? (winningTrades / executedTrades) * 100 : 0;
      const enabledStrategies = this.getEnabledStrategies().length;

      return {
        totalStrategies,
        enabledStrategies,
        totalSignals,
        totalPnL,
        avgWinRate
      };
    } catch (error) {
      logger.error('Error getting strategy stats:', error as Error);
      return {
        totalStrategies: 0,
        enabledStrategies: 0,
        totalSignals: 0,
        totalPnL: 0,
        avgWinRate: 0
      };
    }
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    await this.pool.end();
    logger.info('StrategyLoader database connection closed');
  }
}

// Export singleton instance
export const strategyLoader = new StrategyLoader(); 