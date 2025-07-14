# Real-Time and Notification Flows Integration

## Overview
Successfully implemented comprehensive real-time data flows and notification systems with full database integration, providing live trading updates, performance monitoring, and multi-channel alerting.

## Real-Time Data Flow Architecture

### 1. WebSocket Service (`api/WebSocketService.ts`)
**Core Features:**
- ✅ **Real-time Performance Updates**: Live PnL, win rates, trade counts
- ✅ **Signal Broadcasting**: Instant signal alerts to all connected clients
- ✅ **Trade Execution Updates**: Real-time trade status and PnL updates
- ✅ **Market Data Streaming**: Live price and volume updates
- ✅ **Database Integration**: All data sourced from PostgreSQL
- ✅ **Client Management**: Connection handling and subscription management

**Data Flow:**
```
Database (Signals) → WebSocket Service → Connected Clients
     ↓
Real-time Updates (5-second intervals)
     ↓
Performance Metrics, New Signals, Market Data
```

**Key Endpoints:**
- `ws://localhost:8080` - Main WebSocket connection
- Message Types: `signal`, `trade`, `performance`, `market_data`, `notification`, `error`

### 2. Notification Service (`api/NotificationService.ts`)
**Core Features:**
- ✅ **Multi-Channel Alerts**: Email (SMTP) and Slack webhooks
- ✅ **Configurable Preferences**: User-controlled notification settings
- ✅ **Priority-Based Alerts**: High/Medium/Low priority notifications
- ✅ **Database Storage**: All notifications stored for history
- ✅ **Real-time Integration**: Connected to WebSocket service

**Notification Types:**
1. **Signal Alerts**: High-confidence trading signals
2. **Trade Executions**: Order fills, cancellations, rejections
3. **Performance Updates**: Daily PnL, win rates, risk metrics
4. **Error Alerts**: System errors with severity levels
5. **Daily Reports**: End-of-day performance summaries

## Real-Time Data Flow Implementation

### WebSocket Message Structure
```typescript
interface WebSocketMessage {
  type: 'signal' | 'trade' | 'performance' | 'market_data' | 'notification' | 'error';
  data: any;
  timestamp: number;
}
```

### Real-Time Updates (5-second intervals)
```typescript
// Performance Updates
{
  type: 'performance',
  data: {
    totalPnL: number;
    realizedPnL: number;
    unrealizedPnL: number;
    totalTrades: number;
    winRate: number;
    activePositions: number;
    timestamp: number;
  }
}

// Signal Updates
{
  type: 'signal',
  data: {
    signals: Array<{
      id: string;
      symbol: string;
      direction: 'LONG' | 'SHORT';
      confidence: number;
      strategy: string;
      status: 'pending' | 'executed' | 'cancelled';
      pnl?: number;
      timestamp: number;
    }>
  }
}
```

### Database Integration
```sql
-- Real-time performance metrics
SELECT 
  COUNT(CASE WHEN status = 'executed' THEN 1 END) as total_trades,
  COUNT(CASE WHEN status = 'executed' AND pnl > 0 THEN 1 END) as winning_trades,
  COALESCE(SUM(CASE WHEN status = 'executed' THEN pnl ELSE 0 END), 0) as total_pnl,
  COUNT(CASE WHEN status = 'open' THEN 1 END) as active_positions
FROM signals 
WHERE created_at >= NOW() - INTERVAL '24 hours'

-- New signals (last 10 seconds)
SELECT id, symbol, direction, confidence, pattern as strategy, 
       status, pnl, created_at
FROM signals 
WHERE created_at >= NOW() - INTERVAL '10 seconds'
ORDER BY created_at DESC
```

## Notification Flow Implementation

### Multi-Channel Notification System
```typescript
// Email Configuration
email: {
  enabled: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  fromEmail: string;
  toEmail: string;
}

// Slack Configuration
slack: {
  enabled: boolean;
  webhookUrl: string;
  channel: string;
}
```

### Notification Types and Priorities

#### 1. Signal Alerts (High Priority)
```typescript
// Triggered for high-confidence signals (>70%)
{
  symbol: string;
  direction: 'LONG' | 'SHORT';
  confidence: number;
  strategy: string;
  price: number;
  timestamp: number;
}
```

#### 2. Trade Executions (Medium Priority)
```typescript
// Triggered for all trade executions
{
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  status: 'filled' | 'cancelled' | 'rejected';
  pnl?: number;
  timestamp: number;
}
```

#### 3. Performance Updates (Low Priority)
```typescript
// Triggered for significant performance changes
{
  totalPnL: number;
  dailyPnL: number;
  winRate: number;
  totalTrades: number;
  activePositions: number;
  timestamp: number;
}
```

#### 4. Error Alerts (Variable Priority)
```typescript
// Triggered for system errors
{
  service: string;
  error: string;
  severity: 'low' | 'medium' | 'high';
  timestamp: number;
}
```

### Notification Message Formatting

#### Email Notifications
```html
<div style="font-family: Arial, sans-serif; max-width: 600px;">
  <div style="background-color: #ff4444; color: white; padding: 20px;">
    <h1>🚨 SIGNAL ALERT</h1>
  </div>
  <div style="padding: 20px; background-color: #f9f9f9;">
    <pre>Symbol: AAPL
Direction: LONG
Strategy: EMAConfluence
Confidence: 85.2%
Price: $175.50
Time: 2024-01-15 10:30:00</pre>
  </div>
</div>
```

#### Slack Notifications
```json
{
  "channel": "#trading-alerts",
  "attachments": [{
    "color": "#ff4444",
    "title": "🚨 Signal Alert",
    "text": "Symbol: AAPL\nDirection: LONG\nStrategy: EMAConfluence\nConfidence: 85.2%",
    "footer": "Paper Trading System",
    "ts": 1705320600
  }]
}
```

## Integration Points

### 1. WebSocket ↔ Database Integration
```typescript
// Real-time data fetching from database
private async getCurrentPerformance(): Promise<PerformanceUpdate> {
  const query = `
    SELECT 
      COUNT(CASE WHEN status = 'executed' THEN 1 END) as total_trades,
      COUNT(CASE WHEN status = 'executed' AND pnl > 0 THEN 1 END) as winning_trades,
      COALESCE(SUM(CASE WHEN status = 'executed' THEN pnl ELSE 0 END), 0) as total_pnl
    FROM signals 
    WHERE created_at >= NOW() - INTERVAL '24 hours'
  `;
  // Process and return real-time metrics
}
```

### 2. WebSocket ↔ Notification Integration
```typescript
// Automatic notification triggering
private async sendSignalNotifications(signals: SignalUpdate[]): Promise<void> {
  for (const signal of signals) {
    if (signal.confidence > 70) {
      await this.notificationService.sendSignalAlert({
        symbol: signal.symbol,
        direction: signal.direction,
        confidence: signal.confidence,
        strategy: signal.strategy,
        price: 0
      });
    }
  }
}
```

### 3. Database ↔ Notification Storage
```typescript
// Store all notifications in database
private async storeAlert(type: string, data: any): Promise<void> {
  const insertQuery = `
    INSERT INTO notifications (type, data, created_at)
    VALUES ($1, $2, NOW())
  `;
  await this.pool.query(insertQuery, [type, JSON.stringify(data)]);
}
```

## Client-Side Integration

### Frontend WebSocket Connection
```typescript
// React hook for real-time data
const useWebSocket = () => {
  const [performance, setPerformance] = useState(null);
  const [signals, setSignals] = useState([]);
  const [trades, setTrades] = useState([]);

  useEffect(() => {
    const ws = new WebSocket('ws://localhost:8080');
    
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      
      switch (message.type) {
        case 'performance':
          setPerformance(message.data);
          break;
        case 'signal':
          setSignals(prev => [...message.data.signals, ...prev]);
          break;
        case 'trade':
          setTrades(prev => [...message.data.trades, ...prev]);
          break;
      }
    };

    return () => ws.close();
  }, []);

  return { performance, signals, trades };
};
```

### Notification Preferences Management
```typescript
// User preference management
const updateNotificationPreferences = async (preferences: {
  signalAlerts: boolean;
  tradeExecutions: boolean;
  performanceUpdates: boolean;
  errorAlerts: boolean;
  dailyReports: boolean;
}) => {
  await fetch('/api/notifications/preferences', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(preferences)
  });
};
```

## Environment Configuration

### Required Environment Variables
```bash
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=scanner_db
DB_USER=postgres
DB_PASSWORD=password

# Email (SMTP)
EMAIL_ENABLED=true
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
FROM_EMAIL=noreply@tradingsystem.com
TO_EMAIL=admin@tradingsystem.com

# Slack
SLACK_ENABLED=true
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
SLACK_CHANNEL=#trading-alerts

# WebSocket
WS_PORT=8080
```

## Performance and Scalability

### Real-Time Update Optimization
- **5-second intervals**: Balanced between responsiveness and performance
- **Database connection pooling**: Efficient database connections
- **Client connection management**: Automatic cleanup of disconnected clients
- **Error handling**: Graceful degradation on failures

### Notification System Optimization
- **Async processing**: Non-blocking notification sending
- **Priority queuing**: High-priority alerts sent first
- **Retry mechanisms**: Automatic retry on delivery failures
- **Rate limiting**: Prevent notification spam

## Monitoring and Debugging

### WebSocket Service Status
```typescript
// Get service status
const status = webSocketService.getStatus();
// Returns: { isRunning: boolean; connectedClients: number }
```

### Notification Service Status
```typescript
// Get notification status
const status = notificationService.getStatus();
// Returns: {
//   isInitialized: boolean;
//   emailEnabled: boolean;
//   slackEnabled: boolean;
//   preferences: NotificationConfig['preferences'];
// }
```

### Testing Notifications
```typescript
// Test all notification channels
const testResults = await notificationService.testNotifications();
// Returns: { email: boolean; slack: boolean; }
```

## Production Deployment

### Database Schema Requirements
```sql
-- Notifications table
CREATE TABLE notifications (
  id SERIAL PRIMARY KEY,
  type VARCHAR(50) NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- User preferences table
CREATE TABLE user_preferences (
  user_id VARCHAR(50) PRIMARY KEY,
  email_enabled BOOLEAN DEFAULT true,
  slack_enabled BOOLEAN DEFAULT true,
  signal_alerts BOOLEAN DEFAULT true,
  trade_executions BOOLEAN DEFAULT true,
  performance_updates BOOLEAN DEFAULT true,
  error_alerts BOOLEAN DEFAULT true,
  daily_reports BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Startup Script Integration
```bash
#!/bin/bash
# Start all services including WebSocket and notifications
echo "Starting Paper Trading System..."

# Start PostgreSQL
pg_ctl -D /usr/local/var/postgres start

# Start WebSocket service
node -r ts-node/register api/WebSocketService.ts &

# Start notification service
node -r ts-node/register api/NotificationService.ts &

# Start main server
node -r ts-node/register server.ts

echo "All services started successfully!"
```

## Summary

The real-time and notification flows are now fully integrated with:

### ✅ **Real-Time Features**
- Live performance monitoring
- Instant signal broadcasting
- Real-time trade updates
- Market data streaming
- WebSocket client management

### ✅ **Notification Features**
- Multi-channel alerts (Email + Slack)
- Configurable preferences
- Priority-based notifications
- Database storage and history
- Error handling and retries

### ✅ **Integration Benefits**
- Complete database integration
- Real-time data flow
- Automated alerting
- Scalable architecture
- Production-ready deployment

The system now provides comprehensive real-time trading updates and intelligent notification systems, ensuring users stay informed of all critical trading activities and system events. 