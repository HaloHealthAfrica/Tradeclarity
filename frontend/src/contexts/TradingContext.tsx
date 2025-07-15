import React, { createContext, useContext, useState, useEffect } from 'react';

interface TradingState {
  isConnected: boolean;
  isTrading: boolean;
  positions: any[];
  orders: any[];
  balance: number;
  pnl: number;
}

interface TradingContextType {
  tradingState: TradingState;
  connect: () => Promise<void>;
  disconnect: () => void;
  startTrading: () => Promise<void>;
  stopTrading: () => void;
  placeOrder: (order: any) => Promise<void>;
  cancelOrder: (orderId: string) => Promise<void>;
}

const TradingContext = createContext<TradingContextType | undefined>(undefined);

export const useTrading = () => {
  const context = useContext(TradingContext);
  if (context === undefined) {
    throw new Error('useTrading must be used within a TradingProvider');
  }
  return context;
};

interface TradingProviderProps {
  children: React.ReactNode;
}

export const TradingProvider: React.FC<TradingProviderProps> = ({ children }) => {
  const [tradingState, setTradingState] = useState<TradingState>({
    isConnected: false,
    isTrading: false,
    positions: [],
    orders: [],
    balance: 100000,
    pnl: 0
  });

  const connect = async () => {
    try {
      // Simulate connection
      await new Promise(resolve => setTimeout(resolve, 1000));
      setTradingState(prev => ({ ...prev, isConnected: true }));
    } catch (error) {
      console.error('Failed to connect:', error);
      throw error;
    }
  };

  const disconnect = () => {
    setTradingState(prev => ({ 
      ...prev, 
      isConnected: false,
      isTrading: false 
    }));
  };

  const startTrading = async () => {
    try {
      // Simulate starting trading
      await new Promise(resolve => setTimeout(resolve, 500));
      setTradingState(prev => ({ ...prev, isTrading: true }));
    } catch (error) {
      console.error('Failed to start trading:', error);
      throw error;
    }
  };

  const stopTrading = () => {
    setTradingState(prev => ({ ...prev, isTrading: false }));
  };

  const placeOrder = async (order: any) => {
    try {
      // Simulate placing order
      await new Promise(resolve => setTimeout(resolve, 500));
      setTradingState(prev => ({
        ...prev,
        orders: [...prev.orders, { ...order, id: Date.now().toString() }]
      }));
    } catch (error) {
      console.error('Failed to place order:', error);
      throw error;
    }
  };

  const cancelOrder = async (orderId: string) => {
    try {
      // Simulate canceling order
      await new Promise(resolve => setTimeout(resolve, 300));
      setTradingState(prev => ({
        ...prev,
        orders: prev.orders.filter(order => order.id !== orderId)
      }));
    } catch (error) {
      console.error('Failed to cancel order:', error);
      throw error;
    }
  };

  const value: TradingContextType = {
    tradingState,
    connect,
    disconnect,
    startTrading,
    stopTrading,
    placeOrder,
    cancelOrder
  };

  return (
    <TradingContext.Provider value={value}>
      {children}
    </TradingContext.Provider>
  );
}; 