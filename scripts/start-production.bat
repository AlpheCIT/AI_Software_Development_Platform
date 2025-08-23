@echo off
echo ========================================
echo AI Software Development Platform - Production
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

echo Building and starting all services...
docker-compose up --build -d

echo.
echo Waiting for all services to start...
timeout /t 30 /nobreak >nul

echo.
echo ========================================
echo Production Environment Started!
echo ========================================
echo.
echo Services:
echo - Frontend:       http://localhost:3000
echo - API Gateway:    http://localhost:8000
echo - WebSocket:      http://localhost:4001
echo - ArangoDB:       http://localhost:8529
echo - Redis:          localhost:6379
echo.
echo Health Checks:
echo - API:            http://localhost:8000/api/system/health
echo - WebSocket:      http://localhost:4001/health
echo.
echo Press any key to view service logs...
pause >nul

echo.
echo Viewing service logs (Ctrl+C to exit)...
docker-compose logs -f
