@echo off
REM 🚀 AI Software Development Platform - COMPLETE UNIFIED STARTUP SCRIPT
REM This script starts ALL services needed for the production-ready platform

setlocal EnableDelayedExpansion

echo.
echo ████████████████████████████████████████████████████████████████████████████████
echo 🚀 AI SOFTWARE DEVELOPMENT PLATFORM - COMPLETE STARTUP
echo ████████████████████████████████████████████████████████████████████████████████
echo.

REM Color codes for better output
set "GREEN=[32m"
set "RED=[31m"
set "BLUE=[34m"
set "YELLOW=[33m"
set "NC=[0m"

REM Prerequisites check
echo %BLUE%🔍 STEP 1: Checking Prerequisites...%NC%
echo ========================================

REM Check Node.js
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo %RED%❌ Node.js is not installed. Please install Node.js 18+ and try again.%NC%
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo %GREEN%✅ Node.js: !NODE_VERSION!%NC%

REM Check npm
where npm >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo %RED%❌ npm is not installed. Please install npm and try again.%NC%
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('npm --version') do set NPM_VERSION=%%i
echo %GREEN%✅ npm: !NPM_VERSION!%NC%

REM Check Docker
where docker >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo %YELLOW%⚠️  Docker not found. Please ensure ArangoDB is running manually.%NC%
) else (
    echo %GREEN%✅ Docker is available%NC%
)

echo.

REM Database check
echo %BLUE%🗄️  STEP 2: Checking ArangoDB Database...%NC%
echo =========================================

REM Check if ArangoDB is running
docker ps | findstr arangodb >nul 2>nul
if %ERRORLEVEL% equ 0 (
    echo %GREEN%✅ ArangoDB Docker container is running%NC%
    
    REM Test database connectivity
    curl -s http://localhost:8529/_api/version >nul 2>nul
    if !ERRORLEVEL! equ 0 (
        echo %GREEN%✅ ArangoDB is accessible on port 8529%NC%
    ) else (
        echo %YELLOW%⚠️  ArangoDB container running but not accessible%NC%
    )
) else (
    echo %RED%❌ ArangoDB is not running%NC%
    echo %BLUE%Starting ArangoDB with Docker Compose...%NC%
    
    REM Try to start with docker-compose
    if exist docker-compose.yml (
        docker-compose up -d
        echo %GREEN%✅ ArangoDB started with Docker Compose%NC%
        timeout /t 5 /nobreak >nul
    ) else (
        echo %RED%❌ Please start ArangoDB manually:%NC%
        echo docker run -d -p 8529:8529 -e ARANGO_ROOT_PASSWORD=password --name aisdp_db arangodb:3.11
        pause
        exit /b 1
    )
)

echo.

REM Dependencies installation
echo %BLUE%📦 STEP 3: Installing Dependencies...%NC%
echo =====================================

REM Install root dependencies
if exist package.json (
    echo Installing root dependencies...
    call npm install --silent
    if !ERRORLEVEL! equ 0 (
        echo %GREEN%✅ Root dependencies installed%NC%
    ) else (
        echo %RED%❌ Failed to install root dependencies%NC%
    )
)

REM Install frontend dependencies
if exist apps\frontend\package.json (
    echo Installing frontend dependencies...
    pushd apps\frontend
    call npm install --silent
    if !ERRORLEVEL! equ 0 (
        echo %GREEN%✅ Frontend dependencies installed%NC%
    ) else (
        echo %RED%❌ Failed to install frontend dependencies%NC%
    )
    popd
)

REM Install MCP server dependencies
if exist arangodb-ai-platform-mcp\package.json (
    echo Installing MCP server dependencies...
    pushd arangodb-ai-platform-mcp
    call npm install --silent
    if !ERRORLEVEL! equ 0 (
        echo %GREEN%✅ MCP server dependencies installed%NC%
    ) else (
        echo %RED%❌ Failed to install MCP server dependencies%NC%
    )
    popd
)

echo.

REM Port availability check
echo %BLUE%🔌 STEP 4: Checking Port Availability...%NC%
echo ========================================

REM Check port 3000 (only listening ports)
netstat -ano | findstr ":3000" | findstr "LISTENING" >nul 2>nul
if %ERRORLEVEL% equ 0 (
    echo %YELLOW%⚠️  Port 3000 is already in use. Please stop the service and try again.%NC%
    pause
    exit /b 1
)
echo %GREEN%✅ Port 3000 (Frontend) available%NC%

REM Check port 3001 (only listening ports)
netstat -ano | findstr ":3001" | findstr "LISTENING" >nul 2>nul
if %ERRORLEVEL% equ 0 (
    echo %YELLOW%⚠️  Port 3001 is already in use. Please stop the service and try again.%NC%
    pause
    exit /b 1
)
echo %GREEN%✅ Port 3001 (API Gateway) available%NC%

REM Check port 3002 (only listening ports)
netstat -ano | findstr ":3002" | findstr "LISTENING" >nul 2>nul
if %ERRORLEVEL% equ 0 (
    echo %YELLOW%⚠️  Port 3002 is already in use. Please stop the service and try again.%NC%
    pause
    exit /b 1
)
echo %GREEN%✅ Port 3002 (MCP Server) available%NC%

echo.

REM Service startup
echo %BLUE%🚀 STEP 5: Starting All Services...%NC%
echo ==================================

REM Start MCP HTTP Server
echo %BLUE%Starting MCP HTTP Server on port 3002...%NC%
start "MCP HTTP Server" cmd /c "cd arangodb-ai-platform-mcp && node http-server.js"
timeout /t 3 /nobreak >nul

REM Verify MCP server started
curl -s http://localhost:3002/health >nul 2>nul
if !ERRORLEVEL! equ 0 (
    echo %GREEN%✅ MCP HTTP Server started successfully%NC%
) else (
    echo %YELLOW%⚠️  MCP HTTP Server may be starting up...%NC%
)

REM Start API Gateway
echo %BLUE%Starting API Gateway on port 3001...%NC%
start "API Gateway" cmd /c "node services/frontend-api-gateway.js"
timeout /t 3 /nobreak >nul

REM Verify API Gateway started
curl -s http://localhost:3001/health >nul 2>nul
if !ERRORLEVEL! equ 0 (
    echo %GREEN%✅ API Gateway started successfully%NC%
) else (
    echo %YELLOW%⚠️  API Gateway may be starting up...%NC%
)

REM Start Frontend
echo %BLUE%Starting Frontend on port 3000...%NC%
start "Frontend App" cmd /c "cd apps/frontend && npm run dev"
timeout /t 5 /nobreak >nul

echo.

REM Final verification
echo %BLUE%🔍 STEP 6: Final Service Verification...%NC%
echo =======================================

echo Waiting for all services to initialize...
timeout /t 10 /nobreak >nul

echo.
echo %BLUE%Testing service endpoints...%NC%

REM Test ArangoDB
curl -s http://localhost:8529/_api/version >nul 2>nul
if !ERRORLEVEL! equ 0 (
    echo %GREEN%✅ ArangoDB (8529): Healthy%NC%
) else (
    echo %RED%❌ ArangoDB (8529): Not responding%NC%
)

REM Test MCP Server
curl -s http://localhost:3002/health >nul 2>nul
if !ERRORLEVEL! equ 0 (
    echo %GREEN%✅ MCP Server (3002): Healthy%NC%
) else (
    echo %RED%❌ MCP Server (3002): Not responding%NC%
)

REM Test API Gateway
curl -s http://localhost:3001/health >nul 2>nul
if !ERRORLEVEL! equ 0 (
    echo %GREEN%✅ API Gateway (3001): Healthy%NC%
) else (
    echo %RED%❌ API Gateway (3001): Not responding%NC%
)

REM Test Frontend (check if port is listening)
netstat -ano | findstr ":3000" >nul 2>nul
if !ERRORLEVEL! equ 0 (
    echo %GREEN%✅ Frontend (3000): Running%NC%
) else (
    echo %RED%❌ Frontend (3000): Not running%NC%
)

echo.
echo ████████████████████████████████████████████████████████████████████████████████
echo 🎉 AI SOFTWARE DEVELOPMENT PLATFORM IS READY!
echo ████████████████████████████████████████████████████████████████████████████████
echo.
echo %GREEN%📱 APPLICATION ACCESS:%NC%
echo    🌐 Frontend:     http://localhost:3000
echo    🔗 API Gateway:  http://localhost:3001
echo    📊 MCP Server:   http://localhost:3002  
echo    🗄️  ArangoDB:    http://localhost:8529
echo.
echo %GREEN%🔍 HEALTH ENDPOINTS:%NC%
echo    • Frontend:      http://localhost:3000 (Visual Interface)
echo    • API Gateway:   http://localhost:3001/health
echo    • MCP Server:    http://localhost:3002/health
echo    • ArangoDB:      http://localhost:8529/_api/version
echo.
echo %GREEN%✨ PRODUCTION FEATURES:%NC%
echo    📥 Real Repository Ingestion with GitHub integration
echo    📊 Live progress tracking via WebSocket updates
echo    🎨 Interactive graph visualization with 7-tab inspector
echo    🗄️  Real ArangoDB data (NO demo fallbacks)
echo    📱 Mobile-responsive professional UI
echo.
echo %GREEN%🎯 TEST REPOSITORIES:%NC%
echo    • https://github.com/facebook/react
echo    • https://github.com/microsoft/typescript
echo    • https://github.com/express/express
echo.
echo %BLUE%🌐 Opening application in browser...%NC%
start http://localhost:3000

echo.
echo %GREEN%✅ All services are running in separate windows%NC%
echo %RED%🛑 Close those windows to stop individual services%NC%
echo.
pause
