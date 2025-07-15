// WebSocket Service for Real-time Data
export interface WebSocketMessage {
  type: string;
  data: any;
  timestamp: string;
}

export interface TradingUpdate {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  timestamp: string;
}

export interface SignalUpdate {
  id: string;
  symbol: string;
  type: 'BUY' | 'SELL';
  strategy: string;
  price: number;
  confidence: number;
  timestamp: string;
}

export interface ScannerUpdate {
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

export interface SystemNotification {
  level: 'info' | 'warning' | 'error' | 'success';
  message: string;
  title?: string;
  timestamp: string;
}

class WebSocketService {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private isConnecting = false;
  private messageHandlers: Map<string, ((data: any) => void)[]> = new Map();
  private connectionHandlers: ((connected: boolean) => void)[] = [];

  constructor() {
    // Don't auto-connect, let components manage connection
  }

  private getWebSocketUrl(): string {
    return process.env.REACT_APP_WS_URL || 'ws://localhost:3001/ws';
  }

  public connect(): void {
    if (this.isConnecting || this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    this.isConnecting = true;
    const url = this.getWebSocketUrl();

    try {
      this.ws = new WebSocket(url);
      this.setupEventHandlers();
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      this.handleConnectionError();
    }
  }

  private setupEventHandlers(): void {
    if (!this.ws) return;

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.isConnecting = false;
      this.reconnectAttempts = 0;
      this.notifyConnectionChange(true);
    };

    this.ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        this.handleMessage(message);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    this.ws.onclose = (event) => {
      console.log('WebSocket disconnected:', event.code, event.reason);
      this.isConnecting = false;
      this.notifyConnectionChange(false);
      
      if (!event.wasClean) {
        this.handleConnectionError();
      }
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.handleConnectionError();
    };
  }

  private handleConnectionError(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
      
      console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      
      setTimeout(() => {
        this.connect();
      }, delay);
    } else {
      console.error('Max reconnection attempts reached');
    }
  }

  private handleMessage(message: WebSocketMessage): void {
    const handlers = this.messageHandlers.get(message.type);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(message.data);
        } catch (error) {
          console.error(`Error in message handler for type ${message.type}:`, error);
        }
      });
    }
  }

  private send(message: WebSocketMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket is not connected, cannot send message');
    }
  }

  private notifyConnectionChange(connected: boolean): void {
    this.connectionHandlers.forEach(handler => {
      try {
        handler(connected);
      } catch (error) {
        console.error('Error in connection handler:', error);
      }
    });
  }

  // Public API
  public isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  public onConnect(handler: (connected: boolean) => void): void {
    this.connectionHandlers.push(handler);
  }

  public onMessage<T = any>(type: string, handler: (data: T) => void): void {
    if (!this.messageHandlers.has(type)) {
      this.messageHandlers.set(type, []);
    }
    this.messageHandlers.get(type)!.push(handler);
  }

  public offMessage(type: string, handler?: (data: any) => void): void {
    if (!handler) {
      this.messageHandlers.delete(type);
    } else {
      const handlers = this.messageHandlers.get(type);
      if (handlers) {
        const index = handlers.indexOf(handler);
        if (index > -1) {
          handlers.splice(index, 1);
        }
      }
    }
  }

  public subscribeToMarketData(symbols: string[]): void {
    this.send({
      type: 'subscribe_market_data',
      data: { symbols },
      timestamp: new Date().toISOString()
    });
  }

  public unsubscribeFromMarketData(symbols: string[]): void {
    this.send({
      type: 'unsubscribe_market_data',
      data: { symbols },
      timestamp: new Date().toISOString()
    });
  }

  public subscribeToSignals(): void {
    this.send({
      type: 'subscribe_signals',
      data: {},
      timestamp: new Date().toISOString()
    });
  }

  public unsubscribeFromSignals(): void {
    this.send({
      type: 'unsubscribe_signals',
      data: {},
      timestamp: new Date().toISOString()
    });
  }

  public subscribeToScanner(): void {
    this.send({
      type: 'subscribe_scanner',
      data: {},
      timestamp: new Date().toISOString()
    });
  }

  public unsubscribeFromScanner(): void {
    this.send({
      type: 'unsubscribe_scanner',
      data: {},
      timestamp: new Date().toISOString()
    });
  }

  public subscribeToNotifications(): void {
    this.send({
      type: 'subscribe_notifications',
      data: {},
      timestamp: new Date().toISOString()
    });
  }

  public unsubscribeFromNotifications(): void {
    this.send({
      type: 'unsubscribe_notifications',
      data: {},
      timestamp: new Date().toISOString()
    });
  }

  public disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

// Export singleton instance
export const websocket = new WebSocketService(); 