#!/bin/bash

# 🚀 Zeabur Deployment Script for Paper Trading System

echo "🚀 Starting Zeabur deployment..."

# Check if git is initialized
if [ ! -d ".git" ]; then
    echo "❌ Git repository not found. Please initialize git first:"
    echo "   git init"
    echo "   git add ."
    echo "   git commit -m 'Initial commit'"
    echo "   git remote add origin <your-repo-url>"
    echo "   git push -u origin main"
    exit 1
fi

# Check if all required files exist
echo "📋 Checking required files..."

required_files=(
    "zeabur.toml"
    "Dockerfile.zeabur"
    "server-simple.ts"
    "package.json"
    "types/shared.ts"
    "types/storage.ts"
    "utils/logger.ts"
)

for file in "${required_files[@]}"; do
    if [ ! -f "$file" ]; then
        echo "❌ Missing required file: $file"
        exit 1
    fi
done

echo "✅ All required files found"

# Check if server works locally
echo "🧪 Testing server locally..."
npm run start:simple &
SERVER_PID=$!

# Wait for server to start
sleep 5

# Test health endpoint
if curl -s http://localhost:8080/health > /dev/null; then
    echo "✅ Server is working locally"
else
    echo "❌ Server failed to start locally"
    kill $SERVER_PID 2>/dev/null
    exit 1
fi

# Stop local server
kill $SERVER_PID 2>/dev/null

echo ""
echo "🎯 Ready for Zeabur deployment!"
echo ""
echo "📋 Next steps:"
echo "1. Push your code to Git repository:"
echo "   git add ."
echo "   git commit -m 'Configure for Zeabur deployment'"
echo "   git push"
echo ""
echo "2. Go to Zeabur dashboard:"
echo "   https://zeabur.com"
echo ""
echo "3. Create new project and connect your repository"
echo ""
echo "4. Set environment variables in Zeabur:"
echo "   NODE_ENV=production"
echo "   PORT=8080"
echo "   TWELVEDATA_API_KEY=your_key (optional)"
echo "   ALPACA_API_KEY=your_key (optional)"
echo "   ALPACA_API_SECRET=your_secret (optional)"
echo ""
echo "5. Deploy and test endpoints:"
echo "   https://your-app.zeabur.app/health"
echo "   https://your-app.zeabur.app/api/status"
echo ""
echo "✅ Deployment configuration complete!" 