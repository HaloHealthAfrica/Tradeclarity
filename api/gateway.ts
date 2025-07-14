import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { logger } from '../utils/logger';

// Environment variables
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// Service URLs
const SERVICES = {
  scanner: process.env.SCANNER_SERVICE_URL || 'http://localhost:3001',
  database: process.env.DATABASE_SERVICE_URL || 'http://localhost:3002',
  notification: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3003',
  marketData: process.env.MARKET_DATA_SERVICE_URL || 'http://localhost:3004',
  auth: process.env.AUTH_SERVICE_URL || 'http://localhost:3005',
  endOfDay: process.env.END_OF_DAY_SERVICE_URL || 'http://localhost:3006',
};

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
});

// JWT Authentication middleware
const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) {
      return res.status(403).json({ success: false, error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Create Express app
const app = express();
const PORT = process.env.GATEWAY_PORT || 3000;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: FRONTEND_URL,
  credentials: true,
}));
app.use(limiter);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString(),
  });
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: Object.keys(SERVICES),
    },
  });
});

// Authentication routes
app.use('/auth', createProxyMiddleware({
  target: SERVICES.auth,
  changeOrigin: true,
  pathRewrite: {
    '^/auth': '/auth',
  },
  onProxyReq: (proxyReq, req, res) => {
    logger.info(`Proxying auth request to ${SERVICES.auth}`);
  },
  onError: (err, req, res) => {
    logger.error('Auth service proxy error:', err);
    res.status(500).json({ success: false, error: 'Authentication service unavailable' });
  },
}));

// Trading routes (protected)
app.use('/trading', authenticateToken, createProxyMiddleware({
  target: SERVICES.database,
  changeOrigin: true,
  pathRewrite: {
    '^/trading': '/trading',
  },
  onProxyReq: (proxyReq, req, res) => {
    // Add user info to request
    proxyReq.headers['X-User-ID'] = req.user.id;
    proxyReq.headers['X-User-Role'] = req.user.role;
    logger.info(`Proxying trading request to ${SERVICES.database}`);
  },
  onError: (err, req, res) => {
    logger.error('Trading service proxy error:', err);
    res.status(500).json({ success: false, error: 'Trading service unavailable' });
  },
}));

// Scanner routes (protected)
app.use('/scanner', authenticateToken, createProxyMiddleware({
  target: SERVICES.scanner,
  changeOrigin: true,
  pathRewrite: {
    '^/scanner': '/scanner',
  },
  onProxyReq: (proxyReq, req, res) => {
    proxyReq.headers['X-User-ID'] = req.user.id;
    logger.info(`Proxying scanner request to ${SERVICES.scanner}`);
  },
  onError: (err, req, res) => {
    logger.error('Scanner service proxy error:', err);
    res.status(500).json({ success: false, error: 'Scanner service unavailable' });
  },
}));

// Watchlist routes (protected)
app.use('/watchlist', authenticateToken, createProxyMiddleware({
  target: SERVICES.database,
  changeOrigin: true,
  pathRewrite: {
    '^/watchlist': '/watchlist',
  },
  onProxyReq: (proxyReq, req, res) => {
    proxyReq.headers['X-User-ID'] = req.user.id;
    logger.info(`Proxying watchlist request to ${SERVICES.database}`);
  },
  onError: (err, req, res) => {
    logger.error('Watchlist service proxy error:', err);
    res.status(500).json({ success: false, error: 'Watchlist service unavailable' });
  },
}));

// Portfolio routes (protected)
app.use('/portfolio', authenticateToken, createProxyMiddleware({
  target: SERVICES.database,
  changeOrigin: true,
  pathRewrite: {
    '^/portfolio': '/portfolio',
  },
  onProxyReq: (proxyReq, req, res) => {
    proxyReq.headers['X-User-ID'] = req.user.id;
    logger.info(`Proxying portfolio request to ${SERVICES.database}`);
  },
  onError: (err, req, res) => {
    logger.error('Portfolio service proxy error:', err);
    res.status(500).json({ success: false, error: 'Portfolio service unavailable' });
  },
}));

// System status route (protected)
app.use('/system', authenticateToken, createProxyMiddleware({
  target: SERVICES.scanner,
  changeOrigin: true,
  pathRewrite: {
    '^/system': '/system',
  },
  onProxyReq: (proxyReq, req, res) => {
    proxyReq.headers['X-User-ID'] = req.user.id;
    logger.info(`Proxying system request to ${SERVICES.scanner}`);
  },
  onError: (err, req, res) => {
    logger.error('System service proxy error:', err);
    res.status(500).json({ success: false, error: 'System service unavailable' });
  },
}));

// Market data routes (protected)
app.use('/market-data', authenticateToken, createProxyMiddleware({
  target: SERVICES.marketData,
  changeOrigin: true,
  pathRewrite: {
    '^/market-data': '/market-data',
  },
  onProxyReq: (proxyReq, req, res) => {
    proxyReq.headers['X-User-ID'] = req.user.id;
    logger.info(`Proxying market data request to ${SERVICES.marketData}`);
  },
  onError: (err, req, res) => {
    logger.error('Market data service proxy error:', err);
    res.status(500).json({ success: false, error: 'Market data service unavailable' });
  },
}));

// Notification routes (protected)
app.use('/notifications', authenticateToken, createProxyMiddleware({
  target: SERVICES.notification,
  changeOrigin: true,
  pathRewrite: {
    '^/notifications': '/notifications',
  },
  onProxyReq: (proxyReq, req, res) => {
    proxyReq.headers['X-User-ID'] = req.user.id;
    logger.info(`Proxying notification request to ${SERVICES.notification}`);
  },
  onError: (err, req, res) => {
    logger.error('Notification service proxy error:', err);
    res.status(500).json({ success: false, error: 'Notification service unavailable' });
  },
}));

// WebSocket proxy for real-time data
app.use('/ws', createProxyMiddleware({
  target: SERVICES.scanner,
  changeOrigin: true,
  ws: true, // Enable WebSocket proxying
  pathRewrite: {
    '^/ws': '/ws',
  },
  onProxyReq: (proxyReq, req, res) => {
    logger.info(`Proxying WebSocket request to ${SERVICES.scanner}`);
  },
  onError: (err, req, res) => {
    logger.error('WebSocket proxy error:', err);
    res.status(500).json({ success: false, error: 'WebSocket service unavailable' });
  },
}));

// End-of-day analysis routes (protected)
app.use('/analysis', authenticateToken, createProxyMiddleware({
  target: SERVICES.endOfDay,
  changeOrigin: true,
  pathRewrite: {
    '^/analysis': '/api/v1/analysis',
  },
  onProxyReq: (proxyReq, req, res) => {
    proxyReq.headers['X-User-ID'] = req.user.id;
    logger.info(`Proxying analysis request to ${SERVICES.endOfDay}`);
  },
  onError: (err, req, res) => {
    logger.error('Analysis service proxy error:', err);
    res.status(500).json({ success: false, error: 'Analysis service unavailable' });
  },
}));

// Enhanced analysis routes (protected) - Backtesting, Market Data, Optimization
app.use('/eod', authenticateToken, createProxyMiddleware({
  target: SERVICES.endOfDay,
  changeOrigin: true,
  pathRewrite: {
    '^/eod': '/api/eod',
  },
  onProxyReq: (proxyReq, req, res) => {
    proxyReq.headers['X-User-ID'] = req.user.id;
    logger.info(`Proxying enhanced analysis request to ${SERVICES.endOfDay}`);
  },
  onError: (err, req, res) => {
    logger.error('Enhanced analysis service proxy error:', err);
    res.status(500).json({ success: false, error: 'Enhanced analysis service unavailable' });
  },
}));

// Error handling middleware
app.use((err: any, req: any, res: any, next: any) => {
  logger.error('Gateway error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.originalUrl,
  });
});

// Start server
const server = app.listen(PORT, () => {
  logger.info(`API Gateway started on port ${PORT}`);
  logger.info(`Frontend URL: ${FRONTEND_URL}`);
  logger.info('Service URLs:', SERVICES);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Gateway server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => {
    logger.info('Gateway server closed');
    process.exit(0);
  });
});

export default app; 