@echo off
REM 🚀 AI Software Development Platform - Complete Startup Script (Windows)
REM This script starts the complete investor-ready frontend with backend integration

echo 🚀 Starting AI Software Development Platform - Investor Ready Frontend
echo ==================================================================

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo ❌ Node.js is not installed. Please install Node.js 18+ and try again.
    pause
    exit /b 1
)

REM Check if npm is installed
where npm >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo ❌ npm is not installed. Please install npm and try again.
    pause
    exit /b 1
)

echo ✅ Prerequisites check passed
echo.

REM Install dependencies
echo 🔧 Installing dependencies...

REM Install root dependencies
if exist package.json (
    call npm install
)

REM Install frontend dependencies
if exist apps\frontend\package.json (
    cd apps\frontend
    call npm install
    cd ..\..
)

echo ✅ Dependencies installed
echo.

echo 🚀 Starting services...
echo.

REM Start Frontend API Gateway (Mock backend for development)
echo 📡 Starting Frontend API Gateway on port 3001...
start "API Gateway" cmd /c "node services/frontend-api-gateway.js"

REM Wait a moment for API Gateway to start
timeout /t 3 /nobreak >nul

REM Start Frontend Development Server
echo 🌐 Starting Frontend App on port 5173...
start "Frontend App" cmd /c "cd apps/frontend && npm run dev"

REM Wait for services to initialize
echo.
echo ⏳ Waiting for services to initialize...
timeout /t 8 /nobreak >nul

echo.
echo ==================================================================
echo 🎉 AI SOFTWARE DEVELOPMENT PLATFORM READY!
echo ==================================================================
echo.
echo 📱 APPLICATION ACCESS:
echo    🌐 Frontend: http://localhost:5173
echo    🔗 API Gateway: http://localhost:3001
echo    📊 Health Check: http://localhost:3001/health
echo.
echo ✨ INVESTOR DEMO FEATURES:
echo    📥 Repository Ingestion - Input any GitHub URL
echo    📊 Real-time Progress - Watch live collection population
echo    🎨 Graph Visualization - Interactive repository structure
echo    🔍 Advanced Inspector - 7-tab detailed analysis
echo    📱 Mobile Responsive - Works on all devices
echo.
echo 🎯 DEMO REPOSITORIES TO TRY:
echo    • https://github.com/facebook/react
echo    • https://github.com/microsoft/typescript
echo    • https://github.com/express/express
echo.
echo 💡 Both services are running in separate windows.
echo 🛑 Close those windows to stop the services.
echo.
echo 🌐 Opening frontend in your browser...

REM Open the frontend in the default browser
start http://localhost:5173

echo.
echo ✅ Setup complete! The application should open in your browser.
echo.
pause