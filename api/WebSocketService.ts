import WebSocket from 'ws';
import { createModuleLogger } from '../utils/logger';
import { Pool } from 'pg';
import { NotificationService } from './NotificationService';

const logger = createModuleLogger('WebSocketService');

export interface WebSocketMessage {
  type: 'signal' | 'trade' | 'performance' | 'market_data' | 'notification' | 'error';
  data: any;
  timestamp: number;
}

export interface SignalUpdate {
  id: string;
  symbol: string;
  direction: 'LONG' | 'SHORT';
  confidence: number;
  strategy: string;
  status: 'pending' | 'executed' | 'cancelled';
  pnl?: number;
  timestamp: number;
}

export interface TradeUpdate {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  status: 'pending' | 'filled' | 'cancelled';
  timestamp: number;
}

export interface PerformanceUpdate {
  totalPnL: number;
  realizedPnL: number;
  unrealizedPnL: number;
  totalTrades: number;
  winRate: number;
  activePositions: number;
  timestamp: number;
}

export interface MarketDataUpdate {
  symbol: string;
  price: number;
  change: number;
  volume: number;
  timestamp: number;
}

export class WebSocketService {
  private wss: WebSocket.Server | null = null;
  private clients: Set<WebSocket> = new Set();
  private pool: Pool;
  private notificationService: NotificationService;
  private updateInterval: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor() {
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

    this.notificationService = new NotificationService();
    
    logger.info('WebSocketService initialized with database connection');
  }

  /**
   * Start WebSocket server
   */
  start(port: number = 8080): void {
    try {
      this.wss = new WebSocket.Server({ port });
      
      this.wss.on('connection', (ws: WebSocket) => {
        this.handleConnection(ws);
      });

      this.wss.on('error', (error: Error) => {
        logger.error('WebSocket server error:', error);
      });

      this.isRunning = true;
      
      // Start real-time updates
      this.startRealTimeUpdates();
      
      logger.info(`WebSocket server started on port ${port}`);
    } catch (error) {
      logger.error('Error starting WebSocket server:', error as Error);
      throw error;
    }
  }

  /**
   * Handle new WebSocket connection
   */
  private handleConnection(ws: WebSocket): void {
    logger.info('New WebSocket client connected');
    
    this.clients.add(ws);

    // Send initial data
    this.sendInitialData(ws);

    ws.on('message', (message: string) => {
      try {
        const data = JSON.parse(message);
        this.handleMessage(ws, data);
      } catch (error) {
        logger.error('Error parsing WebSocket message:', error as Error);
        this.sendError(ws, 'Invalid message format');
      }
    });

    ws.on('close', () => {
      logger.info('WebSocket client disconnected');
      this.clients.delete(ws);
    });

    ws.on('error', (error: Error) => {
      logger.error('WebSocket client error:', error);
      this.clients.delete(ws);
    });
  }

  /**
   * Send initial data to new client
   */
  private async sendInitialData(ws: WebSocket): Promise<void> {
    try {
      // Send current performance metrics
      const performance = await this.getCurrentPerformance();
      this.sendMessage(ws, {
        type: 'performance',
        data: performance,
        timestamp: Date.now()
      });

      // Send recent signals
      const recentSignals = await this.getRecentSignals(10);
      this.sendMessage(ws, {
        type: 'signal',
        data: { signals: recentSignals },
        timestamp: Date.now()
      });

      // Send active positions
      const activePositions = await this.getActivePositions();
      this.sendMessage(ws, {
        type: 'trade',
        data: { positions: activePositions },
        timestamp: Date.now()
      });

      logger.info('Initial data sent to client');
    } catch (error) {
      logger.error('Error sending initial data:', error as Error);
    }
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(ws: WebSocket, message: any): void {
    try {
      switch (message.type) {
        case 'subscribe':
          this.handleSubscription(ws, message);
          break;
        case 'unsubscribe':
          this.handleUnsubscription(ws, message);
          break;
        case 'request_data':
          this.handleDataRequest(ws, message);
          break;
        default:
          logger.warn('Unknown message type:', message.type);
      }
    } catch (error) {
      logger.error('Error handling WebSocket message:', error as Error);
      this.sendError(ws, 'Internal server error');
    }
  }

  /**
   * Handle subscription requests
   */
  private handleSubscription(ws: WebSocket, message: any): void {
    const { channels } = message;
    logger.info('Client subscribed to channels:', channels);
    
    // Store subscription preferences (in a real app, this would be per-client)
    this.sendMessage(ws, {
      type: 'subscription_confirmed',
      data: { channels },
      timestamp: Date.now()
    });
  }

  /**
   * Handle unsubscription requests
   */
  private handleUnsubscription(ws: WebSocket, message: any): void {
    const { channels } = message;
    logger.info('Client unsubscribed from channels:', channels);
    
    this.sendMessage(ws, {
      type: 'unsubscription_confirmed',
      data: { channels },
      timestamp: Date.now()
    });
  }

  /**
   * Handle data requests
   */
  private async handleDataRequest(ws: WebSocket, message: any): Promise<void> {
    try {
      const { requestType, params } = message;
      
      switch (requestType) {
        case 'performance':
          const performance = await this.getCurrentPerformance();
          this.sendMessage(ws, {
            type: 'performance',
            data: performance,
            timestamp: Date.now()
          });
          break;
          
        case 'signals':
          const signals = await this.getRecentSignals(params?.limit || 50);
          this.sendMessage(ws, {
            type: 'signal',
            data: { signals },
            timestamp: Date.now()
          });
          break;
          
        case 'trades':
          const trades = await this.getRecentTrades(params?.limit || 50);
          this.sendMessage(ws, {
            type: 'trade',
            data: { trades },
            timestamp: Date.now()
          });
          break;
          
        case 'market_data':
          const marketData = await this.getMarketData(params?.symbols || []);
          this.sendMessage(ws, {
            type: 'market_data',
            data: { marketData },
            timestamp: Date.now()
          });
          break;
          
        default:
          this.sendError(ws, `Unknown request type: ${requestType}`);
      }
    } catch (error) {
      logger.error('Error handling data request:', error as Error);
      this.sendError(ws, 'Error fetching requested data');
    }
  }

  /**
   * Start real-time updates
   */
  private startRealTimeUpdates(): void {
    // Update every 5 seconds
    this.updateInterval = setInterval(async () => {
      try {
        await this.broadcastUpdates();
      } catch (error) {
        logger.error('Error broadcasting updates:', error as Error);
      }
    }, 5000);

    logger.info('Real-time updates started');
  }

  /**
   * Broadcast updates to all connected clients
   */
  private async broadcastUpdates(): Promise<void> {
    if (this.clients.size === 0) return;

    try {
      // Get current performance
      const performance = await this.getCurrentPerformance();
      this.broadcast({
        type: 'performance',
        data: performance,
        timestamp: Date.now()
      });

      // Get new signals
      const newSignals = await this.getNewSignals();
      if (newSignals.length > 0) {
        this.broadcast({
          type: 'signal',
          data: { signals: newSignals },
          timestamp: Date.now()
        });

        // Send notifications for new signals
        await this.sendSignalNotifications(newSignals);
      }

      // Get market data updates
      const marketData = await this.getMarketDataUpdates();
      if (marketData.length > 0) {
        this.broadcast({
          type: 'market_data',
          data: { marketData },
          timestamp: Date.now()
        });
      }

    } catch (error) {
      logger.error('Error broadcasting updates:', error as Error);
    }
  }

  /**
   * Get current performance metrics
   */
  private async getCurrentPerformance(): Promise<PerformanceUpdate> {
    try {
      const query = `
        SELECT 
          COUNT(CASE WHEN status = 'executed' THEN 1 END) as total_trades,
          COUNT(CASE WHEN status = 'executed' AND pnl > 0 THEN 1 END) as winning_trades,
          COALESCE(SUM(CASE WHEN status = 'executed' THEN pnl ELSE 0 END), 0) as total_pnl,
          COUNT(CASE WHEN status = 'open' THEN 1 END) as active_positions,
          COALESCE(SUM(CASE WHEN status = 'open' THEN unrealized_pnl ELSE 0 END), 0) as unrealized_pnl
        FROM signals 
        WHERE created_at >= NOW() - INTERVAL '24 hours'
      `;

      const result = await this.pool.query(query);
      const data = result.rows[0];

      const totalTrades = parseInt(data.total_trades) || 0;
      const winningTrades = parseInt(data.winning_trades) || 0;
      const totalPnL = parseFloat(data.total_pnl) || 0;
      const activePositions = parseInt(data.active_positions) || 0;
      const unrealizedPnL = parseFloat(data.unrealized_pnl) || 0;

      const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;

      return {
        totalPnL,
        realizedPnL: totalPnL,
        unrealizedPnL,
        totalTrades,
        winRate,
        activePositions,
        timestamp: Date.now()
      };
    } catch (error) {
      logger.error('Error getting current performance:', error as Error);
      return {
        totalPnL: 0,
        realizedPnL: 0,
        unrealizedPnL: 0,
        totalTrades: 0,
        winRate: 0,
        activePositions: 0,
        timestamp: Date.now()
      };
    }
  }

  /**
   * Get recent signals
   */
  private async getRecentSignals(limit: number = 10): Promise<SignalUpdate[]> {
    try {
      const query = `
        SELECT 
          id, symbol, direction, confidence, pattern as strategy, 
          status, pnl, created_at
        FROM signals 
        ORDER BY created_at DESC 
        LIMIT $1
      `;

      const result = await this.pool.query(query, [limit]);
      
      return result.rows.map(row => ({
        id: row.id,
        symbol: row.symbol,
        direction: row.direction,
        confidence: parseFloat(row.confidence) || 0,
        strategy: row.strategy || 'Unknown',
        status: row.status,
        pnl: row.pnl ? parseFloat(row.pnl) : undefined,
        timestamp: new Date(row.created_at).getTime()
      }));
    } catch (error) {
      logger.error('Error getting recent signals:', error as Error);
      return [];
    }
  }

  /**
   * Get new signals (since last check)
   */
  private async getNewSignals(): Promise<SignalUpdate[]> {
    try {
      const query = `
        SELECT 
          id, symbol, direction, confidence, pattern as strategy, 
          status, pnl, created_at
        FROM signals 
        WHERE created_at >= NOW() - INTERVAL '10 seconds'
        ORDER BY created_at DESC
      `;

      const result = await this.pool.query(query);
      
      return result.rows.map(row => ({
        id: row.id,
        symbol: row.symbol,
        direction: row.direction,
        confidence: parseFloat(row.confidence) || 0,
        strategy: row.strategy || 'Unknown',
        status: row.status,
        pnl: row.pnl ? parseFloat(row.pnl) : undefined,
        timestamp: new Date(row.created_at).getTime()
      }));
    } catch (error) {
      logger.error('Error getting new signals:', error as Error);
      return [];
    }
  }

  /**
   * Get active positions
   */
  private async getActivePositions(): Promise<TradeUpdate[]> {
    try {
      const query = `
        SELECT 
          id, symbol, direction as side, volume as quantity, 
          entry_price as price, status, created_at
        FROM signals 
        WHERE status = 'open'
        ORDER BY created_at DESC
      `;

      const result = await this.pool.query(query);
      
      return result.rows.map(row => ({
        id: row.id,
        symbol: row.symbol,
        side: row.side === 'LONG' ? 'BUY' : 'SELL',
        quantity: parseFloat(row.quantity) || 0,
        price: parseFloat(row.price) || 0,
        status: row.status,
        timestamp: new Date(row.created_at).getTime()
      }));
    } catch (error) {
      logger.error('Error getting active positions:', error as Error);
      return [];
    }
  }

  /**
   * Get recent trades
   */
  private async getRecentTrades(limit: number = 50): Promise<TradeUpdate[]> {
    try {
      const query = `
        SELECT 
          id, symbol, direction as side, volume as quantity, 
          entry_price as price, status, created_at
        FROM signals 
        WHERE status = 'executed'
        ORDER BY created_at DESC 
        LIMIT $1
      `;

      const result = await this.pool.query(query, [limit]);
      
      return result.rows.map(row => ({
        id: row.id,
        symbol: row.symbol,
        side: row.side === 'LONG' ? 'BUY' : 'SELL',
        quantity: parseFloat(row.quantity) || 0,
        price: parseFloat(row.price) || 0,
        status: row.status,
        timestamp: new Date(row.created_at).getTime()
      }));
    } catch (error) {
      logger.error('Error getting recent trades:', error as Error);
      return [];
    }
  }

  /**
   * Get market data updates
   */
  private async getMarketDataUpdates(): Promise<MarketDataUpdate[]> {
    try {
      // Get symbols with recent activity
      const query = `
        SELECT DISTINCT symbol
        FROM signals 
        WHERE created_at >= NOW() - INTERVAL '1 hour'
        ORDER BY symbol
        LIMIT 20
      `;

      const result = await this.pool.query(query);
      const symbols = result.rows.map(row => row.symbol);
      
      // Mock market data updates (in production, this would come from real market data)
      return symbols.map(symbol => ({
        symbol,
        price: 100 + Math.random() * 50,
        change: (Math.random() - 0.5) * 5,
        volume: Math.floor(1000000 + Math.random() * 5000000),
        timestamp: Date.now()
      }));
    } catch (error) {
      logger.error('Error getting market data updates:', error as Error);
      return [];
    }
  }

  /**
   * Get market data for specific symbols
   */
  private async getMarketData(symbols: string[]): Promise<MarketDataUpdate[]> {
    try {
      if (symbols.length === 0) {
        // Get symbols from recent signals
        const query = `
          SELECT DISTINCT symbol
          FROM signals 
          WHERE created_at >= NOW() - INTERVAL '24 hours'
          ORDER BY symbol
          LIMIT 50
        `;
        const result = await this.pool.query(query);
        symbols = result.rows.map(row => row.symbol);
      }

      // Mock market data (in production, this would come from real market data)
      return symbols.map(symbol => ({
        symbol,
        price: 100 + Math.random() * 50,
        change: (Math.random() - 0.5) * 5,
        volume: Math.floor(1000000 + Math.random() * 5000000),
        timestamp: Date.now()
      }));
    } catch (error) {
      logger.error('Error getting market data:', error as Error);
      return [];
    }
  }

  /**
   * Send signal notifications
   */
  private async sendSignalNotifications(signals: SignalUpdate[]): Promise<void> {
    try {
      for (const signal of signals) {
        if (signal.confidence > 70) { // Only notify high-confidence signals
          await this.notificationService.sendSignalAlert({
            symbol: signal.symbol,
            direction: signal.direction,
            confidence: signal.confidence,
            strategy: signal.strategy,
            price: 0 // Would come from market data
          });
        }
      }
    } catch (error) {
      logger.error('Error sending signal notifications:', error as Error);
    }
  }

  /**
   * Broadcast message to all connected clients
   */
  private broadcast(message: WebSocketMessage): void {
    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        this.sendMessage(client, message);
      }
    });
  }

  /**
   * Send message to specific client
   */
  private sendMessage(ws: WebSocket, message: WebSocketMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * Send error message to client
   */
  private sendError(ws: WebSocket, error: string): void {
    this.sendMessage(ws, {
      type: 'error',
      data: { message: error },
      timestamp: Date.now()
    });
  }

  /**
   * Stop WebSocket server
   */
  stop(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }

    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }

    this.clients.clear();
    this.isRunning = false;
    
    logger.info('WebSocket server stopped');
  }

  /**
   * Get server status
   */
  getStatus(): { isRunning: boolean; connectedClients: number } {
    return {
      isRunning: this.isRunning,
      connectedClients: this.clients.size
    };
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    await this.pool.end();
    logger.info('WebSocketService database connection closed');
  }
}

// Export singleton instance
export const webSocketService = new WebSocketService(); 