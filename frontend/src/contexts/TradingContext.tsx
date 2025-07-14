import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiService, TradingMetrics, Strategy, Signal } from '../services/api';
import { wsService, TradingUpdate, SignalUpdate } from '../services/websocket';

interface TradingContextType {
  // Trading metrics
  metrics: TradingMetrics | null;
  strategies: Strategy[];
  recentSignals: Signal[];
  systemStatus: any;
  
  // Real-time updates
  tradingUpdates: TradingUpdate[];
  signalUpdates: SignalUpdate[];
  
  // Loading states
  isLoadingMetrics: boolean;
  isLoadingStrategies: boolean;
  isLoadingSignals: boolean;
  
  // Actions
  refreshMetrics: () => Promise<void>;
  refreshStrategies: () => Promise<void>;
  refreshSignals: () => Promise<void>;
  refreshSystemStatus: () => Promise<void>;
  
  // WebSocket connection
  isWebSocketConnected: boolean;
}

const TradingContext = createContext<TradingContextType | undefined>(undefined);

interface TradingProviderProps {
  children: ReactNode;
}

export const TradingProvider: React.FC<TradingProviderProps> = ({ children }) => {
  // State
  const [metrics, setMetrics] = useState<TradingMetrics | null>(null);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [recentSignals, setRecentSignals] = useState<Signal[]>([]);
  const [systemStatus, setSystemStatus] = useState<any>(null);
  
  // Real-time updates
  const [tradingUpdates, setTradingUpdates] = useState<TradingUpdate[]>([]);
  const [signalUpdates, setSignalUpdates] = useState<SignalUpdate[]>([]);
  
  // Loading states
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(false);
  const [isLoadingStrategies, setIsLoadingStrategies] = useState(false);
  const [isLoadingSignals, setIsLoadingSignals] = useState(false);
  
  // WebSocket connection
  const [isWebSocketConnected, setIsWebSocketConnected] = useState(false);

  // Initialize WebSocket connection
  useEffect(() => {
    const handleConnectionChange = (connected: boolean) => {
      setIsWebSocketConnected(connected);
      
      if (connected) {
        // Subscribe to real-time updates
        wsService.subscribeToSignals();
        wsService.subscribeToTradingUpdates(['AAPL', 'GOOGL', 'MSFT', 'TSLA']); // Default symbols
      }
    };

    wsService.onConnect(handleConnectionChange);
    setIsWebSocketConnected(wsService.isConnected());

    return () => {
      wsService.offMessage('trading_update');
      wsService.offMessage('signal_update');
    };
  }, []);

  // Set up WebSocket message handlers
  useEffect(() => {
    const handleTradingUpdate = (update: TradingUpdate) => {
      setTradingUpdates(prev => {
        const newUpdates = [update, ...prev.slice(0, 49)]; // Keep last 50 updates
        return newUpdates;
      });
    };

    const handleSignalUpdate = (update: SignalUpdate) => {
      setSignalUpdates(prev => {
        const newUpdates = [update, ...prev.slice(0, 49)]; // Keep last 50 updates
        return newUpdates;
      });
      
      // Also update recent signals
      setRecentSignals(prev => {
        const newSignal: Signal = {
          id: update.id,
          symbol: update.symbol,
          type: update.type,
          strategy: update.strategy,
          price: update.price,
          timestamp: update.timestamp,
          confidence: update.confidence,
          status: 'pending'
        };
        return [newSignal, ...prev.slice(0, 9)]; // Keep last 10 signals
      });
    };

    wsService.onMessage('trading_update', handleTradingUpdate);
    wsService.onMessage('signal_update', handleSignalUpdate);

    return () => {
      wsService.offMessage('trading_update', handleTradingUpdate);
      wsService.offMessage('signal_update', handleSignalUpdate);
    };
  }, []);

  // Load initial data
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        await Promise.all([
          refreshMetrics(),
          refreshStrategies(),
          refreshSignals(),
          refreshSystemStatus()
        ]);
      } catch (error) {
        console.error('Failed to load initial trading data:', error);
      }
    };

    loadInitialData();
  }, []);

  // Auto-refresh metrics every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      refreshMetrics();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const refreshMetrics = async (): Promise<void> => {
    try {
      setIsLoadingMetrics(true);
      const data = await apiService.getTradingMetrics();
      setMetrics(data);
    } catch (error) {
      console.error('Failed to refresh metrics:', error);
    } finally {
      setIsLoadingMetrics(false);
    }
  };

  const refreshStrategies = async (): Promise<void> => {
    try {
      setIsLoadingStrategies(true);
      const data = await apiService.getStrategies();
      setStrategies(data);
    } catch (error) {
      console.error('Failed to refresh strategies:', error);
    } finally {
      setIsLoadingStrategies(false);
    }
  };

  const refreshSignals = async (): Promise<void> => {
    try {
      setIsLoadingSignals(true);
      const data = await apiService.getRecentSignals(10);
      setRecentSignals(data);
    } catch (error) {
      console.error('Failed to refresh signals:', error);
    } finally {
      setIsLoadingSignals(false);
    }
  };

  const refreshSystemStatus = async (): Promise<void> => {
    try {
      const data = await apiService.getSystemStatus();
      setSystemStatus(data);
    } catch (error) {
      console.error('Failed to refresh system status:', error);
    }
  };

  const value: TradingContextType = {
    metrics,
    strategies,
    recentSignals,
    systemStatus,
    tradingUpdates,
    signalUpdates,
    isLoadingMetrics,
    isLoadingStrategies,
    isLoadingSignals,
    refreshMetrics,
    refreshStrategies,
    refreshSignals,
    refreshSystemStatus,
    isWebSocketConnected,
  };

  return (
    <TradingContext.Provider value={value}>
      {children}
    </TradingContext.Provider>
  );
};

export const useTrading = (): TradingContextType => {
  const context = useContext(TradingContext);
  if (context === undefined) {
    throw new Error('useTrading must be used within a TradingProvider');
  }
  return context;
}; 