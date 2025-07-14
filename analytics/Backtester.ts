// Backtester.ts
import axios from 'axios';
import { Pool } from 'pg';
import { createModuleLogger } from '../utils/logger';
import type { Candle, TradeSignal } from '../types';

const logger = createModuleLogger('Backtester');

export interface BacktestConfig {
  strategy: string;
  symbols: string[];
  startDate: string;
  endDate: string;
  initialCapital: number;
  commission: number;
  slippage: number;
  positionSize: number;
  riskManagement: {
    maxPositionSize: number;
    maxDailyLoss: number;
    stopLoss: number;
    takeProfit: number;
  };
}

export interface BacktestResult {
  strategy: string;
  symbols: string[];
  startDate: string;
  endDate: string;
  initialCapital: number;
  finalCapital: number;
  totalReturn: number;
  annualizedReturn: number;
  maxDrawdown: number;
  sharpeRatio: number;
  winRate: number;
  totalTrades: number;
  profitableTrades: number;
  losingTrades: number;
  averageWin: number;
  averageLoss: number;
  profitFactor: number;
  trades: BacktestTrade[];
  equityCurve: EquityPoint[];
  monthlyReturns: MonthlyReturn[];
  riskMetrics: {
    volatility: number;
    beta: number;
    alpha: number;
    sortinoRatio: number;
    calmarRatio: number;
  };
}

export interface BacktestTrade {
  id: string;
  symbol: string;
  entryDate: string;
  exitDate: string;
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  side: 'LONG' | 'SHORT';
  pnl: number;
  pnlPercent: number;
  duration: number;
  signal: TradeSignal;
}

export interface EquityPoint {
  date: string;
  equity: number;
  drawdown: number;
  trades: number;
}

export interface MonthlyReturn {
  month: string;
  return: number;
  trades: number;
  winRate: number;
}

export interface MarketDataPoint {
  symbol: string;
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: number;
}

export class Backtester {
  private marketData: Map<string, MarketDataPoint[]> = new Map();
  private isRunning = false;
  private twelveDataApiKey: string;
  private twelveDataBaseUrl: string;
  private pool: Pool;

  constructor() {
    this.twelveDataApiKey = process.env.TWELVEDATA_API_KEY || '';
    this.twelveDataBaseUrl = 'https://api.twelvedata.com';
    
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
    
    if (!this.twelveDataApiKey) {
      logger.warn('TWELVEDATA_API_KEY not found. Backtesting will use fallback data.');
    }
  }

  /**
   * Load market data for symbols
   */
  async loadMarketData(symbols: string[], startDate: string, endDate: string): Promise<void> {
    try {
      logger.info('Loading market data', { symbols, startDate, endDate });

      for (const symbol of symbols) {
        const data = await this.fetchHistoricalData(symbol, startDate, endDate);
        this.marketData.set(symbol, data);
        
        logger.info(`Loaded ${data.length} data points for ${symbol}`);
      }

      logger.info('Market data loading completed');
    } catch (error) {
      logger.error('Error loading market data:', error as Error);
      throw error;
    }
  }

  /**
   * Run backtest with configuration
   */
  async runBacktest(config: BacktestConfig): Promise<BacktestResult> {
    try {
      logger.info('Starting backtest', { strategy: config.strategy, symbols: config.symbols });

      // Load market data if not already loaded
      if (this.marketData.size === 0) {
        await this.loadMarketData(config.symbols, config.startDate, config.endDate);
      }

      // Initialize strategy
      const strategy = await this.getStrategyInstance(config.strategy);
      if (!strategy) {
        throw new Error(`Strategy ${config.strategy} not found`);
      }

      await strategy.initialize();

      // Initialize tracking variables
      let currentCapital = config.initialCapital;
      let maxCapital = config.initialCapital;
      let maxDrawdown = 0;
      const trades: BacktestTrade[] = [];
      const equityCurve: EquityPoint[] = [];
      let totalTrades = 0;
      let profitableTrades = 0;
      let losingTrades = 0;
      let totalPnL = 0;
      let totalWins = 0;
      let totalLosses = 0;
      let dailyPnL = 0;
      let currentDate = '';

      // Process each symbol's data
      for (const symbol of config.symbols) {
        const symbolData = this.marketData.get(symbol);
        if (!symbolData) {
          logger.warn(`No data found for symbol ${symbol}`);
          continue;
        }

        // Sort data by date
        const sortedData = symbolData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        for (const dataPoint of sortedData) {
          const candle: Candle = {
            symbol: dataPoint.symbol,
            interval: '1d',
            timestamp: dataPoint.timestamp,
            open: dataPoint.open,
            high: dataPoint.high,
            low: dataPoint.low,
            close: dataPoint.close,
            volume: dataPoint.volume
          };

          // Update daily tracking
          if (dataPoint.date !== currentDate) {
            if (currentDate) {
              equityCurve.push({
                date: currentDate,
                equity: currentCapital,
                drawdown: maxCapital > 0 ? (maxCapital - currentCapital) / maxCapital : 0,
                trades: totalTrades
              });
            }
            currentDate = dataPoint.date;
            dailyPnL = 0;
          }

          // Get signal from strategy
          const signal = await strategy.onCandle(candle);
          
          if (signal) {
            // Check if we should execute the trade
            if (this.shouldExecuteTrade(signal, currentCapital, dailyPnL, config)) {
              const trade = await this.executeTrade(signal, candle, currentCapital, config);
              
              if (trade) {
                trades.push(trade);
                totalTrades++;
                totalPnL += trade.pnl;
                dailyPnL += trade.pnl;

                // Update capital
                currentCapital += trade.pnl;

                // Update tracking
                if (trade.pnl > 0) {
                  profitableTrades++;
                  totalWins += trade.pnl;
                } else {
                  losingTrades++;
                  totalLosses += Math.abs(trade.pnl);
                }

                // Update max capital and drawdown
                if (currentCapital > maxCapital) {
                  maxCapital = currentCapital;
                } else {
                  const drawdown = (maxCapital - currentCapital) / maxCapital;
                  if (drawdown > maxDrawdown) {
                    maxDrawdown = drawdown;
                  }
                }
              }
            }
          }
        }
      }

      // Add final equity point
      if (currentDate) {
        equityCurve.push({
          date: currentDate,
          equity: currentCapital,
          drawdown: maxCapital > 0 ? (maxCapital - currentCapital) / maxCapital : 0,
          trades: totalTrades
        });
      }

      // Calculate final metrics
      const totalReturn = (currentCapital - config.initialCapital) / config.initialCapital;
      const days = (new Date(config.endDate).getTime() - new Date(config.startDate).getTime()) / (1000 * 60 * 60 * 24);
      const annualizedReturn = Math.pow(1 + totalReturn, 365 / days) - 1;
      const winRate = totalTrades > 0 ? profitableTrades / totalTrades : 0;
      const averageWin = profitableTrades > 0 ? totalWins / profitableTrades : 0;
      const averageLoss = losingTrades > 0 ? totalLosses / losingTrades : 0;
      const profitFactor = totalLosses > 0 ? totalWins / totalLosses : 0;

      // Calculate risk metrics
      const riskMetrics = this.calculateRiskMetrics(equityCurve, config.initialCapital);

      // Calculate monthly returns
      const monthlyReturns = this.calculateMonthlyReturns(trades, config.startDate, config.endDate);

      const result: BacktestResult = {
        strategy: config.strategy,
        symbols: config.symbols,
        startDate: config.startDate,
        endDate: config.endDate,
        initialCapital: config.initialCapital,
        finalCapital: currentCapital,
        totalReturn,
        annualizedReturn,
        maxDrawdown,
        sharpeRatio: riskMetrics.sharpeRatio,
        winRate,
        totalTrades,
        profitableTrades,
        losingTrades,
        averageWin,
        averageLoss,
        profitFactor,
        trades,
        equityCurve,
        monthlyReturns,
        riskMetrics
      };

      // Store backtest result in database
      await this.storeBacktestResult(result);

      logger.info('Backtest completed', {
        strategy: config.strategy,
        totalReturn: `${(totalReturn * 100).toFixed(2)}%`,
        totalTrades,
        winRate: `${(winRate * 100).toFixed(2)}%`
      });

      return result;
    } catch (error) {
      logger.error('Error running backtest:', error as Error);
      throw error;
    }
  }

  /**
   * Execute a trade based on signal
   */
  private async executeTrade(
    signal: TradeSignal, 
    candle: Candle, 
    currentCapital: number, 
    config: BacktestConfig
  ): Promise<BacktestTrade | null> {
    try {
      const positionSize = Math.min(config.positionSize, config.riskManagement.maxPositionSize);
      const quantity = Math.floor(positionSize / candle.close);
      
      if (quantity === 0) {
        return null;
      }

      const entryPrice = candle.close;
      const commission = (quantity * entryPrice * config.commission) / 100;
      const slippage = (quantity * entryPrice * config.slippage) / 100;
      const totalCost = quantity * entryPrice + commission + slippage;

      if (totalCost > currentCapital) {
        return null;
      }

      // Simulate exit price (simplified - in reality this would be based on stop loss, take profit, or next candle)
      const exitPrice = signal.direction === 'LONG' 
        ? entryPrice * (1 + config.riskManagement.takeProfit / 100)
        : entryPrice * (1 - config.riskManagement.takeProfit / 100);

      const exitCommission = (quantity * exitPrice * config.commission) / 100;
      const exitSlippage = (quantity * exitPrice * config.slippage) / 100;
      
      const pnl = signal.direction === 'LONG' 
        ? (exitPrice - entryPrice) * quantity - commission - slippage - exitCommission - exitSlippage
        : (entryPrice - exitPrice) * quantity - commission - slippage - exitCommission - exitSlippage;

      const trade: BacktestTrade = {
        id: `trade_${Date.now()}_${Math.random()}`,
        symbol: signal.symbol,
        entryDate: new Date(candle.timestamp).toISOString().split('T')[0],
        exitDate: new Date(candle.timestamp + 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Next day
        entryPrice,
        exitPrice,
        quantity,
        side: signal.direction === 'LONG' ? 'LONG' : 'SHORT',
        pnl,
        pnlPercent: pnl / (quantity * entryPrice),
        duration: 1, // 1 day for simplicity
        signal
      };

      return trade;
    } catch (error) {
      logger.error('Error executing trade:', error as Error);
      return null;
    }
  }

  /**
   * Check if trade should be executed based on risk management
   */
  private shouldExecuteTrade(
    signal: TradeSignal, 
    currentCapital: number, 
    dailyPnL: number, 
    config: BacktestConfig
  ): boolean {
    // Check daily loss limit
    if (dailyPnL < -config.riskManagement.maxDailyLoss) {
      return false;
    }

    // Check capital requirements
    const positionSize = Math.min(config.positionSize, config.riskManagement.maxPositionSize);
    if (positionSize > currentCapital) {
      return false;
    }

    // Check signal confidence (optional)
    if (signal.confidence < 0.5) {
      return false;
    }

    return true;
  }

  /**
   * Calculate risk metrics
   */
  private calculateRiskMetrics(equityCurve: EquityPoint[], initialCapital: number): {
    volatility: number;
    beta: number;
    alpha: number;
    sharpeRatio: number;
    sortinoRatio: number;
    calmarRatio: number;
  } {
    try {
      if (equityCurve.length < 2) {
        return {
          volatility: 0,
          beta: 0,
          alpha: 0,
          sharpeRatio: 0,
          sortinoRatio: 0,
          calmarRatio: 0
        };
      }

      // Calculate returns
      const returns: number[] = [];
      for (let i = 1; i < equityCurve.length; i++) {
        const return_ = (equityCurve[i].equity - equityCurve[i - 1].equity) / equityCurve[i - 1].equity;
        returns.push(return_);
      }

      // Calculate metrics
      const meanReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
      const variance = returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / returns.length;
      const volatility = Math.sqrt(variance);
      
      // Sharpe ratio (assuming risk-free rate of 0)
      const sharpeRatio = volatility > 0 ? meanReturn / volatility : 0;

      // Sortino ratio (using downside deviation)
      const downsideReturns = returns.filter(r => r < 0);
      const downsideVariance = downsideReturns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / returns.length;
      const downsideDeviation = Math.sqrt(downsideVariance);
      const sortinoRatio = downsideDeviation > 0 ? meanReturn / downsideDeviation : 0;

      // Calmar ratio (annualized return / max drawdown)
      const totalReturn = (equityCurve[equityCurve.length - 1].equity - initialCapital) / initialCapital;
      const maxDrawdown = Math.max(...equityCurve.map(p => p.drawdown));
      const calmarRatio = maxDrawdown > 0 ? totalReturn / maxDrawdown : 0;

      return {
        volatility,
        beta: 1, // Simplified - would need market data for actual beta
        alpha: 0, // Simplified - would need market data for actual alpha
        sharpeRatio,
        sortinoRatio,
        calmarRatio
      };
    } catch (error) {
      logger.error('Error calculating risk metrics:', error as Error);
      return {
        volatility: 0,
        beta: 0,
        alpha: 0,
        sharpeRatio: 0,
        sortinoRatio: 0,
        calmarRatio: 0
      };
    }
  }

  /**
   * Calculate monthly returns
   */
  private calculateMonthlyReturns(trades: BacktestTrade[], startDate: string, endDate: string): MonthlyReturn[] {
    try {
      const monthlyData: { [key: string]: { pnl: number; trades: number; wins: number } } = {};

      for (const trade of trades) {
        const month = trade.entryDate.substring(0, 7); // YYYY-MM format
        
        if (!monthlyData[month]) {
          monthlyData[month] = { pnl: 0, trades: 0, wins: 0 };
        }

        monthlyData[month].pnl += trade.pnl;
        monthlyData[month].trades++;
        if (trade.pnl > 0) {
          monthlyData[month].wins++;
        }
      }

      return Object.entries(monthlyData).map(([month, data]) => ({
        month,
        return: data.pnl,
        trades: data.trades,
        winRate: data.trades > 0 ? data.wins / data.trades : 0
      }));
    } catch (error) {
      logger.error('Error calculating monthly returns:', error as Error);
      return [];
    }
  }

  /**
   * Fetch historical data using TwelveData API
   */
  private async fetchHistoricalData(symbol: string, startDate: string, endDate: string): Promise<MarketDataPoint[]> {
    try {
      logger.info('Fetching historical data', { symbol, startDate, endDate });

      if (!this.twelveDataApiKey) {
        logger.warn('TwelveData API key not configured. Using fallback data.');
        return this.generateFallbackData(symbol, startDate, endDate);
      }

      // Get historical data from TwelveData
      const response = await axios.get(`${this.twelveDataBaseUrl}/time_series`, {
        params: {
          symbol: symbol,
          interval: '1d',
          start_date: startDate,
          end_date: endDate,
          apikey: this.twelveDataApiKey
        },
        timeout: 15000
      });

      if (response.data.status !== 'ok') {
        throw new Error(`TwelveData API error: ${response.data.message || 'Unknown error'}`);
      }

      const historicalData: MarketDataPoint[] = response.data.values.map((item: any) => ({
        symbol: symbol,
        date: item.datetime,
        open: parseFloat(item.open),
        high: parseFloat(item.high),
        low: parseFloat(item.low),
        close: parseFloat(item.close),
        volume: parseInt(item.volume),
        timestamp: new Date(item.datetime).getTime()
      }));

      logger.info(`Fetched ${historicalData.length} data points for ${symbol}`);
      return historicalData;
      
    } catch (error) {
      logger.error('Error fetching historical data:', error as Error);
      
      // Return fallback data if API fails
      return this.generateFallbackData(symbol, startDate, endDate);
    }
  }

  /**
   * Generate fallback data when API is unavailable
   */
  private generateFallbackData(symbol: string, startDate: string, endDate: string): MarketDataPoint[] {
    const data: MarketDataPoint[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    const current = new Date(start);
    
    let basePrice = 100 + Math.random() * 50; // Random starting price
    
    while (current <= end) {
      const dateStr = current.toISOString().split('T')[0];
      
      // Generate OHLC data
      const volatility = 0.02; // 2% daily volatility
      const change = (Math.random() - 0.5) * volatility;
      basePrice *= (1 + change);
      
      const open = basePrice;
      const high = open * (1 + Math.random() * 0.01);
      const low = open * (1 - Math.random() * 0.01);
      const close = open * (1 + (Math.random() - 0.5) * 0.005);
      const volume = Math.floor(1000000 + Math.random() * 5000000);
      
      data.push({
        symbol,
        date: dateStr,
        open,
        high,
        low,
        close,
        volume,
        timestamp: current.getTime()
      });
      
      current.setDate(current.getDate() + 1);
    }
    
    return data;
  }

  /**
   * Get strategy instance from database or create mock
   */
  private async getStrategyInstance(strategyName: string): Promise<any> {
    try {
      // Try to get strategy configuration from database
      const strategyQuery = `
        SELECT 
          pattern as strategy_name,
          COUNT(*) as total_signals,
          AVG(confidence) as avg_confidence,
          AVG(entry_price) as avg_entry_price
        FROM signals 
        WHERE pattern = $1
        GROUP BY pattern
      `;

      const strategyResult = await this.pool.query(strategyQuery, [strategyName]);
      
      if (strategyResult.rows.length > 0) {
        const strategyData = strategyResult.rows[0];
        logger.info(`Found strategy ${strategyName} in database with ${strategyData.total_signals} signals`);
        
        // Create strategy instance based on database data
        return {
          name: strategyName,
          initialize: async () => {
            logger.info(`Initializing strategy: ${strategyName}`);
          },
          onCandle: async (candle: Candle) => {
            // Generate signals based on historical performance
            const avgConfidence = parseFloat(strategyData.avg_confidence) || 70;
            const signalProbability = avgConfidence / 100;
            
            if (Math.random() < signalProbability) {
              return {
                symbol: candle.symbol,
                direction: Math.random() > 0.5 ? 'LONG' : 'SHORT',
                confidence: avgConfidence + (Math.random() - 0.5) * 20,
                strategy: strategyName,
                timestamp: Date.now(),
                price: candle.close
              } as TradeSignal;
            }
            return null;
          }
        };
      }

      // Fallback to mock strategy if not found in database
      logger.warn(`Strategy ${strategyName} not found in database, using mock implementation`);
      return {
        name: strategyName,
        initialize: async () => {
          logger.info(`Initializing mock strategy: ${strategyName}`);
        },
        onCandle: async (candle: Candle) => {
          // Mock signal generation
          if (Math.random() > 0.95) { // 5% chance of signal
            return {
              symbol: candle.symbol,
              direction: Math.random() > 0.5 ? 'LONG' : 'SHORT',
              confidence: 0.7 + Math.random() * 0.3,
              strategy: strategyName,
              timestamp: Date.now(),
              price: candle.close
            } as TradeSignal;
          }
          return null;
        }
      };
    } catch (error) {
      logger.error('Error getting strategy instance:', error as Error);
      return null;
    }
  }

  /**
   * Store backtest result in database
   */
  private async storeBacktestResult(result: BacktestResult): Promise<void> {
    try {
      const insertQuery = `
        INSERT INTO analytics (
          user_id, date, signals_generated, signals_successful, 
          total_pnl, win_rate, avg_confidence, patterns_used
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8
        )
      `;

      await this.pool.query(insertQuery, [
        'backtest', // user_id
        result.startDate,
        result.totalTrades,
        result.profitableTrades,
        result.totalReturn * 100, // Convert to percentage
        result.winRate * 100, // Convert to percentage
        result.sharpeRatio,
        JSON.stringify([result.strategy])
      ]);

      logger.info('Backtest result stored in database');
    } catch (error) {
      logger.error('Error storing backtest result:', error as Error);
      // Don't throw error here to avoid breaking the backtest
    }
  }

  /**
   * Compare multiple strategies
   */
  async compareStrategies(strategies: string[], config: Omit<BacktestConfig, 'strategy'>): Promise<BacktestResult[]> {
    try {
      logger.info('Starting strategy comparison', { strategies });

      const results: BacktestResult[] = [];

      for (const strategy of strategies) {
        const strategyConfig: BacktestConfig = {
          ...config,
          strategy
        };

        const result = await this.runBacktest(strategyConfig);
        results.push(result);
      }

      // Sort by total return
      results.sort((a, b) => b.totalReturn - a.totalReturn);

      logger.info('Strategy comparison completed', {
        bestStrategy: results[0]?.strategy,
        bestReturn: results[0]?.totalReturn
      });

      return results;
    } catch (error) {
      logger.error('Error comparing strategies:', error as Error);
      throw error;
    }
  }

  /**
   * Optimize strategy parameters
   */
  async optimizeStrategy(
    strategy: string,
    config: Omit<BacktestConfig, 'strategy'>,
    parameters: Record<string, number[]>
  ): Promise<{ bestParams: Record<string, number>; bestResult: BacktestResult }> {
    try {
      logger.info('Starting strategy optimization', { strategy, parameters });

      let bestResult: BacktestResult | null = null;
      let bestParams: Record<string, number> = {};
      let bestReturn = -Infinity;

      // Generate parameter combinations
      const paramCombinations = this.generateParameterCombinations(parameters);

      for (const params of paramCombinations) {
        try {
          const strategyConfig: BacktestConfig = {
            ...config,
            strategy,
            // Apply parameters to config
            ...params
          };

          const result = await this.runBacktest(strategyConfig);

          if (result.totalReturn > bestReturn) {
            bestReturn = result.totalReturn;
            bestResult = result;
            bestParams = params;
          }
        } catch (error) {
          logger.warn('Error testing parameter combination:', error as Error);
        }
      }

      if (!bestResult) {
        throw new Error('No valid parameter combinations found');
      }

      logger.info('Strategy optimization completed', {
        strategy,
        bestParams,
        bestReturn: bestResult.totalReturn
      });

      return { bestParams, bestResult };
    } catch (error) {
      logger.error('Error optimizing strategy:', error as Error);
      throw error;
    }
  }

  /**
   * Generate parameter combinations for optimization
   */
  private generateParameterCombinations(parameters: Record<string, number[]>): Record<string, number>[] {
    const keys = Object.keys(parameters);
    const combinations: Record<string, number>[] = [];

    const generateCombinations = (index: number, current: Record<string, number>) => {
      if (index === keys.length) {
        combinations.push({ ...current });
        return;
      }

      const key = keys[index];
      const values = parameters[key];

      for (const value of values) {
        current[key] = value;
        generateCombinations(index + 1, current);
      }
    };

    generateCombinations(0, {});
    return combinations;
  }

  /**
   * Export results to CSV
   */
  exportResults(results: BacktestResult[]): string {
    try {
      let csv = 'Strategy,Total Return,Annualized Return,Sharpe Ratio,Win Rate,Total Trades,Max Drawdown\n';
      
      for (const result of results) {
        csv += `${result.strategy},${(result.totalReturn * 100).toFixed(2)}%,${(result.annualizedReturn * 100).toFixed(2)}%,${result.sharpeRatio.toFixed(3)},${(result.winRate * 100).toFixed(2)}%,${result.totalTrades},${(result.maxDrawdown * 100).toFixed(2)}%\n`;
      }
      
      return csv;
    } catch (error) {
      logger.error('Error exporting results:', error as Error);
      return '';
    }
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    await this.pool.end();
    logger.info('Backtester database connection closed');
  }
}