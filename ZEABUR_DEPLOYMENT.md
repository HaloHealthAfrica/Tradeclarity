# 🚀 Zeabur Deployment Guide

## Quick Deploy to Zeabur

Your Paper Trading System is now configured for Zeabur deployment using the simple server approach to avoid build issues.

## 📋 Prerequisites

1. **Zeabur Account** - Sign up at [zeabur.com](https://zeabur.com)
2. **Git Repository** - Your code should be in a Git repository (GitHub, GitLab, etc.)
3. **Environment Variables** - API keys for trading services (optional for demo)

## 🚀 Step-by-Step Deployment

### 1. Prepare Your Repository

Make sure these files are in your repository:
- ✅ `zeabur.toml` - Zeabur configuration
- ✅ `Dockerfile.zeabur` - Zeabur-specific Dockerfile
- ✅ `server-simple.ts` - Simple server (updated for port 8080)
- ✅ `package.json` - With `start:simple` script
- ✅ `types/` directory - Type definitions
- ✅ `utils/` directory - Logger utilities

### 2. Connect to Zeabur

1. **Go to Zeabur Dashboard**
   - Visit [zeabur.com](https://zeabur.com)
   - Sign in to your account

2. **Create New Project**
   - Click "New Project"
   - Select "Deploy from Git"
   - Connect your Git repository

3. **Select Repository**
   - Choose your Paper Trading System repository
   - Zeabur will automatically detect it's a Node.js project

### 3. Configure Environment Variables

In the Zeabur dashboard, add these environment variables:

```bash
# Required for production
NODE_ENV=production
PORT=8080

# Optional (for demo mode if not set)
TWELVEDATA_API_KEY=your_twelvedata_key_here
ALPACA_API_KEY=your_alpaca_key_here
ALPACA_API_SECRET=your_alpaca_secret_here
JWT_SECRET=your_jwt_secret_here
```

### 4. Deploy

1. **Click "Deploy"**
   - Zeabur will use the `zeabur.toml` configuration
   - It will run `npm install` and `npm run start:simple`

2. **Monitor Deployment**
   - Watch the build logs
   - Check for any errors
   - Wait for deployment to complete

## 🔧 Configuration Files

### zeabur.toml
```toml
[build]
builder = "nodejs"
buildCommand = "npm install"
startCommand = "npm run start:simple"

[deploy]
healthCheckPath = "/health"
healthCheckInterval = 30
healthCheckTimeout = 10
healthCheckRetries = 3

[env]
NODE_ENV = "production"
PORT = "8080"
```

### Dockerfile.zeabur
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN mkdir -p logs
EXPOSE 8080
CMD ["npm", "run", "start:simple"]
```

## 🧪 Testing Your Deployment

### 1. Health Check
```bash
curl https://your-app.zeabur.app/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2025-07-15T00:00:00.000Z",
  "uptime": 123.456,
  "memory": {...},
  "version": "1.0.0"
}
```

### 2. API Status
```bash
curl https://your-app.zeabur.app/api/status
```

Expected response:
```json
{
  "system": "Paper Trading System",
  "status": "running",
  "environment": "production",
  "timestamp": "2025-07-15T00:00:00.000Z"
}
```

### 3. Trading Status
```bash
curl https://your-app.zeabur.app/api/trading/status
```

## 🛠️ Troubleshooting

### Issue: Build Fails
**Solution**: The simple server approach should avoid build issues
- Check that `server-simple.ts` exists
- Verify `npm run start:simple` works locally
- Check environment variables are set

### Issue: Port Issues
**Solution**: Zeabur uses port 8080
- Make sure `PORT=8080` is set
- Check `server-simple.ts` uses `process.env.PORT || '8080'`

### Issue: Environment Variables
**Solution**: Set them in Zeabur dashboard
- Go to your project settings
- Add environment variables
- Redeploy if needed

### Issue: Health Check Fails
**Solution**: Check the `/health` endpoint
- Verify the server is running
- Check logs in Zeabur dashboard
- Ensure all dependencies are installed

## 📊 Monitoring

### Zeabur Dashboard
- **Logs**: View real-time application logs
- **Metrics**: Monitor CPU, memory, and network usage
- **Deployments**: Track deployment history
- **Environment**: Manage environment variables

### Health Monitoring
- **Automatic**: Zeabur checks `/health` endpoint
- **Manual**: Test endpoints manually
- **Alerts**: Set up notifications for failures

## 🔄 Continuous Deployment

### Automatic Deployments
- **Git Push**: Deploy on every push to main branch
- **Manual**: Deploy from Zeabur dashboard
- **Rollback**: Revert to previous deployment if needed

### Environment Management
- **Development**: Use different environment variables
- **Production**: Secure API keys and secrets
- **Staging**: Test before production deployment

## 🚀 Advanced Configuration

### Custom Domain
1. **Add Domain**: In Zeabur dashboard
2. **Configure DNS**: Point to Zeabur
3. **SSL**: Automatic HTTPS certificate

### Environment Variables
```bash
# Production
NODE_ENV=production
PORT=8080
TWELVEDATA_API_KEY=prod_key
ALPACA_API_KEY=prod_key
ALPACA_API_SECRET=prod_secret

# Development
NODE_ENV=development
PORT=8080
TWELVEDATA_API_KEY=dev_key
ALPACA_API_KEY=dev_key
ALPACA_API_SECRET=dev_secret
```

### Scaling
- **Automatic**: Zeabur scales based on traffic
- **Manual**: Set minimum/maximum instances
- **Monitoring**: Watch resource usage

## ✅ Success Checklist

Your Zeabur deployment is successful when:

1. ✅ **Build completes** without errors
2. ✅ **Health check passes** (`/health` returns 200)
3. ✅ **API endpoints work** (`/api/status` accessible)
4. ✅ **Logs show startup** without errors
5. ✅ **Environment variables** are set correctly
6. ✅ **Custom domain** works (if configured)

## 🎯 Next Steps

1. **Deploy to Zeabur** using the guide above
2. **Test all endpoints** to ensure functionality
3. **Monitor performance** in Zeabur dashboard
4. **Add custom domain** for production use
5. **Set up alerts** for monitoring
6. **Gradually add features** once basic system is stable

## 🆘 Support

If you encounter issues:

1. **Check Zeabur logs** in the dashboard
2. **Verify environment variables** are set
3. **Test locally** with `npm run start:simple`
4. **Check Zeabur documentation** at [docs.zeabur.com](https://docs.zeabur.com)
5. **Contact Zeabur support** if needed

---

**⚠️ Important**: This is a paper trading system for educational purposes. Never use real money without proper testing and risk management. 