import { createModuleLogger } from '../../utils/logger';
import { Pool, PoolClient, QueryResult } from 'pg';
import type { IStorage } from '../../types';

const logger = createModuleLogger('DatabaseService');

/**
 * Database Service Interface
 */
export interface DatabaseServiceInterface {
  start(): Promise<void>;
  stop(): Promise<void>;
  getStatus(): any;
  getStorage(): IStorage;
  
  // Signal management
  getSignals(options: SignalQueryOptions): Promise<any[]>;
  getSignalById(id: string): Promise<any | null>;
  updateSignalStatus(id: string, status: string): Promise<void>;
  
  // User management
  createUser(userData: UserData): Promise<string>;
  getUserById(id: string): Promise<any | null>;
  updateUser(id: string, userData: Partial<UserData>): Promise<void>;
  deleteUser(id: string): Promise<void>;
  
  // Watchlist management
  getUserWatchlist(userId: string): Promise<string[]>;
  addToWatchlist(userId: string, symbols: string[]): Promise<void>;
  removeFromWatchlist(userId: string, symbols: string[]): Promise<void>;
  
  // Analytics
  getSignalAnalytics(period: string): Promise<any>;
  getPatternPerformance(period: string): Promise<any>;
}

/**
 * Signal Query Options
 */
export interface SignalQueryOptions {
  userId?: string;
  symbol?: string;
  pattern?: string;
  status?: string;
  limit?: number;
  offset?: number;
  startDate?: Date;
  endDate?: Date;
}

/**
 * User Data Interface
 */
export interface UserData {
  email: string;
  password_hash: string;
  first_name: string;
  last_name: string;
  role?: string;
  preferences?: any;
}

/**
 * Database Schema
 */
export interface DatabaseSchema {
  users: UserTable;
  signals: SignalTable;
  watchlists: WatchlistTable;
  portfolios: PortfolioTable;
  notifications: NotificationTable;
  analytics: AnalyticsTable;
}

export interface UserTable {
  id: string;
  email: string;
  password_hash: string;
  first_name: string;
  last_name: string;
  role: string;
  preferences: any;
  created_at: Date;
  updated_at: Date;
  last_login?: Date;
  is_active: boolean;
}

export interface SignalTable {
  id: string;
  user_id?: string;
  symbol: string;
  pattern: string;
  direction: string;
  entry_price: number;
  stop_loss: number;
  target1: number;
  target2: number;
  confidence: number;
  volume: number;
  atr: number;
  position_size: number;
  risk_amount: number;
  confluence_factors?: any;
  status: string;
  created_at: Date;
  updated_at: Date;
}

export interface WatchlistTable {
  id: string;
  user_id: string;
  symbol: string;
  created_at: Date;
}

export interface PortfolioTable {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  symbols: string[];
  created_at: Date;
  updated_at: Date;
  is_active: boolean;
}

export interface NotificationTable {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  data?: any;
  is_read: boolean;
  created_at: Date;
}

export interface AnalyticsTable {
  id: string;
  user_id: string;
  date: Date;
  signals_generated: number;
  signals_successful: number;
  total_pnl: number;
  win_rate: number;
  avg_confidence: number;
  patterns_used: any;
}

/**
 * Production PostgreSQL Database Service
 * 
 * Features:
 * - User management and authentication
 * - Signal tracking and analytics
 * - Watchlist and portfolio management
 * - Real-time notifications
 * - Performance analytics
 */
export class DatabaseService implements DatabaseServiceInterface {
  private pool: Pool;
  private isRunning = false;
  private storage: IStorage;

  constructor() {
    // Initialize PostgreSQL connection pool
    this.pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'scanner_db',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'password',
      max: 20, // Maximum number of clients in the pool
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    // Initialize storage interface
    this.storage = {} as IStorage;
    
    logger.info('Database service initialized');
  }

  /**
   * Start database service
   */
  async start(): Promise<void> {
    try {
      // Test database connection
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();
      
      // Create tables if they don't exist
      await this.createTables();
      
      this.isRunning = true;
      logger.info('Database service started successfully');
      
    } catch (error) {
      logger.error('Failed to start database service:', error as Error);
      throw error;
    }
  }

  /**
   * Stop database service
   */
  async stop(): Promise<void> {
    try {
      await this.pool.end();
      this.isRunning = false;
      logger.info('Database service stopped');
      
    } catch (error) {
      logger.error('Error stopping database service:', error as Error);
      throw error;
    }
  }

  /**
   * Create database tables
   */
  private async createTables(): Promise<void> {
    try {
      const client = await this.pool.connect();
      
      // Create users table
      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          email VARCHAR(255) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          first_name VARCHAR(100) NOT NULL,
          last_name VARCHAR(100) NOT NULL,
          role VARCHAR(20) DEFAULT 'user',
          preferences JSONB DEFAULT '{}',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          last_login TIMESTAMP,
          is_active BOOLEAN DEFAULT true
        )
      `);
      
      // Create signals table
      await client.query(`
        CREATE TABLE IF NOT EXISTS signals (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID REFERENCES users(id) ON DELETE CASCADE,
          symbol VARCHAR(10) NOT NULL,
          pattern VARCHAR(100) NOT NULL,
          direction VARCHAR(10) NOT NULL,
          entry_price DECIMAL(10,2) NOT NULL,
          stop_loss DECIMAL(10,2) NOT NULL,
          target1 DECIMAL(10,2) NOT NULL,
          target2 DECIMAL(10,2) NOT NULL,
          confidence DECIMAL(5,2) NOT NULL,
          volume INTEGER NOT NULL,
          atr DECIMAL(10,4) NOT NULL,
          position_size INTEGER NOT NULL,
          risk_amount DECIMAL(10,2) NOT NULL,
          confluence_factors JSONB,
          status VARCHAR(20) DEFAULT 'active',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      // Create watchlists table
      await client.query(`
        CREATE TABLE IF NOT EXISTS watchlists (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID REFERENCES users(id) ON DELETE CASCADE,
          symbol VARCHAR(10) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(user_id, symbol)
        )
      `);
      
      // Create portfolios table
      await client.query(`
        CREATE TABLE IF NOT EXISTS portfolios (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID REFERENCES users(id) ON DELETE CASCADE,
          name VARCHAR(100) NOT NULL,
          description TEXT,
          symbols JSONB DEFAULT '[]',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          is_active BOOLEAN DEFAULT true
        )
      `);
      
      // Create notifications table
      await client.query(`
        CREATE TABLE IF NOT EXISTS notifications (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID REFERENCES users(id) ON DELETE CASCADE,
          type VARCHAR(50) NOT NULL,
          title VARCHAR(255) NOT NULL,
          message TEXT NOT NULL,
          data JSONB,
          is_read BOOLEAN DEFAULT false,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      // Create analytics table
      await client.query(`
        CREATE TABLE IF NOT EXISTS analytics (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID REFERENCES users(id) ON DELETE CASCADE,
          date DATE NOT NULL,
          signals_generated INTEGER DEFAULT 0,
          signals_successful INTEGER DEFAULT 0,
          total_pnl DECIMAL(10,2) DEFAULT 0,
          win_rate DECIMAL(5,2) DEFAULT 0,
          avg_confidence DECIMAL(5,2) DEFAULT 0,
          patterns_used JSONB DEFAULT '{}',
          UNIQUE(user_id, date)
        )
      `);
      
      client.release();
      logger.info('Database tables created/verified');
      
    } catch (error) {
      logger.error('Failed to create tables:', error as Error);
      throw error;
    }
  }

  /**
   * Get storage interface
   */
  getStorage(): IStorage {
    return this.storage;
  }

  /**
   * Get signals with filtering
   */
  async getSignals(options: SignalQueryOptions): Promise<any[]> {
    try {
      const client = await this.pool.connect();
      
      let query = 'SELECT * FROM signals WHERE 1=1';
      const params: any[] = [];
      let paramIndex = 1;
      
      if (options.userId) {
        query += ` AND user_id = $${paramIndex++}`;
        params.push(options.userId);
      }
      
      if (options.symbol) {
        query += ` AND symbol = $${paramIndex++}`;
        params.push(options.symbol);
      }
      
      if (options.pattern) {
        query += ` AND pattern = $${paramIndex++}`;
        params.push(options.pattern);
      }
      
      if (options.status) {
        query += ` AND status = $${paramIndex++}`;
        params.push(options.status);
      }
      
      if (options.startDate) {
        query += ` AND created_at >= $${paramIndex++}`;
        params.push(options.startDate);
      }
      
      if (options.endDate) {
        query += ` AND created_at <= $${paramIndex++}`;
        params.push(options.endDate);
      }
      
      query += ' ORDER BY created_at DESC';
      
      if (options.limit) {
        query += ` LIMIT $${paramIndex++}`;
        params.push(options.limit);
      }
      
      if (options.offset) {
        query += ` OFFSET $${paramIndex++}`;
        params.push(options.offset);
      }
      
      const result = await client.query(query, params);
      client.release();
      
      return result.rows;
      
    } catch (error) {
      logger.error('Error getting signals:', error as Error);
      return [];
    }
  }

  /**
   * Get signal by ID
   */
  async getSignalById(id: string): Promise<any | null> {
    try {
      const client = await this.pool.connect();
      const result = await client.query('SELECT * FROM signals WHERE id = $1', [id]);
      client.release();
      
      return result.rows[0] || null;
      
    } catch (error) {
      logger.error('Error getting signal by ID:', error as Error);
      return null;
    }
  }

  /**
   * Update signal status
   */
  async updateSignalStatus(id: string, status: string): Promise<void> {
    try {
      const client = await this.pool.connect();
      await client.query(
        'UPDATE signals SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [status, id]
      );
      client.release();
      
      logger.info(`Signal ${id} status updated to ${status}`);
      
    } catch (error) {
      logger.error('Error updating signal status:', error as Error);
      throw error;
    }
  }

  /**
   * Create user
   */
  async createUser(userData: UserData): Promise<string> {
    try {
      const client = await this.pool.connect();
      const result = await client.query(
        `INSERT INTO users (email, password_hash, first_name, last_name, role, preferences)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [
          userData.email,
          userData.password_hash,
          userData.first_name,
          userData.last_name,
          userData.role || 'user',
          JSON.stringify(userData.preferences || {})
        ]
      );
      client.release();
      
      const userId = result.rows[0].id;
      logger.info(`User created: ${userId}`);
      return userId;
      
    } catch (error) {
      logger.error('Error creating user:', error as Error);
      throw error;
    }
  }

  /**
   * Get user by ID
   */
  async getUserById(id: string): Promise<any | null> {
    try {
      const client = await this.pool.connect();
      const result = await client.query('SELECT * FROM users WHERE id = $1', [id]);
      client.release();
      
      if (result.rows[0]) {
        return {
          ...result.rows[0],
          preferences: result.rows[0].preferences || {}
        };
      }
      
      return null;
      
    } catch (error) {
      logger.error('Error getting user by ID:', error as Error);
      return null;
    }
  }

  /**
   * Update user
   */
  async updateUser(id: string, userData: Partial<UserData>): Promise<void> {
    try {
      const client = await this.pool.connect();
      
      const updateFields: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;
      
      if (userData.email) {
        updateFields.push(`email = $${paramIndex++}`);
        params.push(userData.email);
      }
      
      if (userData.password_hash) {
        updateFields.push(`password_hash = $${paramIndex++}`);
        params.push(userData.password_hash);
      }
      
      if (userData.first_name) {
        updateFields.push(`first_name = $${paramIndex++}`);
        params.push(userData.first_name);
      }
      
      if (userData.last_name) {
        updateFields.push(`last_name = $${paramIndex++}`);
        params.push(userData.last_name);
      }
      
      if (userData.role) {
        updateFields.push(`role = $${paramIndex++}`);
        params.push(userData.role);
      }
      
      if (userData.preferences) {
        updateFields.push(`preferences = $${paramIndex++}`);
        params.push(JSON.stringify(userData.preferences));
      }
      
      updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
      params.push(id);
      
      const query = `UPDATE users SET ${updateFields.join(', ')} WHERE id = $${paramIndex}`;
      await client.query(query, params);
      client.release();
      
      logger.info(`User ${id} updated`);
      
    } catch (error) {
      logger.error('Error updating user:', error as Error);
      throw error;
    }
  }

  /**
   * Delete user
   */
  async deleteUser(id: string): Promise<void> {
    try {
      const client = await this.pool.connect();
      await client.query('DELETE FROM users WHERE id = $1', [id]);
      client.release();
      
      logger.info(`User ${id} deleted`);
      
    } catch (error) {
      logger.error('Error deleting user:', error as Error);
      throw error;
    }
  }

  /**
   * Get user watchlist
   */
  async getUserWatchlist(userId: string): Promise<string[]> {
    try {
      const client = await this.pool.connect();
      const result = await client.query(
        'SELECT symbol FROM watchlists WHERE user_id = $1 ORDER BY created_at DESC',
        [userId]
      );
      client.release();
      
      return result.rows.map(row => row.symbol);
      
    } catch (error) {
      logger.error('Error getting user watchlist:', error as Error);
      return [];
    }
  }

  /**
   * Add symbols to watchlist
   */
  async addToWatchlist(userId: string, symbols: string[]): Promise<void> {
    try {
      const client = await this.pool.connect();
      
      for (const symbol of symbols) {
        await client.query(
          `INSERT INTO watchlists (user_id, symbol)
           VALUES ($1, $2)
           ON CONFLICT (user_id, symbol) DO NOTHING`,
          [userId, symbol]
        );
      }
      
      client.release();
      logger.info(`Added ${symbols.length} symbols to watchlist for user ${userId}`);
      
    } catch (error) {
      logger.error('Error adding to watchlist:', error as Error);
      throw error;
    }
  }

  /**
   * Remove symbols from watchlist
   */
  async removeFromWatchlist(userId: string, symbols: string[]): Promise<void> {
    try {
      const client = await this.pool.connect();
      
      for (const symbol of symbols) {
        await client.query(
          'DELETE FROM watchlists WHERE user_id = $1 AND symbol = $2',
          [userId, symbol]
        );
      }
      
      client.release();
      logger.info(`Removed ${symbols.length} symbols from watchlist for user ${userId}`);
      
    } catch (error) {
      logger.error('Error removing from watchlist:', error as Error);
      throw error;
    }
  }

  /**
   * Get signal analytics
   */
  async getSignalAnalytics(period: string): Promise<any> {
    try {
      const client = await this.pool.connect();
      
      let dateFilter = '';
      if (period === '7d') {
        dateFilter = 'AND created_at >= CURRENT_DATE - INTERVAL \'7 days\'';
      } else if (period === '30d') {
        dateFilter = 'AND created_at >= CURRENT_DATE - INTERVAL \'30 days\'';
      } else if (period === '90d') {
        dateFilter = 'AND created_at >= CURRENT_DATE - INTERVAL \'90 days\'';
      }
      
      const result = await client.query(`
        SELECT 
          COUNT(*) as total_signals,
          COUNT(CASE WHEN status = 'successful' THEN 1 END) as successful_signals,
          AVG(confidence) as avg_confidence,
          AVG(CASE WHEN status = 'successful' THEN confidence END) as successful_confidence
        FROM signals 
        WHERE 1=1 ${dateFilter}
      `);
      
      client.release();
      
      const analytics = result.rows[0];
      return {
        total_signals: parseInt(analytics.total_signals),
        successful_signals: parseInt(analytics.successful_signals),
        win_rate: analytics.total_signals > 0 ? 
          (analytics.successful_signals / analytics.total_signals * 100).toFixed(2) : 0,
        avg_confidence: parseFloat(analytics.avg_confidence || 0).toFixed(2),
        successful_confidence: parseFloat(analytics.successful_confidence || 0).toFixed(2)
      };
      
    } catch (error) {
      logger.error('Error getting signal analytics:', error as Error);
      return {
        total_signals: 0,
        successful_signals: 0,
        win_rate: 0,
        avg_confidence: 0,
        successful_confidence: 0
      };
    }
  }

  /**
   * Get pattern performance
   */
  async getPatternPerformance(period: string): Promise<any> {
    try {
      const client = await this.pool.connect();
      
      let dateFilter = '';
      if (period === '7d') {
        dateFilter = 'AND created_at >= CURRENT_DATE - INTERVAL \'7 days\'';
      } else if (period === '30d') {
        dateFilter = 'AND created_at >= CURRENT_DATE - INTERVAL \'30 days\'';
      } else if (period === '90d') {
        dateFilter = 'AND created_at >= CURRENT_DATE - INTERVAL \'90 days\'';
      }
      
      const result = await client.query(`
        SELECT 
          pattern,
          COUNT(*) as total_signals,
          COUNT(CASE WHEN status = 'successful' THEN 1 END) as successful_signals,
          AVG(confidence) as avg_confidence
        FROM signals 
        WHERE 1=1 ${dateFilter}
        GROUP BY pattern
        ORDER BY successful_signals DESC
      `);
      
      client.release();
      
      return result.rows.map(row => ({
        pattern: row.pattern,
        total_signals: parseInt(row.total_signals),
        successful_signals: parseInt(row.successful_signals),
        win_rate: row.total_signals > 0 ? 
          (row.successful_signals / row.total_signals * 100).toFixed(2) : 0,
        avg_confidence: parseFloat(row.avg_confidence || 0).toFixed(2)
      }));
      
    } catch (error) {
      logger.error('Error getting pattern performance:', error as Error);
      return [];
    }
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      uptime: process.uptime(),
      connections: this.pool ? {
        totalCount: this.pool.totalCount,
        idleCount: this.pool.idleCount,
        waitingCount: this.pool.waitingCount
      } : 'inactive'
    };
  }
} 