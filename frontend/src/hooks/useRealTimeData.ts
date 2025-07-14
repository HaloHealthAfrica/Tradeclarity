import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from 'react-query';
import { createModuleLogger } from '../../utils/logger';

const logger = createModuleLogger('useRealTimeData');

interface MarketData {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  timestamp: string;
}

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
  const queryClient = useQueryClient();

  // Fetch real-time data
  const fetchRealTimeData = useCallback(async () => {
    try {
      const response = await fetch('/api/market-data/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ symbols }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success) {
        const marketData = Object.values(result.data).map((item: any) => ({
          symbol: item.symbol,
          price: item.price,
          change: item.change,
          changePercent: item.changePercent,
          volume: item.volume,
          timestamp: item.timestamp,
        }));

        setData(marketData);
        setError(null);
        setIsConnected(true);
        setRetryCount(0);
      } else {
        throw new Error(result.error || 'Failed to fetch market data');
      }
    } catch (err) {
      logger.error('Error fetching real-time data:', err as Error);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setIsConnected(false);
      
      if (retryCount < maxRetries) {
        setRetryCount(prev => prev + 1);
        setTimeout(fetchRealTimeData, interval * 2);
      }
    }
  }, [symbols, interval, maxRetries, retryCount]);

  // Fetch historical data
  const fetchHistoricalData = useCallback(async (symbol: string) => {
    try {
      const response = await fetch(`/api/market-data/historical/${symbol}?interval=1d&limit=100`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success) {
        setHistoricalData(prev => ({
          ...prev,
          [symbol]: result.data,
        }));
      } else {
        throw new Error(result.error || 'Failed to fetch historical data');
      }
    } catch (err) {
      logger.error(`Error fetching historical data for ${symbol}:`, err as Error);
    }
  }, []);

  // WebSocket connection
  const connectWebSocket = useCallback(() => {
    if (!useWebSocket) return;

    try {
      const wsUrl = process.env.REACT_APP_WS_URL || 'ws://localhost:3001/ws';
      const ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        logger.info('WebSocket connected');
        setIsConnected(true);
        setError(null);
        setRetryCount(0);
        
        // Subscribe to symbols
        ws.send(JSON.stringify({
          type: 'subscribe',
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
          logger.error('Error parsing WebSocket message:', err as Error);
        }
      };

      ws.onclose = () => {
        logger.info('WebSocket disconnected');
        setIsConnected(false);
        
        if (autoReconnect && retryCount < maxRetries) {
          setTimeout(connectWebSocket, interval * 2);
          setRetryCount(prev => prev + 1);
        }
      };

      ws.onerror = (error) => {
        logger.error('WebSocket error:', error);
        setError('WebSocket connection error');
        setIsConnected(false);
      };

      wsRef.current = ws;
    } catch (err) {
      logger.error('Error creating WebSocket connection:', err as Error);
      setError('Failed to create WebSocket connection');
    }
  }, [useWebSocket, symbols, interval, autoReconnect, maxRetries, retryCount]);

  // Polling setup
  const startPolling = useCallback(() => {
    if (useWebSocket) return;

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    intervalRef.current = setInterval(fetchRealTimeData, interval);
  }, [useWebSocket, fetchRealTimeData, interval]);

  // Initial data fetch
  useEffect(() => {
    fetchRealTimeData();
    
    // Fetch historical data for each symbol
    symbols.forEach(symbol => {
      fetchHistoricalData(symbol);
    });
  }, [fetchRealTimeData, fetchHistoricalData, symbols]);

  // Start polling or WebSocket
  useEffect(() => {
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
  }, [useWebSocket, connectWebSocket, startPolling]);

  // Subscribe to new symbol
  const subscribe = useCallback((symbol: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'subscribe',
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
        type: 'unsubscribe',
        symbols: [symbol],
      }));
    }
  }, []);

  // Refetch function
  const refetch = useCallback(() => {
    setError(null);
    setRetryCount(0);
    fetchRealTimeData();
  }, [fetchRealTimeData]);

  return {
    data,
    historicalData,
    isLoading: !isConnected && retryCount === 0,
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