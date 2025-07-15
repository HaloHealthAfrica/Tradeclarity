# Paper Trading System - Deployment Guide

## Overview
This guide covers deploying the integrated frontend-backend Paper Trading System to Zeabur.

## System Architecture
- **Backend**: Node.js/Express server serving API endpoints and React frontend
- **Frontend**: React application with TypeScript, built and served by the backend
- **Database**: PostgreSQL (optional, for production data storage)
- **Deployment**: Zeabur platform

## Pre-Deployment Checklist

### 1. Environment Variables
Ensure these environment variables are set in your Zeabur deployment:

```bash
# API Keys (optional for demo mode)
TWELVEDATA_API_KEY=your_twelvedata_key
ALPACA_API_KEY=your_alpaca_key
ALPACA_API_SECRET=your_alpaca_secret

# Server Configuration
PORT=8080
NODE_ENV=production
```

### 2. Frontend Configuration
The frontend is configured to use environment variables for API URLs:

- **Development**: `http://localhost:8080`
- **Production**: `https://your-zeabur-domain.zeabur.app`

## Deployment Steps

### 1. Build and Deploy to Zeabur

1. **Push your code to GitHub** (if not already done)
2. **Connect to Zeabur**:
   - Go to [Zeabur](https://zeabur.com)
   - Connect your GitHub repository
   - Select the repository

3. **Configure deployment**:
   - Use the custom Dockerfile
   - Set environment variables in Zeabur dashboard
   - Deploy

### 2. Verify Deployment

After deployment, verify these endpoints:

- **Frontend**: `https://your-domain.zeabur.app/`
- **Health Check**: `https://your-domain.zeabur.app/api/health`
- **Admin Panel**: `https://your-domain.zeabur.app/admin`

## File Structure

```
PaperTradingSystem/
├── server-simple.ts          # Main server file
├── server-simple.js          # Compiled server (production)
├── Dockerfile                # Docker configuration
├── frontend/
│   ├── build/               # Built React app (generated)
│   ├── src/
│   │   ├── components/      # React components
│   │   ├── pages/          # Page components
│   │   ├── services/       # API services
│   │   └── styles/         # CSS styles
│   └── package.json        # Frontend dependencies
└── package.json            # Backend dependencies
```

## API Endpoints

### Health & Status
- `GET /api/health` - System health check
- `GET /api/status` - System status
- `GET /api/trading/status` - Trading system status
- `GET /api/market/status` - Market data status

### Admin Panel
- `GET /api/admin/keys` - Get API key status
- `POST /api/admin/keys` - Update API keys
- `GET /api/admin/system` - System information

### Frontend Routes
- `/` - Dashboard (redirects to `/dashboard`)
- `/dashboard` - Main trading dashboard
- `/admin` - Admin panel
- `/scanner` - Market scanner
- `/analysis` - Trading analysis
- `/settings` - System settings

## Troubleshooting

### Common Issues

1. **Frontend not loading**:
   - Check if `frontend/build` directory exists
   - Verify static file serving in server configuration
   - Check browser console for errors

2. **API calls failing**:
   - Verify environment variables are set
   - Check API URL configuration in frontend
   - Ensure CORS is properly configured

3. **Build failures**:
   - Check TypeScript compilation errors
   - Verify all dependencies are installed
   - Check for missing environment variables

### Debug Commands

```bash
# Check if frontend build exists
ls -la frontend/build/

# Test server locally
npm run start:prod

# Check environment variables
echo $TWELVEDATA_API_KEY
echo $ALPACA_API_KEY
echo $ALPACA_API_SECRET
```

## Development vs Production

### Development
- Frontend runs on `http://localhost:3000`
- Backend runs on `http://localhost:8080`
- Uses proxy configuration for API calls

### Production
- Frontend and backend served from same domain
- Static files served by Express
- Environment variables control API URLs

## Security Considerations

1. **API Keys**: Store securely in environment variables
2. **CORS**: Configured for production domains
3. **HTTPS**: Zeabur provides SSL certificates
4. **Authentication**: Implement proper auth for production use

## Performance Optimization

1. **Frontend**: Built with production optimizations
2. **Static Files**: Served efficiently by Express
3. **Caching**: Implement appropriate caching headers
4. **Compression**: Enable gzip compression

## Monitoring

Monitor these metrics:
- Server response times
- API endpoint availability
- Frontend load times
- Error rates

## Support

For issues:
1. Check Zeabur deployment logs
2. Verify environment variables
3. Test endpoints individually
4. Check browser console for frontend errors

---

**Last Updated**: July 2024
**Version**: 1.0.0 