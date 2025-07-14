#!/bin/bash

# Paper Trading System - Integration Startup Script
# This script sets up and starts the complete frontend-backend integration

set -e

echo "🚀 Starting Paper Trading System Integration..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if .env file exists
if [ ! -f .env ]; then
    print_warning ".env file not found. Creating from template..."
    if [ -f env.example ]; then
        cp env.example .env
        print_success "Created .env file from template"
        print_warning "Please edit .env file with your API keys and configuration"
    else
        print_error "env.example not found. Please create .env file manually"
        exit 1
    fi
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js 18+ first"
    exit 1
fi

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    print_warning "Docker not found. Some services may not work properly"
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    print_warning "Docker Compose not found. Some services may not work properly"
fi

print_status "Installing backend dependencies..."
npm install

print_status "Installing frontend dependencies..."
cd frontend
npm install
cd ..

print_status "Building frontend..."
cd frontend
npm run build
cd ..

print_status "Starting database services..."
if command -v docker-compose &> /dev/null; then
    docker-compose up postgres redis -d
    print_success "Database services started"
else
    print_warning "Docker Compose not available. Please start PostgreSQL and Redis manually"
fi

print_status "Waiting for database to be ready..."
sleep 5

print_status "Starting backend services..."

# Start API Gateway
print_status "Starting API Gateway..."
npm run gateway &
GATEWAY_PID=$!

# Start Scanner Service
print_status "Starting Scanner Service..."
npm run scanner &
SCANNER_PID=$!

# Start Database Service
print_status "Starting Database Service..."
npm run database &
DATABASE_PID=$!

# Wait a moment for services to start
sleep 3

print_status "Starting frontend..."
cd frontend
npm start &
FRONTEND_PID=$!
cd ..

print_success "All services started successfully!"

echo ""
echo "📊 Paper Trading System is now running:"
echo "   • Frontend: http://localhost:3000"
echo "   • API Gateway: http://localhost:3000"
echo "   • WebSocket: ws://localhost:3000/ws"
echo ""
echo "🔧 Services running:"
echo "   • API Gateway (PID: $GATEWAY_PID)"
echo "   • Scanner Service (PID: $SCANNER_PID)"
echo "   • Database Service (PID: $DATABASE_PID)"
echo "   • Frontend (PID: $FRONTEND_PID)"
echo ""
echo "📝 To stop all services, run:"
echo "   pkill -f 'node.*gateway'"
echo "   pkill -f 'node.*scanner'"
echo "   pkill -f 'node.*database'"
echo "   pkill -f 'react-scripts'"
echo ""
echo "🐳 Or use Docker Compose:"
echo "   docker-compose down"
echo ""

# Function to handle script termination
cleanup() {
    print_status "Shutting down services..."
    
    # Kill background processes
    if [ ! -z "$GATEWAY_PID" ]; then
        kill $GATEWAY_PID 2>/dev/null || true
    fi
    if [ ! -z "$SCANNER_PID" ]; then
        kill $SCANNER_PID 2>/dev/null || true
    fi
    if [ ! -z "$DATABASE_PID" ]; then
        kill $DATABASE_PID 2>/dev/null || true
    fi
    if [ ! -z "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null || true
    fi
    
    print_success "All services stopped"
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

print_status "System is running. Press Ctrl+C to stop all services."

# Wait for user to stop
wait 