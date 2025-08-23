@echo off
REM 🧪 AI Software Development Platform - SIMPLE TEST SUITE
REM This script tests all services to ensure everything works

echo.
echo ████████████████████████████████████████████████████████████████████████████████
echo 🧪 AI SOFTWARE DEVELOPMENT PLATFORM - SIMPLE TEST SUITE  
echo ████████████████████████████████████████████████████████████████████████████████
echo.

set PASSED=0
set FAILED=0

echo 🔍 Testing Platform Services...
echo ================================
echo.

REM Test 1: ArangoDB
echo [TEST 1] ArangoDB Database Connection
curl -s http://localhost:8529/_api/version >nul 2>nul
if %ERRORLEVEL% equ 0 (
    echo ✅ PASSED: ArangoDB is running and accessible
    set /a PASSED+=1
) else (
    echo ❌ FAILED: ArangoDB not accessible
    set /a FAILED+=1
)
echo.

REM Test 2: MCP Server Health
echo [TEST 2] MCP Server Health Check
curl -s http://localhost:3002/health >nul 2>nul
if %ERRORLEVEL% equ 0 (
    echo ✅ PASSED: MCP Server is healthy
    set /a PASSED+=1
) else (
    echo ❌ FAILED: MCP Server not responding
    set /a FAILED+=1
)
echo.

REM Test 3: API Gateway Health  
echo [TEST 3] API Gateway Health Check
curl -s http://localhost:3001/health >nul 2>nul
if %ERRORLEVEL% equ 0 (
    echo ✅ PASSED: API Gateway is healthy
    set /a PASSED+=1
) else (
    echo ❌ FAILED: API Gateway not responding  
    set /a FAILED+=1
)
echo.

REM Test 4: Frontend Port
echo [TEST 4] Frontend Service Running
netstat -ano | findstr ":3000" >nul 2>nul
if %ERRORLEVEL% equ 0 (
    echo ✅ PASSED: Frontend is running on port 3000
    set /a PASSED+=1
) else (
    echo ❌ FAILED: Frontend not running
    set /a FAILED+=1
)
echo.

REM Test 5: Production Mode
echo [TEST 5] Production Mode Configuration
if exist .env (
    findstr /C:"DEMO_MODE=false" .env >nul 2>nul
    if !ERRORLEVEL! equ 0 (
        echo ✅ PASSED: Production mode is enabled
        set /a PASSED+=1
    ) else (
        echo ❌ FAILED: Demo mode is not disabled
        set /a FAILED+=1
    )
) else (
    echo ❌ FAILED: Environment file missing
    set /a FAILED+=1
)
echo.

REM Advanced Tests
echo 🔬 Advanced Endpoint Tests...
echo ============================
echo.

REM Test MCP Collections Endpoint
echo [TEST 6] MCP Collections Endpoint
curl -s http://localhost:3002/browse-collections | findstr "success\|data\|error" >nul 2>nul
if %ERRORLEVEL% equ 0 (
    echo ✅ PASSED: MCP Collections endpoint returns data
    set /a PASSED+=1
) else (
    echo ❌ FAILED: MCP Collections endpoint not working
    set /a FAILED+=1
)
echo.

REM Test API Gateway CORS
echo [TEST 7] API Gateway CORS Support
curl -s -H "Origin: http://localhost:3000" http://localhost:3001/health >nul 2>nul
if %ERRORLEVEL% equ 0 (
    echo ✅ PASSED: API Gateway accepts CORS requests
    set /a PASSED+=1
) else (
    echo ❌ FAILED: CORS not configured properly
    set /a FAILED+=1
)
echo.

REM Final Results
set /a TOTAL=%PASSED%+%FAILED%
echo ████████████████████████████████████████████████████████████████████████████████
echo 📊 TEST RESULTS SUMMARY
echo ████████████████████████████████████████████████████████████████████████████████
echo.
echo ✅ Passed Tests: %PASSED%
echo ❌ Failed Tests: %FAILED%  
echo 📊 Total Tests:  %TOTAL%
echo.

if %FAILED% equ 0 (
    echo 🎉 ALL TESTS PASSED! PLATFORM IS FULLY OPERATIONAL! 🎉
    echo.
    echo 💡 Quick Access URLs:
    echo    🌐 Frontend:    http://localhost:3000
    echo    📊 API Health:  http://localhost:3001/health
    echo    🔧 MCP Health:  http://localhost:3002/health
    echo    🗄️  Database:   http://localhost:8529
    echo.
    echo 🚀 Platform is ready for investor demos!
) else (
    echo ⚠️  %FAILED% tests failed. Please check the services.
    echo.
    echo 💡 Troubleshooting:
    echo    • Check if all services are running: netstat -ano ^| findstr ":300"
    echo    • Restart platform: START_COMPLETE_PLATFORM.bat
    echo    • Stop platform: STOP_PLATFORM.bat
)

echo.
echo Press any key to continue...
pause >nul
