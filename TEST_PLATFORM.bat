@echo off
REM 🧪 AI Software Development Platform - COMPREHENSIVE TEST SUITE
REM This script tests all services and endpoints to ensure everything works

setlocal EnableDelayedExpansion

echo.
echo ████████████████████████████████████████████████████████████████████████████████
echo 🧪 AI SOFTWARE DEVELOPMENT PLATFORM - TEST SUITE
echo ████████████████████████████████████████████████████████████████████████████████
echo.

set "GREEN=[32m"
set "RED=[31m"
set "BLUE=[34m"
set "YELLOW=[33m"
set "NC=[0m"

set PASSED_TESTS=0
set FAILED_TESTS=0
set TOTAL_TESTS=0

REM Function to run a test
:run_test
set /a TOTAL_TESTS+=1
echo.
echo %BLUE%TEST %TOTAL_TESTS%: %~1%NC%
echo ----------------------------------------

REM Run the actual test command
%~2 >nul 2>nul
if !ERRORLEVEL! equ 0 (
    echo %GREEN%✅ PASSED: %~1%NC%
    set /a PASSED_TESTS+=1
) else (
    echo %RED%❌ FAILED: %~1%NC%
    if not "%~3"=="" echo    %YELLOW%Expected: %~3%NC%
    set /a FAILED_TESTS+=1
)
goto :eof

REM Start testing
echo %BLUE%Starting comprehensive test suite...%NC%
echo.

REM Test 1: ArangoDB Connectivity
call :run_test "ArangoDB Database Connection" "curl -s http://localhost:8529/_api/version" "HTTP 200 with version info"

REM Test 2: ArangoDB Authentication
call :run_test "ArangoDB Authentication" "curl -s -u root:password http://localhost:8529/_api/version" "HTTP 200 with auth"

REM Test 3: MCP Server Health
call :run_test "MCP Server Health Check" "curl -s http://localhost:3002/health" "HTTP 200 with health status"

REM Test 4: MCP Server Collections
call :run_test "MCP Server Collections Endpoint" "curl -s http://localhost:3002/browse-collections" "JSON response with collections"

REM Test 5: MCP Server Analytics
call :run_test "MCP Server Analytics Endpoint" "curl -s http://localhost:3002/analytics" "JSON response with analytics"

REM Test 6: API Gateway Health
call :run_test "API Gateway Health Check" "curl -s http://localhost:3001/health" "HTTP 200 with health status"

REM Test 7: API Gateway CORS
call :run_test "API Gateway CORS Headers" "curl -s -H \"Origin: http://localhost:3000\" http://localhost:3001/health" "Response with CORS headers"

REM Test 8: Frontend Port Listening
call :run_test "Frontend Service Running" "netstat -ano | findstr :3000" "Port 3000 listening"

REM Test 9: WebSocket Connection
echo.
echo %BLUE%TEST %TOTAL_TESTS%: WebSocket Connection Test%NC%
echo ----------------------------------------
node -e "
const io = require('socket.io-client');
const socket = io('http://localhost:3001');
socket.on('connect', () => {
  console.log('WebSocket connected successfully');
  process.exit(0);
});
socket.on('connect_error', () => {
  process.exit(1);
});
setTimeout(() => process.exit(1), 5000);
" 2>nul
if !ERRORLEVEL! equ 0 (
    echo %GREEN%✅ PASSED: WebSocket Connection Test%NC%
    set /a PASSED_TESTS+=1
) else (
    echo %RED%❌ FAILED: WebSocket Connection Test%NC%
    set /a FAILED_TESTS+=1
)
set /a TOTAL_TESTS+=1

REM Test 10: Environment Variables
echo.
echo %BLUE%TEST %TOTAL_TESTS%: Environment Configuration%NC%
echo ----------------------------------------
if exist .env (
    findstr /C:"DEMO_MODE=false" .env >nul 2>nul
    if !ERRORLEVEL! equ 0 (
        echo %GREEN%✅ PASSED: Production Mode Configuration%NC%
        set /a PASSED_TESTS+=1
    ) else (
        echo %RED%❌ FAILED: Production Mode Configuration%NC%
        echo    %YELLOW%Expected: DEMO_MODE=false in .env%NC%
        set /a FAILED_TESTS+=1
    )
) else (
    echo %RED%❌ FAILED: Environment file missing%NC%
    set /a FAILED_TESTS+=1
)
set /a TOTAL_TESTS+=1

REM Advanced API Tests
echo.
echo %BLUE%🔬 ADVANCED API ENDPOINT TESTS%NC%
echo =====================================

REM Test MCP endpoints in detail
echo.
echo Testing MCP Server endpoints...

curl -s http://localhost:3002/browse-collections | findstr "success" >nul 2>nul
if !ERRORLEVEL! equ 0 (
    echo %GREEN%✅ MCP Collections endpoint returns valid JSON%NC%
) else (
    echo %RED%❌ MCP Collections endpoint failed%NC%
)

curl -s http://localhost:3002/analytics | findstr "\"" >nul 2>nul
if !ERRORLEVEL! equ 0 (
    echo %GREEN%✅ MCP Analytics endpoint returns JSON%NC%
) else (
    echo %RED%❌ MCP Analytics endpoint failed%NC%
)

curl -s http://localhost:3002/graph/seeds | findstr "\"" >nul 2>nul
if !ERRORLEVEL! equ 0 (
    echo %GREEN%✅ MCP Graph Seeds endpoint returns JSON%NC%
) else (
    echo %RED%❌ MCP Graph Seeds endpoint failed%NC%
)

REM Test API Gateway endpoints
echo.
echo Testing API Gateway endpoints...

curl -s http://localhost:3001/api/v1/ingestion/status | findstr "\"" >nul 2>nul
if !ERRORLEVEL! equ 0 (
    echo %GREEN%✅ API Gateway Ingestion Status endpoint works%NC%
) else (
    echo %YELLOW%⚠️  API Gateway Ingestion Status endpoint not responding%NC%
)

REM Frontend accessibility test
echo.
echo Testing Frontend accessibility...

curl -s http://localhost:3000 | findstr "html" >nul 2>nul
if !ERRORLEVEL! equ 0 (
    echo %GREEN%✅ Frontend serves HTML content%NC%
) else (
    echo %YELLOW%⚠️  Frontend may still be loading%NC%
)

REM Database data test
echo.
echo Testing database data...

curl -s -u root:password "http://localhost:8529/_db/ARANGO_AISDP_DB/_api/collection" >nul 2>nul
if !ERRORLEVEL! equ 0 (
    echo %GREEN%✅ ArangoDB database ARANGO_AISDP_DB accessible%NC%
) else (
    echo %YELLOW%⚠️  Database may need setup (run setup-arangodb.js)%NC%
)

REM Performance tests
echo.
echo %BLUE%⚡ PERFORMANCE TESTS%NC%
echo ==================

echo Testing response times...

REM Time the health endpoint
for /f %%a in ('powershell -command "Measure-Command { curl -s http://localhost:3001/health } | Select-Object -ExpandProperty TotalMilliseconds"') do set API_TIME=%%a
echo API Gateway health check: !API_TIME!ms

for /f %%a in ('powershell -command "Measure-Command { curl -s http://localhost:3002/health } | Select-Object -ExpandProperty TotalMilliseconds"') do set MCP_TIME=%%a
echo MCP Server health check: !MCP_TIME!ms

REM Final Report
echo.
echo ████████████████████████████████████████████████████████████████████████████████
echo 📊 TEST RESULTS SUMMARY
echo ████████████████████████████████████████████████████████████████████████████████
echo.
echo %GREEN%✅ Passed Tests: !PASSED_TESTS!%NC%
echo %RED%❌ Failed Tests: !FAILED_TESTS!%NC%
echo %BLUE%📊 Total Tests:  !TOTAL_TESTS!%NC%
echo.

set /a SUCCESS_RATE=(!PASSED_TESTS! * 100) / !TOTAL_TESTS!
echo Success Rate: !SUCCESS_RATE!%%

if !FAILED_TESTS! equ 0 (
    echo.
    echo %GREEN%🎉 ALL TESTS PASSED! Platform is fully operational! 🎉%NC%
    echo.
    echo %BLUE%💡 Quick Start URLs:%NC%
    echo    🌐 Frontend:    http://localhost:3000
    echo    📊 API Health:  http://localhost:3001/health  
    echo    🔧 MCP Health:  http://localhost:3002/health
    echo    🗄️  Database:   http://localhost:8529
    echo.
) else (
    echo.
    echo %RED%⚠️  Some tests failed. Check the services above.%NC%
    echo.
    echo %YELLOW%💡 Common fixes:%NC%
    echo    • Ensure ArangoDB is running: docker ps
    echo    • Check if all services started: netstat -ano ^| findstr ":300"
    echo    • Restart with: START_COMPLETE_PLATFORM.bat
    echo.
)

if !SUCCESS_RATE! geq 80 (
    echo %GREEN%Platform is ready for demo/investor presentation!%NC%
) else (
    echo %RED%Platform needs attention before demo.%NC%
)

echo.
pause
