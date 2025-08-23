@echo off
cls

echo.
echo  ╔══════════════════════════════════════════════════════════════╗
echo  ║                                                              ║
echo  ║        🚀 AI Software Development Platform - FIXED! 🚀          ║
echo  ║                                                              ║
echo  ║     Enterprise-grade AI-powered code intelligence platform  ║
echo  ║                                                              ║
echo  ╚══════════════════════════════════════════════════════════════╝
echo.
echo  🔧 FIXED Issues:
echo  ✅ Removed workspace protocol dependencies
echo  ✅ Simplified package structure  
echo  ✅ Fixed Docker network conflicts
echo  ✅ Streamlined configuration
echo.
echo  This will now:
echo  ✅ Install dependencies properly
echo  🚀 Start ArangoDB (Docker or local)
echo  🗄️  Initialize database with schema
echo  🧠 Run AI code analysis
echo  🌐 Launch the system
echo.
echo  Ready? Let's fix this and get it working!
echo.
pause

echo.
echo 🔧 Starting FIXED setup...
echo.

REM Change to the script directory
cd /d "%~dp0"

echo 📦 Installing dependencies...
call npm install
if %errorLevel% neq 0 (
    echo ❌ npm install failed. Trying alternative approach...
    echo.
    echo Let's try starting with Docker instead...
    echo.
    
    echo 🐳 Starting ArangoDB with Docker...
    call docker-compose up arangodb -d
    if %errorLevel% neq 0 (
        echo ❌ Docker failed too. Let's try manual setup...
        echo.
        echo Please install ArangoDB manually:
        echo 1. Download from: https://www.arangodb.com/download/
        echo 2. Install and start the service
        echo 3. Make sure it's running on port 8529
        echo 4. Run this script again
        echo.
        pause
        exit /b 1
    )
    
    echo ✅ ArangoDB started with Docker
    goto :database_setup
)

echo ✅ Dependencies installed successfully!

echo.
echo 🚀 Checking ArangoDB...

REM Load environment variables if .env exists
if exist ".env" (
    echo 📝 Loading environment variables from .env...
    for /f "usebackq tokens=1,2 delims==" %%A in (".env") do (
        if "%%A"=="ARANGO_HOST" set ARANGO_HOST=%%B
        if "%%A"=="ARANGO_PORT" set ARANGO_PORT=%%B
        if "%%A"=="ARANGO_URL" set ARANGO_URL=%%B
        if "%%A"=="ARANGO_PASSWORD" set ARANGO_PASSWORD=%%B
    )
)

REM Set defaults if not set
if not defined ARANGO_HOST set ARANGO_HOST=localhost
if not defined ARANGO_PORT set ARANGO_PORT=8529
if not defined ARANGO_URL set ARANGO_URL=http://%ARANGO_HOST%:%ARANGO_PORT%
if not defined ARANGO_PASSWORD set ARANGO_PASSWORD=openSesame

REM Check if ArangoDB is already running
curl -s %ARANGO_URL%/_api/version >nul 2>&1
if %errorLevel% equ 0 (
    echo ✅ ArangoDB is already running
    goto :database_setup
)

echo 🐳 Starting ArangoDB with Docker...
call docker-compose up arangodb -d
if %errorLevel% neq 0 (
    echo ⚠️  Docker failed, trying Windows service...
    net start ArangoDB >nul 2>&1
    if %errorLevel% neq 0 (
        echo.
        echo ❌ Could not start ArangoDB automatically.
        echo.
        echo Please start ArangoDB manually:
        echo 1. Open ArangoDB from Start Menu, OR
        echo 2. Run: net start ArangoDB, OR  
        echo 3. Run: docker run -p %ARANGO_PORT%:%ARANGO_PORT% -e ARANGO_ROOT_PASSWORD=%ARANGO_PASSWORD% arangodb:3.11
        echo.
        echo Then press any key to continue...
        pause
    )
)

:database_setup
echo.
echo ⏳ Waiting for ArangoDB to be ready...
timeout /t 5 /nobreak >nul

REM Wait for ArangoDB to be ready
set /a attempts=0
:wait_loop
set /a attempts+=1
if %attempts% gtr 30 (
    echo ❌ ArangoDB not ready after 30 seconds
    echo Please check if ArangoDB is running on %ARANGO_URL%
    pause
    exit /b 1
)

curl -s %ARANGO_URL%/_api/version >nul 2>&1
if %errorLevel% neq 0 (
    echo ⏳ Waiting... attempt %attempts%/30
    timeout /t 1 /nobreak >nul
    goto :wait_loop
)

echo ✅ ArangoDB is ready!

echo.
echo 🗄️  Setting up database...
call npm run db:setup
if %errorLevel% neq 0 (
    echo ❌ Database setup failed
    echo.
    echo This might be due to:
    echo 1. ArangoDB connection issues
    echo 2. Incorrect credentials (check your .env file)
    echo 3. Permission problems
    echo.
    echo Check ArangoDB web interface: %ARANGO_URL%
    pause
    exit /b 1
)

echo.
echo 🧠 Running sample analysis...
if exist "sample-project" (
    call npm run analyze sample-project
    if %errorLevel% equ 0 (
        echo ✅ Sample analysis completed!
    ) else (
        echo ⚠️  Sample analysis had issues, but continuing...
    )
) else (
    echo ⚠️  Sample project not found, skipping analysis demo
)

echo.
echo 🎉 SYSTEM IS READY!
echo.
echo ================================================
echo   🚀 AI Software Development Platform - WORKING!
echo ================================================
echo.
echo 🔗 Access Points:
echo ├── 🌐 API Server:       http://localhost:3001
echo ├── 📚 API Docs:         http://localhost:3001/api/docs  
echo ├── ❤️  Health Check:    http://localhost:3001/health
echo └── 🗄️  ArangoDB UI:     %ARANGO_URL%
echo.
echo 🎯 Quick Commands:
echo npm run status          # Check system status
echo npm run analyze [path]  # Analyze your code
echo npm start              # Start the system
echo.
echo Press any key to start the system...
pause >nul

echo.
echo 🚀 Starting the system...
call npm start
