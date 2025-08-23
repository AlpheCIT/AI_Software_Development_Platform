@echo off
echo ========================================
echo AI Software Development Platform - Development
echo ========================================
echo.

REM Check if Docker is running
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Docker is not installed or not running!
    echo Please install Docker Desktop and ensure it's running.
    pause
    exit /b 1
)

echo Starting infrastructure services (ArangoDB, Redis)...
docker-compose up -d arangodb redis

echo.
echo Waiting for database services to be ready...
timeout /t 10 /nobreak >nul

echo.
echo Starting WebSocket service...
cd "%~dp0..\services\websocket"
start "WebSocket Service" cmd /k "npm run dev"

echo.
echo Starting Frontend Dashboard...
cd "%~dp0..\apps\web-dashboard"
start "Web Dashboard" cmd /k "npm run dev"

echo.
echo ========================================
echo Development Environment Started!
echo ========================================
echo.
echo Services:
echo - ArangoDB:       http://localhost:8529
echo - Redis:          localhost:6379
echo - WebSocket:      http://localhost:4001
echo - Frontend:       http://localhost:5173
echo.
echo Press any key to view logs or Ctrl+C to stop services...
pause >nul

echo.
echo Viewing Docker logs...
docker-compose logs -f arangodb redis
