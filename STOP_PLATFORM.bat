@echo off
REM 🛑 AI Software Development Platform - SHUTDOWN SCRIPT
REM This script cleanly stops all platform services

echo.
echo ████████████████████████████████████████████████████████████████████████████████
echo 🛑 AI SOFTWARE DEVELOPMENT PLATFORM - SHUTDOWN
echo ████████████████████████████████████████████████████████████████████████████████
echo.

set "GREEN=[32m"
set "RED=[31m" 
set "BLUE=[34m"
set "YELLOW=[33m"
set "NC=[0m"

echo %BLUE%Stopping all platform services...%NC%
echo.

REM Stop Node.js processes
echo %BLUE%Stopping Node.js services...%NC%
taskkill /F /IM node.exe >nul 2>nul
if %ERRORLEVEL% equ 0 (
    echo %GREEN%✅ All Node.js processes stopped%NC%
) else (
    echo %YELLOW%⚠️  No Node.js processes were running%NC%
)

REM Kill services on specific ports
echo.
echo %BLUE%Freeing up ports...%NC%

REM Port 3000 (Frontend)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000" 2^>nul') do (
    taskkill /PID %%a /F >nul 2>nul
    if not errorlevel 1 (
        echo %GREEN%✅ Port 3000 freed (Frontend)%NC%
    )
)

REM Port 3001 (API Gateway)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3001" 2^>nul') do (
    taskkill /PID %%a /F >nul 2>nul
    if not errorlevel 1 (
        echo %GREEN%✅ Port 3001 freed (API Gateway)%NC%
    )
)

REM Port 3002 (MCP Server)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3002" 2^>nul') do (
    taskkill /PID %%a /F >nul 2>nul
    if not errorlevel 1 (
        echo %GREEN%✅ Port 3002 freed (MCP Server)%NC%
    )
)

echo.
echo %BLUE%Checking service status...%NC%

REM Verify ports are free
netstat -ano | findstr ":3000" >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo %GREEN%✅ Port 3000 is free%NC%
) else (
    echo %YELLOW%⚠️  Port 3000 may still be in use%NC%
)

netstat -ano | findstr ":3001" >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo %GREEN%✅ Port 3001 is free%NC%
) else (
    echo %YELLOW%⚠️  Port 3001 may still be in use%NC%
)

netstat -ano | findstr ":3002" >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo %GREEN%✅ Port 3002 is free%NC%
) else (
    echo %YELLOW%⚠️  Port 3002 may still be in use%NC%
)

echo.
echo %BLUE%ArangoDB Status (Docker container will remain running):%NC%
docker ps | findstr arangodb >nul 2>nul
if %ERRORLEVEL% equ 0 (
    echo %GREEN%✅ ArangoDB container is still running (as intended)%NC%
    echo %YELLOW%💡 To stop ArangoDB: docker stop aisdp_db%NC%
) else (
    echo %YELLOW%⚠️  ArangoDB container not found%NC%
)

echo.
echo ████████████████████████████████████████████████████████████████████████████████
echo %GREEN%🛑 PLATFORM SHUTDOWN COMPLETE%NC%
echo ████████████████████████████████████████████████████████████████████████████████
echo.
echo %GREEN%✅ All Node.js services stopped%NC%
echo %GREEN%✅ Ports 3000, 3001, 3002 freed%NC%
echo %BLUE%🗄️  ArangoDB remains running for data persistence%NC%
echo.
echo %BLUE%💡 To restart the platform:%NC%
echo    START_COMPLETE_PLATFORM.bat
echo.
echo %BLUE%💡 To test the platform after restart:%NC%
echo    TEST_PLATFORM.bat
echo.
pause
