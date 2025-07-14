-- PostgreSQL Database Initialization Script
-- Paper Trading System Database Setup

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create database if it doesn't exist (run this as superuser)
-- CREATE DATABASE scanner_db;

-- Connect to the database
-- \c scanner_db;

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
);

-- Signals table
CREATE TABLE IF NOT EXISTS signals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
);

-- Watchlists table
CREATE TABLE IF NOT EXISTS watchlists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  symbol VARCHAR(10) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, symbol)
);

-- Portfolios table
CREATE TABLE IF NOT EXISTS portfolios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  symbols JSONB DEFAULT '[]',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT true
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  data JSONB,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Analytics table
CREATE TABLE IF NOT EXISTS analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  signals_generated INTEGER DEFAULT 0,
  signals_successful INTEGER DEFAULT 0,
  total_pnl DECIMAL(10,2) DEFAULT 0,
  win_rate DECIMAL(5,2) DEFAULT 0,
  avg_confidence DECIMAL(5,2) DEFAULT 0,
  patterns_used JSONB DEFAULT '{}',
  UNIQUE(user_id, date)
);

-- Market data table
CREATE TABLE IF NOT EXISTS market_data (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  symbol VARCHAR(10) NOT NULL,
  timestamp TIMESTAMP NOT NULL,
  open_price DECIMAL(10,4) NOT NULL,
  high_price DECIMAL(10,4) NOT NULL,
  low_price DECIMAL(10,4) NOT NULL,
  close_price DECIMAL(10,4) NOT NULL,
  volume INTEGER NOT NULL,
  interval VARCHAR(10) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(symbol, timestamp, interval)
);

-- Backtest results table
CREATE TABLE IF NOT EXISTS backtest_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  strategy_name VARCHAR(100) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  symbols JSONB NOT NULL,
  parameters JSONB NOT NULL,
  results JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Optimization results table
CREATE TABLE IF NOT EXISTS optimization_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  strategy_name VARCHAR(100) NOT NULL,
  optimization_type VARCHAR(50) NOT NULL,
  parameters JSONB NOT NULL,
  fitness_score DECIMAL(10,4) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_signals_user_id ON signals(user_id);
CREATE INDEX IF NOT EXISTS idx_signals_symbol ON signals(symbol);
CREATE INDEX IF NOT EXISTS idx_signals_created_at ON signals(created_at);
CREATE INDEX IF NOT EXISTS idx_signals_status ON signals(status);

CREATE INDEX IF NOT EXISTS idx_watchlists_user_id ON watchlists(user_id);
CREATE INDEX IF NOT EXISTS idx_watchlists_symbol ON watchlists(symbol);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);

CREATE INDEX IF NOT EXISTS idx_analytics_user_id ON analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_date ON analytics(date);

CREATE INDEX IF NOT EXISTS idx_market_data_symbol ON market_data(symbol);
CREATE INDEX IF NOT EXISTS idx_market_data_timestamp ON market_data(timestamp);
CREATE INDEX IF NOT EXISTS idx_market_data_symbol_timestamp ON market_data(symbol, timestamp);

CREATE INDEX IF NOT EXISTS idx_backtest_results_user_id ON backtest_results(user_id);
CREATE INDEX IF NOT EXISTS idx_backtest_results_strategy ON backtest_results(strategy_name);
CREATE INDEX IF NOT EXISTS idx_backtest_results_created_at ON backtest_results(created_at);

CREATE INDEX IF NOT EXISTS idx_optimization_results_user_id ON optimization_results(user_id);
CREATE INDEX IF NOT EXISTS idx_optimization_results_strategy ON optimization_results(strategy_name);
CREATE INDEX IF NOT EXISTS idx_optimization_results_fitness ON optimization_results(fitness_score);

-- Insert sample data for testing
INSERT INTO users (email, password_hash, first_name, last_name, role) VALUES
('admin@papertrading.com', '$2b$10$example.hash.here', 'Admin', 'User', 'admin'),
('user@papertrading.com', '$2b$10$example.hash.here', 'Test', 'User', 'user')
ON CONFLICT (email) DO NOTHING;

-- Insert sample signals
INSERT INTO signals (symbol, pattern, direction, entry_price, stop_loss, target1, target2, confidence, volume, atr, position_size, risk_amount) VALUES
('SPY', 'Inside Bar Bullish Breakout', 'BUY', 150.00, 147.50, 155.00, 160.00, 85.5, 1000, 2.5, 100, 250.00),
('QQQ', 'Gap Up Breakout', 'BUY', 380.00, 375.00, 390.00, 400.00, 92.3, 500, 3.2, 50, 250.00),
('TSLA', 'Outside Bar Bearish Follow-Through', 'SELL', 250.00, 255.00, 240.00, 230.00, 78.9, 750, 4.1, 75, 375.00)
ON CONFLICT DO NOTHING;

-- Insert sample watchlist
INSERT INTO watchlists (user_id, symbol) 
SELECT u.id, 'SPY' FROM users u WHERE u.email = 'user@papertrading.com'
ON CONFLICT DO NOTHING;

INSERT INTO watchlists (user_id, symbol) 
SELECT u.id, 'QQQ' FROM users u WHERE u.email = 'user@papertrading.com'
ON CONFLICT DO NOTHING;

-- Insert sample analytics
INSERT INTO analytics (user_id, date, signals_generated, signals_successful, total_pnl, win_rate, avg_confidence) 
SELECT u.id, CURRENT_DATE, 15, 10, 1250.50, 66.67, 82.5 
FROM users u WHERE u.email = 'user@papertrading.com'
ON CONFLICT (user_id, date) DO NOTHING;

-- Grant permissions (run as superuser)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;

COMMIT; 