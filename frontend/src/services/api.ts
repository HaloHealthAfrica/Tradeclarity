import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

// API Configuration
const API_CONFIG = {
  BASE_URL: process.env.REACT_APP_API_URL || 'http://localhost/api',
  WS_URL: process.env.REACT_APP_WS_URL || 'ws://localhost/ws',
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

// Authentication Types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    createdAt: string;
  };
  token: string;
  refreshToken: string;
}

// Trading Types
export interface TradingMetrics {
  totalPnL: number;
  dailyPnL: number;
  openPositions: number;
  activeStrategies: number;
  winRate: number;
  maxDrawdown: number;
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

// API Service Class
class ApiService {
  private api: AxiosInstance;
  private token: string | null = null;

  constructor() {
    this.api = axios.create({
      baseURL: API_CONFIG.BASE_URL,
      timeout: API_CONFIG.TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
    this.loadToken();
  }

  private setupInterceptors(): void {
    // Request interceptor
    this.api.interceptors.request.use(
      (config) => {
        if (this.token) {
          config.headers.Authorization = `Bearer ${this.token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor
    this.api.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401) {
          // Token expired, try to refresh
          const refreshed = await this.refreshToken();
          if (refreshed && error.config) {
            return this.api.request(error.config);
          }
        }
        return Promise.reject(error);
      }
    );
  }

  private loadToken(): void {
    this.token = localStorage.getItem('auth_token');
  }

  private saveToken(token: string): void {
    this.token = token;
    localStorage.setItem('auth_token', token);
  }

  private clearToken(): void {
    this.token = null;
    localStorage.removeItem('auth_token');
  }

  private async refreshToken(): Promise<boolean> {
    try {
      const refreshToken = localStorage.getItem('refresh_token');
      if (!refreshToken) return false;

      const response = await this.api.post<ApiResponse<AuthResponse>>('/auth/refresh', {
        refreshToken,
      });

      if (response.data.success && response.data.data) {
        this.saveToken(response.data.data.token);
        localStorage.setItem('refresh_token', response.data.data.refreshToken);
        return true;
      }
      return false;
    } catch (error) {
      this.clearToken();
      return false;
    }
  }

  // Authentication Methods
  async login(credentials: LoginRequest): Promise<AuthResponse> {
    const response = await this.api.post<ApiResponse<AuthResponse>>('/auth/login', credentials);
    
    if (response.data.success && response.data.data) {
      this.saveToken(response.data.data.token);
      localStorage.setItem('refresh_token', response.data.data.refreshToken);
      return response.data.data;
    }
    
    throw new Error(response.data.error || 'Login failed');
  }

  async register(userData: RegisterRequest): Promise<AuthResponse> {
    const response = await this.api.post<ApiResponse<AuthResponse>>('/auth/register', userData);
    
    if (response.data.success && response.data.data) {
      this.saveToken(response.data.data.token);
      localStorage.setItem('refresh_token', response.data.data.refreshToken);
      return response.data.data;
    }
    
    throw new Error(response.data.error || 'Registration failed');
  }

  async logout(): Promise<void> {
    try {
      await this.api.post('/auth/logout');
    } catch (error) {
      // Ignore logout errors
    } finally {
      this.clearToken();
    }
  }

  async getCurrentUser(): Promise<AuthResponse['user']> {
    const response = await this.api.get<ApiResponse<AuthResponse['user']>>('/auth/me');
    
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    
    throw new Error(response.data.error || 'Failed to get user info');
  }

  // Trading Dashboard Methods
  async getTradingMetrics(): Promise<TradingMetrics> {
    const response = await this.api.get<ApiResponse<TradingMetrics>>('/trading/metrics');
    
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    
    throw new Error(response.data.error || 'Failed to get trading metrics');
  }

  async getStrategies(): Promise<Strategy[]> {
    const response = await this.api.get<ApiResponse<Strategy[]>>('/trading/strategies');
    
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    
    throw new Error(response.data.error || 'Failed to get strategies');
  }

  async getRecentSignals(limit: number = 10): Promise<Signal[]> {
    const response = await this.api.get<ApiResponse<Signal[]>>(`/trading/signals?limit=${limit}`);
    
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    
    throw new Error(response.data.error || 'Failed to get recent signals');
  }

  async getSystemStatus(): Promise<any> {
    const response = await this.api.get<ApiResponse<any>>('/system/status');
    
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    
    throw new Error(response.data.error || 'Failed to get system status');
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

    const response = await this.api.get<ApiResponse<ScannerResult[]>>(`/scanner/results?${params}`);
    
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    
    throw new Error(response.data.error || 'Failed to get scanner results');
  }

  async startScanner(symbols: string[]): Promise<void> {
    const response = await this.api.post<ApiResponse<void>>('/scanner/start', { symbols });
    
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to start scanner');
    }
  }

  async stopScanner(): Promise<void> {
    const response = await this.api.post<ApiResponse<void>>('/scanner/stop');
    
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to stop scanner');
    }
  }

  async getScannerStatus(): Promise<{
    isRunning: boolean;
    activeSymbols: string[];
    lastScan: string;
  }> {
    const response = await this.api.get<ApiResponse<any>>('/scanner/status');
    
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    
    throw new Error(response.data.error || 'Failed to get scanner status');
  }

  // Watchlist Methods
  async getWatchlist(): Promise<string[]> {
    const response = await this.api.get<ApiResponse<string[]>>('/watchlist');
    
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    
    throw new Error(response.data.error || 'Failed to get watchlist');
  }

  async addToWatchlist(symbol: string): Promise<void> {
    const response = await this.api.post<ApiResponse<void>>('/watchlist', { symbol });
    
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to add to watchlist');
    }
  }

  async removeFromWatchlist(symbol: string): Promise<void> {
    const response = await this.api.delete<ApiResponse<void>>(`/watchlist/${symbol}`);
    
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to remove from watchlist');
    }
  }

  // Portfolio Methods
  async getPortfolio(): Promise<any> {
    const response = await this.api.get<ApiResponse<any>>('/portfolio');
    
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    
    throw new Error(response.data.error || 'Failed to get portfolio');
  }

  // Error handling utility
  private handleError(error: any): never {
    if (error.response?.data?.error) {
      throw new Error(error.response.data.error);
    }
    if (error.message) {
      throw new Error(error.message);
    }
    throw new Error('An unexpected error occurred');
  }
}

// Export singleton instance
export const apiService = new ApiService();

// Export types for use in components
export type {
  ApiResponse,
  PaginatedResponse,
  LoginRequest,
  RegisterRequest,
  AuthResponse,
  TradingMetrics,
  Strategy,
  Signal,
  ScannerResult,
}; 