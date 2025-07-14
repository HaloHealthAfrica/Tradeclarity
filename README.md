# 📈 Paper Trading System

A modular, TypeScript-based automated paper trading system that integrates with TwelveData for real-time market data and Alpaca's Paper Trading API for simulated trades. Built for event-driven strategy execution with comprehensive risk management and performance tracking.

## 🚀 Features

- **Real-time Market Data**: WebSocket integration with TwelveData for live price feeds
- **Paper Trading**: Safe simulation using Alpaca's Paper Trading API
- **Modular Architecture**: Clean separation of concerns with 9 core services
- **Risk Management**: Built-in position sizing, daily loss limits, and drawdown protection
- **Multi-Strategy Support**: Run up to 9 independent trading strategies simultaneously
- **Comprehensive Logging**: Structured logging with different levels and module tracking
- **Health Monitoring**: Real-time system health checks and performance metrics
- **Type Safety**: Full TypeScript implementation with strict type checking

## 🏗️ Architecture

### Core Services

| Service | Purpose | Key Features |
|---------|---------|--------------|
| **HistoricalCache** | In-memory candle data management | TTL-based expiration, automatic trimming |
| **WebSocketClient** | Real-time data streaming | Auto-reconnection, error handling |
| **StreamRouter** | Event distribution | Pub-sub pattern, module tracking |
| **StrategyRunner** | Strategy lifecycle management | Multi-strategy support, enable/disable |
| **TradeOrchestrator** | Signal processing & risk management | Risk checks, PnL tracking |
| **PositionTracker** | Position management | Real-time PnL, position sizing |
| **TradeManager** | Order execution | Error handling, trade validation |
| **AlpacaClient** | Broker integration | Paper trading API integration |
| **Logger** | System observability | Structured logging, performance tracking |

### Data Flow

```
TwelveData WebSocket → StreamRouter → StrategyRunner → TradeOrchestrator → Alpaca API
                                    ↓
HistoricalCache ← REST API ← DataManager
```

## 📦 Installation

### Prerequisites

- Node.js 18+ 
- TypeScript 5.2+
- TwelveData API key
- Alpaca Paper Trading API credentials

### Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd PaperTradingSystem
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```

   Edit `.env` with your API keys:
   ```env
   # Required API Keys
   TWELVEDATA_API_KEY=your_twelvedata_api_key
   ALPACA_API_KEY=your_alpaca_api_key
   ALPACA_API_SECRET=your_alpaca_api_secret

   # Optional Configuration
   LOG_LEVEL=INFO
   TRADING_SYMBOLS=AAPL,MSFT,GOOGL,TSLA
   TRADING_INTERVALS=1m,5m,15m
   MAX_POSITION_SIZE=10000
   MAX_DAILY_LOSS=1000
   MAX_DRAWDOWN=0.1
   ```

4. **Build the project**
   ```bash
   npm run build
   ```

## 🚀 Usage

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start in development mode with ts-node |
| `npm start` | Start in production mode |
| `npm run build` | Compile TypeScript to JavaScript |
| `npm test` | Run test suite |
| `npm run lint` | Run ESLint |
| `npm run format` | Format code with Prettier |

## 🔧 Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `TWELVEDATA_API_KEY` | ✅ | - | TwelveData API key |
| `ALPACA_API_KEY` | ✅ | - | Alpaca API key |
| `ALPACA_API_SECRET` | ✅ | - | Alpaca API secret |
| `LOG_LEVEL` | ❌ | `INFO` | Logging level (DEBUG, INFO, WARN, ERROR, FATAL) |
| `TRADING_SYMBOLS` | ❌ | `AAPL,MSFT,GOOGL,TSLA` | Comma-separated symbols |
| `TRADING_INTERVALS` | ❌ | `1m,5m,15m` | Comma-separated timeframes |
| `MAX_POSITION_SIZE` | ❌ | `10000` | Maximum position size in USD |
| `MAX_DAILY_LOSS` | ❌ | `1000` | Maximum daily loss in USD |
| `MAX_DRAWDOWN` | ❌ | `0.1` | Maximum drawdown as decimal |

### Strategy Configuration

Strategies are configured via environment variables or the `STRATEGY_CONFIG` JSON string:

```json
[
  {
    "name": "EMAConfluence",
    "symbols": ["AAPL", "MSFT"],
    "intervals": ["5m", "15m"],
    "enabled": true,
    "parameters": {
      "fastEma": 9,
      "slowEma": 21,
      "rsiPeriod": 14
    }
  }
]
```

## 📊 Monitoring

### Health Checks

The system performs automatic health checks every 30 seconds, monitoring:

- WebSocket connection status
- Active strategies
- Open positions and PnL
- Cache performance
- Risk metrics

### Logging

Structured logging with different levels:

```typescript
import { createModuleLogger } from './utils/logger';

const logger = createModuleLogger('MyStrategy');

logger.info('Strategy initialized', { symbols: ['AAPL'] });
logger.debug('Processing candle', { price: 150.25 });
logger.warn('Low confidence signal', { confidence: 0.3 });
logger.error('Trade failed', error, { symbol: 'AAPL' });
```

### Performance Metrics

- **Cache Hit Rate**: Historical data cache performance
- **Signal Quality**: Strategy signal confidence distribution
- **Trade Success Rate**: Order execution success rate
- **Risk Metrics**: Daily PnL, drawdown, position exposure

## 🛡️ Risk Management

### Built-in Protections

- **Daily Loss Limits**: Automatic trading halt on daily loss threshold
- **Position Size Limits**: Maximum position value per symbol
- **Drawdown Protection**: Stop trading on maximum drawdown breach
- **Signal Quality Filtering**: Minimum confidence thresholds
- **Duplicate Position Prevention**: Avoid multiple positions per symbol

### Risk Metrics

```typescript
const riskMetrics = tradeOrchestrator.getRiskMetrics();
// {
//   dailyPnL: -250.50,
//   maxDailyLoss: 1000,
//   maxPositionSize: 10000,
//   maxDrawdown: 0.1,
//   currentDrawdown: 0.025
// }
```

## 🔌 Extending the System

### Adding New Strategies

1. **Implement the Strategy interface**:
   ```typescript
   import { Strategy, Candle, TradeSignal } from '../types';

   export class MyStrategy implements Strategy {
     name = 'MyStrategy';
     symbols = ['AAPL'];
     intervals = ['5m'];
     enabled = true;

     async initialize(): Promise<void> {
       // Setup strategy
     }

     async onCandle(candle: Candle): Promise<TradeSignal | null> {
       // Generate signals
       return {
         symbol: candle.symbol,
         direction: 'LONG',
         confidence: 0.8,
         strategy: this.name,
         timestamp: Date.now()
       };
     }

     async cleanup(): Promise<void> {
       // Cleanup resources
     }
   }
   ```

2. **Register the strategy**:
   ```typescript
   import { strategyRunner } from './engine/StrategyRunner';
   import { MyStrategy } from './strategies/MyStrategy';

   const strategy = new MyStrategy();
   await strategyRunner.registerStrategy(strategy);
   ```

### Adding New Data Sources

1. **Create a new data client**:
   ```typescript
   import { Candle } from '../types';

   export class NewDataClient {
     async connect(): Promise<void> {
       // Connect to data source
     }

     async subscribe(symbols: string[]): Promise<void> {
       // Subscribe to symbols
     }

     onData(callback: (candle: Candle) => void): void {
       // Handle incoming data
     }
   }
   ```

2. **Integrate with StreamRouter**:
   ```typescript
   import { streamRouter } from './data/twelvedataClient/streamRouter';

   dataClient.onData((candle) => {
     streamRouter.notify(candle.symbol, candle.interval, candle);
   });
   ```

## 🧪 Testing

### Running Tests
```bash
npm test
```

### Test Structure
- **Unit Tests**: Individual component testing
- **Integration Tests**: Service interaction testing
- **Strategy Tests**: Strategy logic validation
- **Risk Tests**: Risk management validation

## 🚀 Deployment

### Docker Deployment

```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY dist ./dist
COPY .env ./

EXPOSE 3000
CMD ["npm", "start"]
```

### Environment-Specific Configs

```bash
# Development
npm run dev

# Production
NODE_ENV=production npm start

# Docker
docker build -t paper-trading-system .
docker run -p 3000:3000 paper-trading-system
```

## 📈 Performance Optimization

### Caching Strategy
- **Historical Data**: TTL-based cache with automatic trimming
- **Strategy State**: In-memory state management
- **API Responses**: Cached broker responses

### Memory Management
- **Stream Processing**: Event-driven architecture
- **Position Tracking**: Efficient data structures
- **Log Rotation**: Automatic log cleanup

## 🔒 Security

### API Key Management
- Environment variable storage
- No hardcoded credentials
- Secure API key rotation

### Data Protection
- No sensitive data logging
- Encrypted API communications
- Secure WebSocket connections

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Implement your changes
4. Add tests
5. Submit a pull request

### Code Style
- TypeScript strict mode
- ESLint configuration
- Prettier formatting
- Comprehensive error handling

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Support

### Common Issues

**WebSocket Connection Issues**
- Check TwelveData API key validity
- Verify network connectivity
- Review WebSocket URL configuration

**Trade Execution Failures**
- Verify Alpaca API credentials
- Check account permissions
- Review order parameters

**Strategy Performance**
- Monitor signal quality metrics
- Review risk management settings
- Check market data quality

### Getting Help

- **Issues**: Create GitHub issues for bugs
- **Discussions**: Use GitHub Discussions for questions
- **Documentation**: Check inline code documentation

---

**⚠️ Disclaimer**: This is a paper trading system for educational purposes. Never use real money without proper testing and risk management.