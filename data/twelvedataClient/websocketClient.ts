import WebSocket from 'ws';
import { Candle, DataError } from '../../types';
import { updateCache } from '../../cache/historicalCache';
import { streamRouter } from './streamRouter';
import { createModuleLogger } from '../../utils/logger';
import { systemConfig } from '../../config/systemConfig';

const logger = createModuleLogger('WebSocketClient');

interface WebSocketMessage {
  event: string;
  symbol?: string;
  interval?: string;
  [key: string]: any;
}

interface WebSocketConfig {
  url: string;
  symbols: string[];
  intervals: string[];
  reconnectInterval: number;
  maxReconnectAttempts: number;
}

class TwelveDataWebSocket {
  private ws: WebSocket | null = null;
  private config: WebSocketConfig;
  private reconnectAttempts = 0;
  private isConnected = false;
  private reconnectTimer: NodeJS.Timeout | null = null;

  constructor(config: WebSocketConfig) {
    this.config = config;
  }

  public connect(): void {
    try {
      logger.info('Connecting to TwelveData WebSocket', { url: this.config.url });
      
      this.ws = new WebSocket(this.config.url);
      
      this.ws.on('open', () => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        logger.info('WebSocket connected successfully');
        this.subscribe();
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        this.handleMessage(data);
      });

      this.ws.on('close', (code: number, reason: Buffer) => {
        this.isConnected = false;
        logger.warn('WebSocket connection closed', { code, reason: reason.toString() });
        this.scheduleReconnect();
      });

      this.ws.on('error', (error: Error) => {
        logger.error('WebSocket error', error);
        this.isConnected = false;
      });

    } catch (error) {
      logger.error('Failed to create WebSocket connection', error as Error);
      throw new DataError('Failed to create WebSocket connection', { config: this.config });
    }
  }

  private subscribe(): void {
    if (!this.ws || !this.isConnected) {
      logger.warn('Cannot subscribe - WebSocket not connected');
      return;
    }

    try {
      const subscribeMessage = {
        action: "subscribe",
        params: {
          symbols: this.config.symbols.join(','),
          intervals: this.config.intervals.join(',')
        }
      };

      this.ws.send(JSON.stringify(subscribeMessage));
      logger.info('Subscribed to symbols and intervals', { 
        symbols: this.config.symbols, 
        intervals: this.config.intervals 
      });
    } catch (error) {
      logger.error('Failed to subscribe to symbols', error as Error);
    }
  }

  private handleMessage(data: WebSocket.Data): void {
    try {
      const message: WebSocketMessage = JSON.parse(data.toString());
      
      if (message.event === 'price' && message.symbol && message.interval) {
        const candle: Candle = {
          symbol: message.symbol,
          interval: message.interval,
          timestamp: Date.now(),
          open: parseFloat(message.open || '0'),
          high: parseFloat(message.high || '0'),
          low: parseFloat(message.low || '0'),
          close: parseFloat(message.close || '0'),
          volume: parseFloat(message.volume || '0')
        };

        // Update cache
        updateCache(message.symbol, message.interval, candle);
        
        // Notify subscribers
        streamRouter.notify(message.symbol, message.interval, candle);
        
        logger.debug('Processed price update', { 
          symbol: message.symbol, 
          interval: message.interval,
          price: candle.close 
        });
      } else if (message.event === 'heartbeat') {
        logger.debug('Received heartbeat');
      } else {
        logger.debug('Received unknown message type', { event: message.event });
      }
    } catch (error) {
      logger.error('Failed to parse WebSocket message', error as Error, { data: data.toString() });
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      logger.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.config.reconnectInterval * Math.pow(2, this.reconnectAttempts - 1);
    
    logger.info(`Scheduling reconnection attempt ${this.reconnectAttempts} in ${delay}ms`);
    
    this.reconnectTimer = setTimeout(() => {
      logger.info('Attempting to reconnect...');
      this.connect();
    }, delay);
  }

  public disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.isConnected = false;
    logger.info('WebSocket disconnected');
  }

  public isConnectionActive(): boolean {
    return this.isConnected && this.ws?.readyState === WebSocket.OPEN;
  }
}

// Create and export WebSocket instance
const wsConfig: WebSocketConfig = {
  url: systemConfig.twelveData.websocketUrl,
  symbols: systemConfig.twelveData.symbols,
  intervals: systemConfig.twelveData.intervals,
  reconnectInterval: 5000,
  maxReconnectAttempts: 10
};

export const webSocketClient = new TwelveDataWebSocket(wsConfig);

export const startWebSocket = (): void => {
  webSocketClient.connect();
};

export const stopWebSocket = (): void => {
  webSocketClient.disconnect();
};
