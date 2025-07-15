import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

// API Configuration
const API_CONFIG = {
  BASE_URL: process.env.REACT_APP_API_URL || 'http://localhost:3001',
  WS_URL: process.env.REACT_APP_WS_URL || 'ws://localhost:3001/ws',
  TIMEOUT: 10000,
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000,
};

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Market Data Types
export interface MarketData {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  timestamp: string;
}

export interface ScannerResult {
  symbol: string;
  pattern: string;
  confidence: number;
  price: number;
  volume: number;
  timestamp: string;
  indicators: {
    rsi: number;
    macd: number;
    ema: number;
  };
}

export interface DashboardData {
  metrics: {
    totalValue: number;
    dailyPnL: number;
    totalPnL: number;
    activePositions: number;
  };
  portfolio: Array<{
    symbol: string;
    quantity: number;
    avgPrice: number;
    currentPrice: number;
    pnl: number;
    pnlPercent: number;
  }>;
  systemStatus: {
    scanner: boolean;
    strategies: boolean;
    marketData: boolean;
  };
}

export interface ScannerStatus {
  isRunning: boolean;
  activeSymbols: string[];
  lastScan: string;
}

export interface Strategy {
  id: string;
  name: string;
  status: 'active' | 'inactive' | 'error';
  performance: {
    totalPnL: number;
    winRate: number;
    totalTrades: number;
  };
  lastSignal?: Signal;
}

export interface Signal {
  id: string;
  symbol: string;
  type: 'BUY' | 'SELL';
  strategy: string;
  price: number;
  timestamp: string;
  confidence: number;
  status: 'pending' | 'executed' | 'cancelled';
}

// API Service Class
class ApiService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: API_CONFIG.BASE_URL,
      timeout: API_CONFIG.TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor
    this.api.interceptors.request.use(
      (config) => {
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor
    this.api.interceptors.response.use(
      (response) => response,
      async (error) => {
        console.error('API Error:', error);
        return Promise.reject(error);
      }
    );
  }

  // Health Check
  async getHealth(): Promise<any> {
    const response = await this.api.get('/api/health');
    return response.data;
  }

  // Dashboard Methods
  async getDashboard(): Promise<DashboardData> {
    const response = await this.api.get('/api/dashboard');
    return response.data;
  }

  // Market Data Methods
  async getMarketQuote(symbol: string): Promise<MarketData> {
    const response = await this.api.get(`/api/market-data/quote/${symbol}`);
    return response.data;
  }

  async getMarketQuotes(symbols: string[]): Promise<MarketData[]> {
    const symbolsParam = symbols.join(',');
    const response = await this.api.get(`/api/market-data/quotes?symbols=${symbolsParam}`);
    return response.data.quotes;
  }

  // Scanner Methods
  async getScannerResults(filters?: {
    pattern?: string;
    confidence?: number;
    symbol?: string;
  }): Promise<ScannerResult[]> {
    const params = new URLSearchParams();
    if (filters?.pattern) params.append('pattern', filters.pattern);
    if (filters?.confidence) params.append('confidence', filters.confidence.toString());
    if (filters?.symbol) params.append('symbol', filters.symbol);

    const response = await this.api.get(`/api/scanner/results?${params.toString()}`);
    return response.data.results;
  }

  async startScanner(symbols: string[]): Promise<void> {
    await this.api.post('/api/scanner/start', { symbols });
  }

  async stopScanner(): Promise<void> {
    await this.api.post('/api/scanner/stop');
  }

  async getScannerStatus(): Promise<ScannerStatus> {
    const response = await this.api.get('/api/scanner/status');
    return response.data;
  }

  // Trading Methods
  async getStrategies(): Promise<Strategy[]> {
    const response = await this.api.get('/api/trading/strategies');
    return response.data.strategies;
  }

  async getSignals(limit: number = 10): Promise<Signal[]> {
    const response = await this.api.get(`/api/trading/signals?limit=${limit}`);
    return response.data.signals;
  }

  async getTradingMetrics(): Promise<any> {
    const response = await this.api.get('/api/trading/metrics');
    return response.data;
  }

  // Analysis Methods
  async getAnalysisMetrics(): Promise<any> {
    const response = await this.api.get('/api/analysis/metrics');
    return response.data;
  }

  async getRecentTrades(): Promise<any> {
    const response = await this.api.get('/api/analysis/trades');
    return response.data;
  }

  async getAnalysisPerformance(): Promise<any> {
    const response = await this.api.get('/api/analysis/performance');
    return response.data;
  }

  async getStrategyDetails(strategyName: string): Promise<any> {
    const response = await this.api.get(`/api/analysis/strategy/${encodeURIComponent(strategyName)}`);
    return response.data;
  }

  // Portfolio Methods
  async getPortfolio(): Promise<any> {
    const response = await this.api.get('/api/portfolio');
    return response.data;
  }

  // Watchlist Methods
  async getWatchlist(): Promise<string[]> {
    const response = await this.api.get('/api/watchlist');
    return response.data;
  }

  async addToWatchlist(symbol: string): Promise<void> {
    await this.api.post('/api/watchlist', { symbol });
  }

  async removeFromWatchlist(symbol: string): Promise<void> {
    await this.api.delete(`/api/watchlist/${symbol}`);
  }

  // System Status
  async getSystemStatus(): Promise<any> {
    const response = await this.api.get('/api/status');
    return response.data;
  }

  // Backtest Methods
  async runBacktest(config: any): Promise<any> {
    const response = await this.api.post('/api/backtest/run', config);
    return response.data;
  }

  // Historical Data Methods
  async downloadHistoricalData(symbol: string, startDate: string, endDate: string, interval: string = '1day'): Promise<any> {
    const response = await this.api.post('/api/historical/download', {
      symbol,
      startDate,
      endDate,
      interval,
    });
    return response.data;
  }

  async getHistoricalMetadata(): Promise<any> {
    const response = await this.api.get('/api/historical/metadata');
    return response.data;
  }

  async getHistoricalData(symbol: string, interval: string): Promise<any> {
    const response = await this.api.get(`/api/historical/data/${symbol}/${interval}`);
    return response.data;
  }

  async deleteHistoricalData(symbol: string, interval: string): Promise<void> {
    await this.api.delete(`/api/historical/data/${symbol}/${interval}`);
  }

  async getAvailableStrategies(): Promise<string[]> {
    const response = await this.api.get('/api/trading/strategies');
    return response.data.strategies.map((s: any) => s.name);
  }

  // Generic HTTP methods
  async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.api.get(url, config);
  }

  async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.api.post(url, data, config);
  }

  async put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.api.put(url, data, config);
  }

  async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.api.delete(url, config);
  }

  private handleError(error: any): never {
    console.error('API Error:', error);
    throw new Error(error.response?.data?.error || error.message || 'Unknown error occurred');
  }
}

// Export singleton instance
export const api = new ApiService(); 