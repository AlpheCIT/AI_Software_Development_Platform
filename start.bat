@echo off
setlocal enabledelayedexpansion

REM AI Software Development Platform Startup Script (Windows)
REM This script starts both the backend API and frontend dashboard

echo 🚀 Starting AI Software Development Platform...

REM Configuration
set BACKEND_DIR=services\api-gateway\src\analyzer-legacy
set FRONTEND_DIR=apps\web-dashboard
set BACKEND_PORT=8000
set FRONTEND_PORT=3000

REM Function to check if port is in use
:check_port
netstat -an | find ":%1 " >nul
if %errorlevel% == 0 (
    exit /b 0
) else (
    exit /b 1
)

REM Start Backend
echo [34mStarting FastAPI Backend...[0m

call :check_port %BACKEND_PORT%
if %errorlevel% == 0 (
    echo [33mBackend already running on port %BACKEND_PORT%[0m
) else (
    echo Changing to backend directory: %BACKEND_DIR%
    pushd %BACKEND_DIR%
    
    REM Check if python virtual environment exists
    if not exist "venv\" (
        echo Creating Python virtual environment...
        python -m venv venv
    )
    
    REM Activate virtual environment
    call venv\Scripts\activate.bat
    
    REM Install dependencies
    if exist "requirements.txt" (
        echo Installing Python dependencies...
        pip install -r requirements.txt
    )
    
    REM Start FastAPI server
    echo [32mStarting FastAPI server on port %BACKEND_PORT%...[0m
    start "FastAPI Backend" cmd /k "uvicorn app:app --host 0.0.0.0 --port %BACKEND_PORT% --reload"
    
    popd
)

REM Wait a moment for backend to start
timeout /t 3 /nobreak >nul

REM Start Frontend
echo [34mStarting React Frontend...[0m

call :check_port %FRONTEND_PORT%
if %errorlevel% == 0 (
    echo [33mFrontend already running on port %FRONTEND_PORT%[0m
) else (
    echo Changing to frontend directory: %FRONTEND_DIR%
    pushd %FRONTEND_DIR%
    
    REM Install dependencies if node_modules doesn't exist
    if not exist "node_modules\" (
        echo Installing Node.js dependencies...
        call pnpm install
    )
    
    REM Start development server
    echo [32mStarting React development server on port %FRONTEND_PORT%...[0m
    start "React Frontend" cmd /k "pnpm dev"
    
    popd
)

REM Wait for services to start
echo Waiting for services to initialize...
timeout /t 5 /nobreak >nul

REM Check services
echo [34mChecking services...[0m

REM Check backend
curl -s http://localhost:%BACKEND_PORT%/api/health >nul 2>&1
if %errorlevel% == 0 (
    echo [32m✅ Backend API is running at http://localhost:%BACKEND_PORT%[0m
    echo    📊 API Documentation: http://localhost:%BACKEND_PORT%/docs
) else (
    echo [31m❌ Backend API failed to start[0m
)

REM Check frontend (just check if port is open)
call :check_port %FRONTEND_PORT%
if %errorlevel% == 0 (
    echo [32m✅ Frontend Dashboard is running at http://localhost:%FRONTEND_PORT%[0m
) else (
    echo [33m⏳ Frontend is starting up...[0m
)

REM Show status
echo.
echo [34m=== AI Software Development Platform Status ===[0m
echo [32m🖥️  Frontend Dashboard: http://localhost:%FRONTEND_PORT%[0m
echo [32m🔧 Backend API:        http://localhost:%BACKEND_PORT%[0m
echo [32m📚 API Documentation:  http://localhost:%BACKEND_PORT%/docs[0m
echo [32m📈 System Status:      http://localhost:%BACKEND_PORT%/api/system/status[0m
echo.
echo [33mServices are starting up in separate windows.[0m
echo [33mPress any key to open the dashboard in your browser...[0m

pause >nul

REM Open dashboard in default browser
start http://localhost:%FRONTEND_PORT%

echo [32mDashboard opened in your browser![0m
echo [33mYou can close this window - services will continue running.[0m
echo [33mTo stop services, close the Backend and Frontend windows.[0m

pause
