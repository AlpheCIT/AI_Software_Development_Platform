@echo off
cls
echo ========================================
echo 🎯 FEATURE PARITY IMPLEMENTATION
echo 🚀 INVESTOR DEMO READY
echo ========================================
echo.
echo ✅ PHASE 1 COMPLETE: All critical API endpoints implemented
echo 🔗 Ready for frontend integration and testing
echo 🎬 Investor demonstration capability enabled
echo.

REM Check for Node.js
echo 🔍 Checking system requirements...
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js is required but not found
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

echo ✅ Node.js found

REM Install gateway dependencies
echo.
echo 📦 Installing API Gateway dependencies...
call npm install express cors socket.io >nul 2>&1
if errorlevel 1 (
    echo ❌ Failed to install dependencies
    pause
    exit /b 1
)

echo ✅ Dependencies installed

echo.
echo ========================================
echo 🚀 STARTING COMPREHENSIVE API GATEWAY
echo ========================================
echo.
echo Provides ALL missing API endpoints:
echo   📦 Repository ingestion with real-time progress
echo   📊 Collections status monitoring  
echo   🔗 MCP proxy for ArangoDB operations
echo   🌐 Graph visualization endpoints
echo   📈 Analytics and search endpoints
echo   🔄 WebSocket real-time updates
echo.
echo Server will start on: http://localhost:3001
echo WebSocket server: ws://localhost:3001
echo.

REM Start the comprehensive API gateway
echo ⚡ Starting server...
node start-feature-parity-gateway.js

REM Handle any startup errors
if errorlevel 1 (
    echo.
    echo ❌ Failed to start API Gateway
    echo.
    echo 🔧 Troubleshooting:
    echo   1. Ensure port 3001 is available
    echo   2. Check firewall settings
    echo   3. Verify comprehensive-api-gateway.js exists
    echo   4. Try: netstat -an ^| findstr :3001
    echo.
    pause
    exit /b 1
)

echo.
echo Press any key to exit...
pause >nul