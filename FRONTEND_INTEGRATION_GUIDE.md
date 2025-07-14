# Frontend Integration Guide

## Overview

This guide explains how the React TypeScript frontend integrates with the backend microservices architecture for the Paper Trading System.

## Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   API Gateway   │    │  Microservices  │
│   (React)       │◄──►│   (Express)     │◄──►│  (Node.js)      │
│   Port: 3000    │    │   Port: 3000    │    │  Ports: 3001-5  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │   WebSocket     │
                       │   (Real-time)   │
                       │   Port: 3000    │
                       └─────────────────┘
```

## Frontend Components

### 1. API Service Layer (`frontend/src/services/api.ts`)
- **Purpose**: Handles all HTTP communication with backend
- **Features**:
  - Automatic token management
  - Request/response interceptors
  - Error handling and retry logic
  - Type-safe API calls

### 2. WebSocket Service (`frontend/src/services/websocket.ts`)
- **Purpose**: Real-time data streaming
- **Features**:
  - Automatic reconnection
  - Message type handling
  - Connection state management
  - Authentication integration

### 3. Context Providers
- **AuthContext**: User authentication and session management
- **TradingContext**: Trading data and real-time updates
- **ThemeContext**: Dark/light mode management

## Backend Integration

### API Gateway (`api/gateway.ts`)
- **Purpose**: Single entry point for all frontend requests
- **Features**:
  - Request routing to microservices
  - JWT authentication
  - Rate limiting
  - CORS handling
  - WebSocket proxying

### Microservices Architecture
1. **Scanner Service** (Port 3001): Pattern detection and scanning
2. **Database Service** (Port 3002): User data and trading records
3. **Notification Service** (Port 3003): Email/Slack notifications
4. **Market Data Service** (Port 3004): Real-time market data
5. **Auth Service** (Port 3005): User authentication

## Environment Setup

### 1. Install Dependencies

```bash
# Backend dependencies
npm install

# Frontend dependencies
cd frontend
npm install
```

### 2. Environment Configuration

Copy `env.example` to `.env` and configure:

```bash
# API Keys
TWELVEDATA_API_KEY=your_key_here
ALPACA_API_KEY=your_key_here
ALPACA_API_SECRET=your_secret_here

# JWT Secret
JWT_SECRET=your_jwt_secret_here

# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/scanner_db
REDIS_URL=redis://localhost:6379

# Service URLs
SCANNER_SERVICE_URL=http://localhost:3001
DATABASE_SERVICE_URL=http://localhost:3002
NOTIFICATION_SERVICE_URL=http://localhost:3003
MARKET_DATA_SERVICE_URL=http://localhost:3004
AUTH_SERVICE_URL=http://localhost:3005

# Frontend
FRONTEND_URL=http://localhost:3000
```

### 3. Database Setup

```bash
# Start PostgreSQL and Redis
docker-compose up postgres redis -d

# Run database migrations
npm run database:migrate
```

## Development Workflow

### 1. Start Backend Services

```bash
# Start all services
npm run docker:up

# Or start individually
npm run gateway
npm run scanner
npm run database
```

### 2. Start Frontend

```bash
cd frontend
npm start
```

### 3. Access the Application

- **Frontend**: http://localhost:3000
- **API Gateway**: http://localhost:3000/api
- **WebSocket**: ws://localhost:3000/ws

## API Endpoints

### Authentication
- `POST /auth/login` - User login
- `POST /auth/register` - User registration
- `POST /auth/logout` - User logout
- `GET /auth/me` - Get current user

### Trading
- `GET /trading/metrics` - Trading performance metrics
- `GET /trading/strategies` - Active strategies
- `GET /trading/signals` - Recent trading signals

### Scanner
- `GET /scanner/results` - Scanner results
- `POST /scanner/start` - Start scanner
- `POST /scanner/stop` - Stop scanner
- `GET /scanner/status` - Scanner status

### Watchlist
- `GET /watchlist` - User watchlist
- `POST /watchlist` - Add to watchlist
- `DELETE /watchlist/:symbol` - Remove from watchlist

### Portfolio
- `GET /portfolio` - User portfolio

## WebSocket Events

### Trading Updates
```typescript
{
  type: 'trading_update',
  data: {
    symbol: 'AAPL',
    price: 150.25,
    change: 2.50,
    changePercent: 1.67,
    volume: 1000000,
    timestamp: '2024-01-01T12:00:00Z'
  }
}
```

### Signal Updates
```typescript
{
  type: 'signal_update',
  data: {
    id: 'signal_123',
    symbol: 'AAPL',
    type: 'BUY',
    strategy: 'EMAConfluence',
    price: 150.25,
    confidence: 0.85,
    timestamp: '2024-01-01T12:00:00Z'
  }
}
```

### Scanner Updates
```typescript
{
  type: 'scanner_update',
  data: {
    symbol: 'AAPL',
    pattern: 'Bull Flag',
    confidence: 0.92,
    price: 150.25,
    volume: 1000000,
    timestamp: '2024-01-01T12:00:00Z'
  }
}
```

## Error Handling

### Frontend Error Handling
- Network errors with retry logic
- Authentication errors with automatic logout
- API errors with user-friendly messages
- WebSocket connection errors with reconnection

### Backend Error Handling
- Circuit breaker pattern for service failures
- Rate limiting for API abuse prevention
- JWT token validation and refresh
- Graceful degradation for service outages

## Security Features

### Authentication
- JWT-based authentication
- Token refresh mechanism
- Secure password hashing
- Session management

### API Security
- CORS configuration
- Rate limiting
- Input validation
- SQL injection prevention
- XSS protection

### WebSocket Security
- Authentication on connection
- Message validation
- Connection rate limiting

## Performance Optimization

### Frontend
- React.memo for component optimization
- useMemo and useCallback for expensive operations
- Lazy loading for routes
- Image optimization

### Backend
- Redis caching for frequently accessed data
- Database connection pooling
- Request compression
- Response caching

## Monitoring and Logging

### Frontend Monitoring
- Error boundary for React errors
- Performance monitoring
- User interaction tracking
- Network request monitoring

### Backend Monitoring
- Request/response logging
- Error tracking
- Performance metrics
- Service health checks

## Deployment

### Docker Deployment
```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Production Configuration
1. Set `NODE_ENV=production`
2. Configure SSL certificates
3. Set up monitoring (Prometheus/Grafana)
4. Configure load balancing
5. Set up backup strategies

## Testing

### Frontend Testing
```bash
cd frontend
npm test
```

### Backend Testing
```bash
npm test
```

### Integration Testing
```bash
# Test API endpoints
npm run test:api

# Test WebSocket connections
npm run test:websocket
```

## Troubleshooting

### Common Issues

1. **CORS Errors**
   - Check `FRONTEND_URL` in environment
   - Verify CORS configuration in gateway

2. **WebSocket Connection Failed**
   - Check WebSocket service is running
   - Verify WebSocket URL configuration
   - Check firewall settings

3. **Authentication Errors**
   - Verify JWT_SECRET is set
   - Check token expiration
   - Validate user credentials

4. **Database Connection Issues**
   - Verify PostgreSQL is running
   - Check DATABASE_URL configuration
   - Validate database permissions

### Debug Mode
```bash
# Enable debug logging
LOG_LEVEL=DEBUG npm run dev

# Frontend debug mode
cd frontend
REACT_APP_DEBUG=true npm start
```

## Future Enhancements

1. **Real-time Charts**: Integrate TradingView charts
2. **Mobile App**: React Native mobile application
3. **Advanced Analytics**: Machine learning insights
4. **Social Features**: User sharing and following
5. **Multi-language**: Internationalization support
6. **Advanced Notifications**: Push notifications
7. **Backtesting**: Historical strategy testing
8. **Paper Trading**: Simulated trading environment

## Support

For issues and questions:
1. Check the troubleshooting section
2. Review the logs in `logs/` directory
3. Verify environment configuration
4. Test individual services
5. Check network connectivity

## Contributing

1. Follow the existing code structure
2. Add proper TypeScript types
3. Include error handling
4. Write tests for new features
5. Update documentation
6. Follow security best practices 