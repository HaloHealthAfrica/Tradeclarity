import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { Pool } from 'pg';
import { createModuleLogger } from '../../utils/logger';

const logger = createModuleLogger('AuthService');

interface User {
  id: string;
  username: string;
  email: string;
  role: string;
  preferences?: any;
  createdAt: string;
}

interface LoginRequest {
  email: string;
  password: string;
}

interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

/**
 * Authentication Microservice
 * 
 * Features:
 * - User authentication
 * - JWT token management
 * - Password hashing
 * - Role-based access control
 * - Session management
 */
export class AuthService {
  private app: express.Application;
  private port: number;
  private isRunning = false;
  private JWT_SECRET: string;
  private pool: Pool;

  constructor(port: number = 3005) {
    this.app = express();
    this.port = port;
    this.JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
    
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

    this.setupMiddleware();
    this.setupRoutes();
  }

  /**
   * Setup middleware
   */
  private setupMiddleware(): void {
    // Security middleware
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
      message: 'Too many requests from this IP'
    });
    this.app.use('/api/', limiter);

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    // Request logging
    this.app.use((req, res, next) => {
      logger.info(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      next();
    });
  }

  /**
   * Setup REST API routes
   */
  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        service: 'auth',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
      });
    });

    // API routes
    this.app.use('/api/auth', this.createAuthRoutes());
  }

  /**
   * Create authentication management routes
   */
  private createAuthRoutes() {
    const router = express.Router();

    // Register new user
    router.post('/register', async (req, res) => {
      try {
        const { username, email, password, firstName, lastName } = req.body;
        
        if (!username || !email || !password || !firstName || !lastName) {
          return res.status(400).json({
            success: false,
            error: 'All fields are required'
          });
        }

        const result = await this.registerUser(username, email, password, firstName, lastName);
        
        res.json({
          success: true,
          data: result
        });
      } catch (error) {
        logger.error('Error registering user:', error as Error);
        res.status(500).json({
          success: false,
          error: 'Failed to register user'
        });
      }
    });

    // Login user
    router.post('/login', async (req, res) => {
      try {
        const { email, password } = req.body;
        
        if (!email || !password) {
          return res.status(400).json({
            success: false,
            error: 'Email and password are required'
          });
        }

        const result = await this.loginUser(email, password);
        
        res.json({
          success: true,
          data: result
        });
      } catch (error) {
        logger.error('Error logging in user:', error as Error);
        res.status(500).json({
          success: false,
          error: 'Failed to login user'
        });
      }
    });

    // Logout user
    router.post('/logout', (req, res) => {
      try {
        // In a real implementation, you might want to blacklist the token
        res.json({
          success: true,
          message: 'Logged out successfully'
        });
      } catch (error) {
        logger.error('Error logging out user:', error as Error);
        res.status(500).json({
          success: false,
          error: 'Failed to logout user'
        });
      }
    });

    // Refresh token
    router.post('/refresh', (req, res) => {
      try {
        const { token } = req.body;
        
        if (!token) {
          return res.status(400).json({
            success: false,
            error: 'Token is required'
          });
        }

        const newToken = this.refreshToken(token);
        
        res.json({
          success: true,
          data: { token: newToken }
        });
      } catch (error) {
        logger.error('Error refreshing token:', error as Error);
        res.status(500).json({
          success: false,
          error: 'Failed to refresh token'
        });
      }
    });

    // Get current user
    router.get('/me', this.authenticate.bind(this), async (req, res) => {
      try {
        const userId = (req as any).user.id;
        
        const profile = await this.getUserProfile(userId);
        
        res.json({
          success: true,
          data: profile
        });
      } catch (error) {
        logger.error('Error getting user profile:', error as Error);
        res.status(500).json({
          success: false,
          error: 'Failed to get user profile'
        });
      }
    });

    return router;
  }

  /**
   * Register a new user with database
   */
  private async registerUser(username: string, email: string, password: string, firstName: string, lastName: string): Promise<any> {
    try {
      logger.info('Registering new user', { username, email });
      
      // Check if user already exists
      const existingUser = await this.pool.query(
        'SELECT id FROM users WHERE email = $1 OR username = $2',
        [email, username]
      );

      if (existingUser.rows.length > 0) {
        throw new Error('User with this email or username already exists');
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);
      
      // Insert new user
      const result = await this.pool.query(
        `INSERT INTO users (username, email, password_hash, first_name, last_name, role, preferences)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, username, email, role, created_at`,
        [
          username,
          email,
          hashedPassword,
          firstName,
          lastName,
          'user',
          JSON.stringify({
            theme: 'dark',
            notifications: true,
            timezone: 'EST'
          })
        ]
      );

      const user = result.rows[0];
      
      // Generate token
      const token = this.generateToken(user);
      
      return {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          createdAt: user.created_at
        },
        token,
        expiresIn: '24h'
      };
      
    } catch (error) {
      logger.error('Error registering user:', error as Error);
      throw error;
    }
  }

  /**
   * Login user with database authentication
   */
  private async loginUser(email: string, password: string): Promise<any> {
    try {
      logger.info('User login attempt', { email });
      
      // Find user by email
      const result = await this.pool.query(
        'SELECT id, username, email, password_hash, role, created_at FROM users WHERE email = $1 AND is_active = true',
        [email]
      );

      if (result.rows.length === 0) {
        throw new Error('Invalid email or password');
      }

      const user = result.rows[0];
      
      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password_hash);
      
      if (!isValidPassword) {
        throw new Error('Invalid email or password');
      }

      // Update last login
      await this.pool.query(
        'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
        [user.id]
      );
      
      const userData = {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        createdAt: user.created_at
      };
      
      const token = this.generateToken(userData);
      
      return {
        user: userData,
        token,
        expiresIn: '24h'
      };
      
    } catch (error) {
      logger.error('Error logging in user:', error as Error);
      throw error;
    }
  }

  /**
   * Generate JWT token
   */
  private generateToken(user: any): string {
    const payload = {
      id: user.id,
      username: user.username,
      role: user.role,
      iat: Date.now()
    };
    
    return jwt.sign(payload, this.JWT_SECRET, { expiresIn: '24h' });
  }

  /**
   * Verify JWT token
   */
  private verifyToken(token: string): any {
    return jwt.verify(token, this.JWT_SECRET);
  }

  /**
   * Refresh JWT token
   */
  private refreshToken(token: string): string {
    const decoded = jwt.verify(token, this.JWT_SECRET) as any;
    
    // Remove iat and exp from payload
    const { iat, exp, ...payload } = decoded;
    
    return jwt.sign(payload, this.JWT_SECRET, { expiresIn: '24h' });
  }

  /**
   * Get user profile from database
   */
  private async getUserProfile(userId: string): Promise<any> {
    try {
      logger.info('Getting user profile', { userId });
      
      const result = await this.pool.query(
        'SELECT id, username, email, first_name, last_name, role, preferences, created_at, last_login FROM users WHERE id = $1 AND is_active = true',
        [userId]
      );

      if (result.rows.length === 0) {
        throw new Error('User not found');
      }

      const user = result.rows[0];
      
      return {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        preferences: user.preferences || {
          theme: 'dark',
          notifications: true,
          timezone: 'EST'
        },
        createdAt: user.created_at,
        lastLogin: user.last_login
      };
      
    } catch (error) {
      logger.error('Error getting user profile:', error as Error);
      throw error;
    }
  }

  /**
   * Authentication middleware for other services
   */
  authenticate(req: any, res: any, next: any): void {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ success: false, error: 'Access token required' });
    }

    try {
      const decoded = jwt.verify(token, this.JWT_SECRET);
      req.user = decoded;
      next();
    } catch (error) {
      return res.status(403).json({ success: false, error: 'Invalid or expired token' });
    }
  }

  /**
   * Start the auth service
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('AuthService is already running');
      return;
    }

    try {
      // Test database connection
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();
      
      this.app.listen(this.port, () => {
        logger.info(`AuthService started on port ${this.port}`);
      });

      this.isRunning = true;
    } catch (error) {
      logger.error('Failed to start AuthService', error as Error);
      throw error;
    }
  }

  /**
   * Stop the auth service
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('AuthService is not running');
      return;
    }

    await this.pool.end();
    this.isRunning = false;
    logger.info('AuthService stopped');
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      port: this.port,
      uptime: process.uptime(),
      databaseConnected: this.pool.totalCount > 0
    };
  }
} 