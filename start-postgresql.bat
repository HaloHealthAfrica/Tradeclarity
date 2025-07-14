@echo off
echo Starting Paper Trading System with PostgreSQL...

REM Check if PostgreSQL is running
echo Checking PostgreSQL status...
pg_isready -h localhost -p 5432 >nul 2>&1
if %errorlevel% neq 0 (
    echo PostgreSQL is not running. Starting PostgreSQL...
    net start postgresql-x64-15
    timeout /t 5 /nobreak >nul
)

REM Check if database exists
echo Checking database...
psql -h localhost -U postgres -d scanner_db -c "SELECT 1;" >nul 2>&1
if %errorlevel% neq 0 (
    echo Creating database...
    psql -h localhost -U postgres -c "CREATE DATABASE scanner_db;" >nul 2>&1
    echo Initializing database schema...
    psql -h localhost -U postgres -d scanner_db -f database/init.sql
)

REM Set environment variables
set DB_HOST=localhost
set DB_PORT=5432
set DB_NAME=scanner_db
set DB_USER=postgres
set DB_PASSWORD=password

REM Start the system
echo Starting services...
start "API Gateway" cmd /k "npm run start:gateway"
timeout /t 3 /nobreak >nul

start "Database Service" cmd /k "npm run start:database"
timeout /t 2 /nobreak >nul

start "Scanner Service" cmd /k "npm run start:scanner"
timeout /t 2 /nobreak >nul

start "Notification Service" cmd /k "npm run start:notification"
timeout /t 2 /nobreak >nul

start "Market Data Service" cmd /k "npm run start:marketdata"
timeout /t 2 /nobreak >nul

start "Auth Service" cmd /k "npm run start:auth"
timeout /t 2 /nobreak >nul

start "Analysis Service" cmd /k "npm run start:analysis"
timeout /t 2 /nobreak >nul

echo All services started successfully!
echo.
echo Services running:
echo - API Gateway: http://localhost:3000
echo - Database Service: http://localhost:3002
echo - Scanner Service: http://localhost:3001
echo - Notification Service: http://localhost:3003
echo - Market Data Service: http://localhost:3004
echo - Auth Service: http://localhost:3005
echo - Analysis Service: http://localhost:3006
echo.
echo PostgreSQL Database: localhost:5432/scanner_db
echo.
echo Press any key to stop all services...
pause >nul

REM Stop all services
taskkill /f /im node.exe >nul 2>&1
echo All services stopped. 