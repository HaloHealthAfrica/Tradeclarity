// Environment Configuration for Paper Trading System

export const environment = {
  // Database Configuration (PostgreSQL)
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    name: process.env.DB_NAME || 'scanner_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    url: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/scanner_db'
  },

  // API Keys
  twelveData: {
    apiKey: process.env.TWELVEDATA_API_KEY || 'your_twelvedata_api_key_here'
  },

  alpaca: {
    apiKey: process.env.ALPACA_API_KEY || 'your_alpaca_api_key_here',
    secretKey: process.env.ALPACA_SECRET_KEY || 'your_alpaca_secret_key_here',
    paperTrading: process.env.PAPER_TRADING === 'true' || true
  },

  // JWT Configuration
  jwt: {
    secret: process.env.JWT_SECRET || 'your_jwt_secret_key_here',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h'
  },

  // Server Configuration
  server: {
    port: parseInt(process.env.PORT || '3000'),
    nodeEnv: process.env.NODE_ENV || 'development',
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000'
  },

  // Redis Configuration
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379'
  },

  // Email Configuration
  email: {
    smtpServer: process.env.SMTP_SERVER || 'smtp.gmail.com',
    smtpPort: parseInt(process.env.SMTP_PORT || '587'),
    user: process.env.EMAIL_USER || 'your_email@gmail.com',
    pass: process.env.EMAIL_PASS || 'your_email_password_here'
  },

  // Slack Configuration
  slack: {
    webhook: process.env.SLACK_WEBHOOK || 'your_slack_webhook_url_here'
  },

  // Trading Configuration
  trading: {
    maxPositionSize: parseInt(process.env.MAX_POSITION_SIZE || '10000'),
    maxDailyLoss: parseInt(process.env.MAX_DAILY_LOSS || '1000'),
    maxDrawdown: parseInt(process.env.MAX_DRAWDOWN || '5000')
  },

  // Scanner Configuration
  scanner: {
    interval: parseInt(process.env.SCANNER_INTERVAL || '5000'),
    symbols: (process.env.SCANNER_SYMBOLS || 'SPY,QQQ,TSLA,AAPL,MSFT,GOOGL,NVDA,AMD,INTC,CRM').split(','),
    patterns: (process.env.SCANNER_PATTERNS || 'inside_bar,gap_up,outside_bar,breakout,breakdown').split(',')
  },

  // Logging Configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || 'logs/app.log'
  },

  // Development Configuration
  development: {
    debug: process.env.DEBUG === 'true' || false,
    corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000'
  }
};

// Database connection string
export const getDatabaseUrl = (): string => {
  const { database } = environment;
  return `postgresql://${database.user}:${database.password}@${database.host}:${database.port}/${database.name}`;
};

// Validate required environment variables
export const validateEnvironment = (): void => {
  const required = [
    'TWELVEDATA_API_KEY',
    'ALPACA_API_KEY',
    'ALPACA_SECRET_KEY',
    'JWT_SECRET'
  ];

  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.warn(`Warning: Missing environment variables: ${missing.join(', ')}`);
    console.warn('Please set these variables for full functionality.');
  }
};

// Export default configuration
export default environment; 