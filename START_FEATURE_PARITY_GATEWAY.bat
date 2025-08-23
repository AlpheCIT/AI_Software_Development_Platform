@echo off
echo ========================================
echo 🚀 FEATURE PARITY IMPLEMENTATION
echo ========================================
echo.
echo Starting comprehensive API gateway with ALL missing endpoints...
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

REM Install dependencies if needed
if not exist "node_modules" (
    echo 📦 Installing dependencies...
    call npm install
    if errorlevel 1 (
        echo ❌ Failed to install dependencies
        pause
        exit /b 1
    )
)

REM Install additional required packages for the gateway
echo 📦 Installing gateway dependencies...
call npm install express cors socket.io

echo.
echo 🎯 Starting Feature Parity Gateway...
echo    This provides ALL API endpoints the frontend needs
echo.

REM Start the feature parity gateway
node start-feature-parity-gateway.js

echo.
echo Press any key to exit...
pause >nul