import { apiClient } from './apiClient';

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
  trades: any[];
  equityCurve: any[];
  monthlyReturns: any[];
  riskMetrics: {
    volatility: number;
    beta: number;
    alpha: number;
    sortinoRatio: number;
    calmarRatio: number;
  };
}

export interface OptimizationConfig {
  strategy: string;
  symbols: string[];
  startDate: string;
  endDate: string;
  initialCapital: number;
  parameters: Record<string, number[]>;
  optimizationMethod: 'grid' | 'genetic' | 'bayesian';
  fitnessMetric: 'sharpe' | 'returns' | 'calmar' | 'custom';
  maxIterations: number;
  populationSize?: number;
  mutationRate?: number;
  crossoverRate?: number;
}

export interface OptimizationResult {
  strategy: string;
  bestParameters: Record<string, number>;
  bestResult: BacktestResult;
  optimizationHistory: any[];
  statistics: {
    totalIterations: number;
    bestFitness: number;
    averageFitness: number;
    convergenceRate: number;
    executionTime: number;
  };
}

export interface MarketDataQuery {
  symbol: string;
  startDate: string;
  endDate: string;
  interval?: string;
  limit?: number;
}

export interface MarketDataStats {
  symbol: string;
  totalRecords: number;
  dateRange: {
    start: string;
    end: string;
  };
  intervals: string[];
  lastUpdated: string;
  dataQuality: {
    completeness: number;
    accuracy: number;
    gaps: number;
  };
}

export class AnalysisService {
  private baseUrl = '/eod';

  /**
   * Run backtest
   */
  async runBacktest(config: BacktestConfig): Promise<BacktestResult> {
    try {
      const response = await apiClient.post(`${this.baseUrl}/backtest/run`, config);
      return response.data.result;
    } catch (error) {
      console.error('Error running backtest:', error);
      throw error;
    }
  }

  /**
   * Compare multiple strategies in backtest
   */
  async compareStrategies(strategies: string[], config: Omit<BacktestConfig, 'strategy'>): Promise<BacktestResult[]> {
    try {
      const response = await apiClient.post(`${this.baseUrl}/backtest/compare`, {
        strategies,
        config
      });
      return response.data.results;
    } catch (error) {
      console.error('Error comparing strategies:', error);
      throw error;
    }
  }

  /**
   * Optimize strategy parameters
   */
  async optimizeStrategy(strategy: string, config: Omit<BacktestConfig, 'strategy'>, parameters: Record<string, number[]>): Promise<{ bestParams: Record<string, number>; bestResult: BacktestResult }> {
    try {
      const response = await apiClient.post(`${this.baseUrl}/backtest/optimize`, {
        strategy,
        config,
        parameters
      });
      return response.data.result;
    } catch (error) {
      console.error('Error optimizing strategy:', error);
      throw error;
    }
  }

  /**
   * Run algorithm optimization
   */
  async runOptimization(config: OptimizationConfig): Promise<OptimizationResult> {
    try {
      const response = await apiClient.post(`${this.baseUrl}/optimize/run`, config);
      return response.data.result;
    } catch (error) {
      console.error('Error running optimization:', error);
      throw error;
    }
  }

  /**
   * Compare multiple optimization runs
   */
  async compareOptimizations(configs: OptimizationConfig[]): Promise<{ config: OptimizationConfig; result: OptimizationResult }[]> {
    try {
      const response = await apiClient.post(`${this.baseUrl}/optimize/compare`, { configs });
      return response.data.results;
    } catch (error) {
      console.error('Error comparing optimizations:', error);
      throw error;
    }
  }

  /**
   * Get optimization history
   */
  async getOptimizationHistory(): Promise<any[]> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/optimize/history`);
      return response.data.history;
    } catch (error) {
      console.error('Error getting optimization history:', error);
      throw error;
    }
  }

  /**
   * Store market data
   */
  async storeMarketData(data: any[]): Promise<void> {
    try {
      await apiClient.post(`${this.baseUrl}/market-data/store`, { data });
    } catch (error) {
      console.error('Error storing market data:', error);
      throw error;
    }
  }

  /**
   * Retrieve market data
   */
  async getMarketData(query: MarketDataQuery): Promise<any[]> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/market-data/retrieve`, {
        params: query
      });
      return response.data.data;
    } catch (error) {
      console.error('Error retrieving market data:', error);
      throw error;
    }
  }

  /**
   * Get market data statistics
   */
  async getMarketDataStats(symbol: string): Promise<MarketDataStats> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/market-data/stats/${symbol}`);
      return response.data.stats;
    } catch (error) {
      console.error('Error getting market data stats:', error);
      throw error;
    }
  }

  /**
   * Get data quality report
   */
  async getDataQualityReport(symbol: string): Promise<{
    symbol: string;
    completeness: number;
    accuracy: number;
    gaps: string[];
    recommendations: string[];
  }> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/market-data/quality/${symbol}`);
      return response.data.report;
    } catch (error) {
      console.error('Error getting data quality report:', error);
      throw error;
    }
  }

  /**
   * Export market data
   */
  async exportMarketData(query: MarketDataQuery, format: 'json' | 'csv' = 'json'): Promise<string> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/market-data/export`, {
        params: { query, format }
      });
      return response.data;
    } catch (error) {
      console.error('Error exporting market data:', error);
      throw error;
    }
  }

  /**
   * Generate EOD report with backtest
   */
  async generateEODReport(date: string, symbols: string[], includeBacktest = false, backtestConfig?: BacktestConfig): Promise<any> {
    try {
      const response = await apiClient.post(`${this.baseUrl}/reports/generate`, {
        date,
        symbols,
        includeBacktest,
        backtestConfig
      });
      return response.data.report;
    } catch (error) {
      console.error('Error generating EOD report:', error);
      throw error;
    }
  }

  /**
   * Get EOD report by date
   */
  async getEODReport(date: string, symbols?: string[]): Promise<any> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/reports/${date}`, {
        params: { symbols }
      });
      return response.data.report;
    } catch (error) {
      console.error('Error getting EOD report:', error);
      throw error;
    }
  }

  /**
   * Get performance summary
   */
  async getPerformanceSummary(startDate: string, endDate: string, symbols?: string[]): Promise<any> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/performance/summary`, {
        params: { startDate, endDate, symbols }
      });
      return response.data.summary;
    } catch (error) {
      console.error('Error getting performance summary:', error);
      throw error;
    }
  }

  /**
   * Compare strategy performance
   */
  async compareStrategyPerformance(strategies: string[], startDate: string, endDate: string, symbols?: string[]): Promise<any> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/performance/compare`, {
        params: { strategies, startDate, endDate, symbols }
      });
      return response.data.comparison;
    } catch (error) {
      console.error('Error comparing strategy performance:', error);
      throw error;
    }
  }

  /**
   * Export analysis data
   */
  async exportAnalysisData(format: 'json' | 'csv' | 'pdf', startDate: string, endDate: string, symbols?: string[], reportType?: string): Promise<string> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/export/${format}`, {
        params: { startDate, endDate, symbols, reportType }
      });
      return response.data;
    } catch (error) {
      console.error('Error exporting analysis data:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const analysisService = new AnalysisService(); 