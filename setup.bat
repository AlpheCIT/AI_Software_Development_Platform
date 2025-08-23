@echo off
REM AI Software Development Platform - Windows Setup Script
REM This script will set up everything you need to run the system

echo.
echo ================================================
echo   AI Software Development Platform - Setup
echo ================================================
echo.

REM Check if we're running as administrator (optional but recommended)
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo WARNING: Not running as administrator. ArangoDB service setup may fail.
    echo Press any key to continue anyway...
    pause >nul
)

echo 🔍 Checking prerequisites...
echo.

REM Check Node.js
node --version >nul 2>&1
if %errorLevel% neq 0 (
    echo ❌ Node.js not found! Please install Node.js 18+ from https://nodejs.org/
    echo.
    pause
    exit /b 1
) else (
    for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
    echo ✅ Node.js: %NODE_VERSION%
)

REM Check npm
npm --version >nul 2>&1
if %errorLevel% neq 0 (
    echo ❌ npm not found!
    pause
    exit /b 1
) else (
    for /f "tokens=*" %%i in ('npm --version') do set NPM_VERSION=%%i
    echo ✅ npm: v%NPM_VERSION%
)

REM Check if ArangoDB is installed
where arangod >nul 2>&1
if %errorLevel% neq 0 (
    echo ❌ ArangoDB not found in PATH
    echo.
    echo Please install ArangoDB from: https://www.arangodb.com/download/
    echo Make sure to select "Add to PATH" during installation
    echo.
    echo Or start ArangoDB manually if it's already installed
    pause
    exit /b 1
) else (
    echo ✅ ArangoDB: Found in PATH
)

echo.
echo 🚀 Starting ArangoDB...

REM Try to start ArangoDB service first
net start ArangoDB >nul 2>&1
if %errorLevel% equ 0 (
    echo ✅ ArangoDB service started successfully
) else (
    echo ℹ️  ArangoDB service not found or already running
    echo    Attempting to start ArangoDB manually...
    
    REM Start ArangoDB manually in background
    start /b "" arangod --server.endpoint tcp://0.0.0.0:8529 --server.authentication false
    if %errorLevel% equ 0 (
        echo ✅ ArangoDB started manually
    ) else (
        echo ❌ Failed to start ArangoDB
        echo.
        echo Please start ArangoDB manually:
        echo 1. Look for ArangoDB shortcut on desktop
        echo 2. Or run: arangod --server.endpoint tcp://0.0.0.0:8529
        echo 3. Or start the Windows service if installed
        echo.
        pause
        exit /b 1
    )
)

echo.
echo ⏳ Waiting for ArangoDB to be ready...

REM Wait for ArangoDB to be ready (up to 30 seconds)
set /a attempts=0
:wait_for_arango
set /a attempts+=1
if %attempts% gtr 30 (
    echo ❌ ArangoDB failed to start within 30 seconds
    echo.
    echo Please check:
    echo 1. ArangoDB is installed correctly
    echo 2. Port 8529 is not in use by another application
    echo 3. Windows Firewall is not blocking the connection
    echo.
    pause
    exit /b 1
)

REM Load environment variables if .env exists
if exist ".env" (
    echo 📝 Loading environment variables from .env...
    for /f "usebackq tokens=1,2 delims==" %%A in (".env") do (
        if "%%A"=="ARANGO_HOST" set ARANGO_HOST=%%B
        if "%%A"=="ARANGO_PORT" set ARANGO_PORT=%%B
        if "%%A"=="ARANGO_URL" set ARANGO_URL=%%B
    )
)

REM Set defaults if not set
if not defined ARANGO_HOST set ARANGO_HOST=localhost
if not defined ARANGO_PORT set ARANGO_PORT=8529
if not defined ARANGO_URL set ARANGO_URL=http://%ARANGO_HOST%:%ARANGO_PORT%

REM Check if ArangoDB is responding
curl -s %ARANGO_URL%/_api/version >nul 2>&1
if %errorLevel% neq 0 (
    echo ⏳ Attempt %attempts%/30: Waiting for ArangoDB...
    timeout /t 1 /nobreak >nul
    goto wait_for_arango
)

echo ✅ ArangoDB is ready and responding on %ARANGO_URL%

echo.
echo 📦 Installing dependencies...
call npm install
if %errorLevel% neq 0 (
    echo ❌ Failed to install dependencies
    pause
    exit /b 1
)

echo.
echo 🗄️  Setting up database...
call npm run db:setup
if %errorLevel% neq 0 (
    echo ❌ Failed to setup database
    echo.
    echo This might be due to:
    echo 1. ArangoDB connection issues
    echo 2. Permission problems
    echo 3. Incorrect credentials
    echo.
    echo Please check the .env file and try again
    pause
    exit /b 1
)

echo.
echo 🎉 Setup completed successfully!
echo.
echo ================================================
echo   Next Steps:
echo ================================================
echo.
echo 1. Start the system:     npm start
echo 2. Open dashboard:       http://localhost:3001
echo 3. API documentation:    http://localhost:3001/api/docs
echo 4. ArangoDB web UI:      %ARANGO_URL%
echo 5. Analyze a repository: npm run analyze /path/to/repo
echo.
echo Press any key to start the system now...
pause >nul

echo.
echo 🚀 Starting AI Software Development Platform...
call npm start
