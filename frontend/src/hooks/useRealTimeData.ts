import { useState, useEffect, useCallback, useRef } from 'react';
import { api, MarketData } from '../services/api';

interface HistoricalData {
  symbol: string;
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  interval: string;
}

interface RealTimeDataOptions {
  symbols: string[];
  interval?: number; // Polling interval in milliseconds
  useWebSocket?: boolean;
  autoReconnect?: boolean;
  maxRetries?: number;
}

interface UseRealTimeDataReturn {
  data: MarketData[];
  historicalData: Record<string, HistoricalData[]>;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
  subscribe: (symbol: string) => void;
  unsubscribe: (symbol: string) => void;
  isConnected: boolean;
}

export const useRealTimeData = (options: RealTimeDataOptions): UseRealTimeDataReturn => {
  const {
    symbols,
    interval = 5000,
    useWebSocket = false,
    autoReconnect = true,
    maxRetries = 3,
  } = options;

  const [data, setData] = useState<MarketData[]>([]);
  const [historicalData, setHistoricalData] = useState<Record<string, HistoricalData[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  
  const wsRef = useRef<WebSocket | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  // Fetch real-time data from API
  const fetchRealTimeData = useCallback(async () => {
    if (!mountedRef.current) return;

    try {
      const marketData = await api.getMarketQuotes(symbols);
      setData(marketData);
      setError(null);
      setIsConnected(true);
      setRetryCount(0);
    } catch (err) {
      console.error('Error fetching real-time data:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setIsConnected(false);
      
      if (retryCount < maxRetries) {
        setRetryCount(prev => prev + 1);
        setTimeout(fetchRealTimeData, interval * 2);
      }
    }
  }, [symbols, interval, maxRetries, retryCount]);

  // Fetch historical data for a symbol
  const fetchHistoricalData = useCallback(async (symbol: string) => {
    if (!mountedRef.current) return;

    try {
      // For now, we'll use mock historical data since the backend doesn't have historical endpoints yet
      const mockHistoricalData: HistoricalData[] = Array.from({ length: 30 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - (29 - i));
        const basePrice = 100 + Math.random() * 50;
        const open = basePrice + (Math.random() - 0.5) * 10;
        const close = open + (Math.random() - 0.5) * 8;
        const high = Math.max(open, close) + Math.random() * 5;
        const low = Math.min(open, close) - Math.random() * 5;
        
        return {
          symbol,
          timestamp: date.toISOString(),
          open,
          high,
          low,
          close,
          volume: Math.floor(Math.random() * 1000000) + 100000,
          interval: '1d'
        };
      });

      setHistoricalData(prev => ({
        ...prev,
        [symbol]: mockHistoricalData,
      }));
    } catch (err) {
      console.error(`Error fetching historical data for ${symbol}:`, err);
    }
  }, []);

  // WebSocket connection for real-time updates
  const connectWebSocket = useCallback(() => {
    if (!useWebSocket) return;

    try {
      const wsUrl = process.env.REACT_APP_WS_URL || 'ws://localhost:3001/ws';
      const ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        console.log('WebSocket connected for real-time data');
        setIsConnected(true);
        setError(null);
        setRetryCount(0);
        
        // Subscribe to symbols
        ws.send(JSON.stringify({
          type: 'subscribe_market_data',
          symbols,
        }));
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          if (message.type === 'market_data') {
            setData(prev => {
              const newData = [...prev];
              const index = newData.findIndex(item => item.symbol === message.data.symbol);
              
              if (index >= 0) {
                newData[index] = message.data;
              } else {
                newData.push(message.data);
              }
              
              return newData;
            });
          }
        } catch (err) {
          console.error('Error parsing WebSocket message:', err);
        }
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected');
        setIsConnected(false);
        
        if (autoReconnect && retryCount < maxRetries && mountedRef.current) {
          setTimeout(connectWebSocket, interval * 2);
          setRetryCount(prev => prev + 1);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setError('WebSocket connection error');
        setIsConnected(false);
      };

      wsRef.current = ws;
    } catch (err) {
      console.error('Error creating WebSocket connection:', err);
      setError('Failed to create WebSocket connection');
    }
  }, [useWebSocket, symbols, interval, autoReconnect, maxRetries, retryCount]);

  // Polling setup for API-based updates
  const startPolling = useCallback(() => {
    if (useWebSocket) return;

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    intervalRef.current = setInterval(fetchRealTimeData, interval);
  }, [useWebSocket, fetchRealTimeData, interval]);

  // Initial data fetch
  useEffect(() => {
    if (symbols.length > 0) {
      fetchRealTimeData();
      
      // Fetch historical data for each symbol
      symbols.forEach(symbol => {
        fetchHistoricalData(symbol);
      });
    }
  }, [fetchRealTimeData, fetchHistoricalData, symbols]);

  // Start polling or WebSocket
  useEffect(() => {
    if (symbols.length === 0) return;

    if (useWebSocket) {
      connectWebSocket();
    } else {
      startPolling();
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [useWebSocket, connectWebSocket, startPolling, symbols]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Subscribe to new symbol
  const subscribe = useCallback((symbol: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'subscribe_market_data',
        symbols: [symbol],
      }));
    }
    
    // Fetch historical data for new symbol
    fetchHistoricalData(symbol);
  }, [fetchHistoricalData]);

  // Unsubscribe from symbol
  const unsubscribe = useCallback((symbol: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'unsubscribe_market_data',
        symbols: [symbol],
      }));
    }
  }, []);

  // Manual refetch
  const refetch = useCallback(() => {
    fetchRealTimeData();
  }, [fetchRealTimeData]);

  return {
    data,
    historicalData,
    isLoading: data.length === 0 && !error,
    error,
    refetch,
    subscribe,
    unsubscribe,
    isConnected,
  };
};

// Hook for single symbol data
export const useSymbolData = (symbol: string, options?: Partial<RealTimeDataOptions>) => {
  const realTimeData = useRealTimeData({
    symbols: [symbol],
    ...options,
  });

  return {
    ...realTimeData,
    data: realTimeData.data[0] || null,
    historicalData: realTimeData.historicalData[symbol] || [],
  };
};

// Hook for portfolio data
export const usePortfolioData = (portfolio: string[], options?: Partial<RealTimeDataOptions>) => {
  return useRealTimeData({
    symbols: portfolio,
    ...options,
  });
}; 