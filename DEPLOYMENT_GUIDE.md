# 🚀 Deployment Guide

## Quick Fix for System Crashes

Your system is crashing during deployment due to **TypeScript compilation errors**. Here's how to fix it:

### 1. Environment Setup

```bash
# Copy environment template
cp env.example .env

# Edit .env file with your API keys
# Required variables:
# - TWELVEDATA_API_KEY
# - ALPACA_API_KEY  
# - ALPACA_API_SECRET
# - JWT_SECRET
# - DATABASE_URL
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Build the Project

```bash
npm run build
```

### 4. Start the System

```bash
# Development mode
npm run dev

# Production mode  
npm start

# All services
npm run start:all
```

## Common Issues & Solutions

### ❌ Build Errors

**Problem**: TypeScript compilation fails
**Solution**: 
1. Check that all required environment variables are set
2. Ensure all dependencies are installed
3. Run `npm run build` to see specific errors

### ❌ Missing API Keys

**Problem**: System crashes on startup
**Solution**:
1. Get API keys from:
   - TwelveData: https://twelvedata.com/
   - Alpaca: https://alpaca.markets/
2. Add them to your `.env` file

### ❌ Database Connection Issues

**Problem**: Can't connect to database
**Solution**:
1. Start PostgreSQL: `npm run start:database`
2. Or use Docker: `docker-compose up postgres`

### ❌ WebSocket Connection Issues

**Problem**: Real-time data not working
**Solution**:
1. Verify TwelveData API key is valid
2. Check network connectivity
3. Review WebSocket URL in config

## Deployment Options

### Option 1: Local Development
```bash
npm run dev
```

### Option 2: Production Mode
```bash
npm start
```

### Option 3: Docker Deployment
```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f
```

### Option 4: Microservices
```bash
# Start individual services
npm run start:gateway
npm run start:scanner
npm run start:database
npm run start:notification
npm run start:marketdata
npm run start:auth
```

## Health Checks

### Check System Status
```bash
# View logs
tail -f logs/system.log

# Check running processes
ps aux | grep node
```

### Monitor Performance
- Check CPU usage
- Monitor memory consumption
- Review error logs

## Troubleshooting

### If System Still Crashes:

1. **Check Logs**:
   ```bash
   tail -f logs/system.log
   ```

2. **Verify Environment**:
   ```bash
   node deploy-check.js
   ```

3. **Test Individual Components**:
   ```bash
   npm test
   ```

4. **Reset and Rebuild**:
   ```bash
   rm -rf dist node_modules
   npm install
   npm run build
   ```

### Emergency Recovery

If the system is completely down:

1. **Stop all processes**:
   ```bash
   pkill -f node
   ```

2. **Clear cache**:
   ```bash
   rm -rf cache/*
   ```

3. **Restart fresh**:
   ```bash
   npm run start:all
   ```

## Production Checklist

- [ ] Environment variables configured
- [ ] API keys valid and working
- [ ] Database running and accessible
- [ ] All services building successfully
- [ ] Tests passing
- [ ] Logs being written
- [ ] Health checks responding

## Support

If you're still experiencing issues:

1. Check the logs in `logs/` directory
2. Run `npm test` to verify functionality
3. Review the error messages from `npm run build`
4. Ensure all required services are running

---

**⚠️ Important**: This is a paper trading system for educational purposes. Never use real money without proper testing and risk management. 