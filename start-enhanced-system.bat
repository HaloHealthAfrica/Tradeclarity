@echo off
echo Starting Enhanced Paper Trading System...
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Error: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

REM Check if npm is installed
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Error: npm is not installed
    pause
    exit /b 1
)

echo Installing dependencies...
npm install

echo.
echo Starting all services...

REM Start API Gateway (Port 3000)
echo Starting API Gateway on port 3000...
start "API Gateway" cmd /k "npm run start:gateway"

REM Start Scanner Service (Port 3001)
echo Starting Scanner Service on port 3001...
start "Scanner Service" cmd /k "npm run start:scanner"

REM Start Database Service (Port 3002)
echo Starting Database Service on port 3002...
start "Database Service" cmd /k "npm run start:database"

REM Start Notification Service (Port 3003)
echo Starting Notification Service on port 3003...
start "Notification Service" cmd /k "npm run start:notification"

REM Start Market Data Service (Port 3004)
echo Starting Market Data Service on port 3004...
start "Market Data Service" cmd /k "npm run start:marketdata"

REM Start Auth Service (Port 3005)
echo Starting Auth Service on port 3005...
start "Auth Service" cmd /k "npm run start:auth"

REM Start End-of-Day Analysis Service (Port 3006)
echo Starting Enhanced Analysis Service on port 3006...
start "Analysis Service" cmd /k "npm run start:analysis"

REM Wait a moment for services to start
timeout /t 5 /nobreak >nul

REM Start Frontend (Port 3007)
echo Starting Frontend on port 3007...
start "Frontend" cmd /k "npm run start:frontend"

echo.
echo All services are starting...
echo.
echo Service URLs:
echo - API Gateway: http://localhost:3000
echo - Scanner Service: http://localhost:3001
echo - Database Service: http://localhost:3002
echo - Notification Service: http://localhost:3003
echo - Market Data Service: http://localhost:3004
echo - Auth Service: http://localhost:3005
echo - Enhanced Analysis Service: http://localhost:3006
echo - Frontend: http://localhost:3007
echo.
echo Enhanced Analysis Features:
echo - Backtesting Engine
echo - Market Data Storage
echo - Algorithm Optimization
echo - Strategy Comparison
echo - Performance Analytics
echo - Data Quality Monitoring
echo.
echo System is ready! Open http://localhost:3007 in your browser
echo.
echo Press any key to close this window...
pause >nul 