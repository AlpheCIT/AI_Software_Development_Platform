@echo off
title AI Platform - Repository Ingestion Setup
color 0A

echo.
echo =========================================
echo  🚀 AI PLATFORM REPOSITORY INGESTION  
echo =========================================
echo.

echo ✅ Step 1: Checking ArangoDB status...
curl -s http://localhost:8529/_api/version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ ArangoDB not running. Starting ArangoDB...
    net start ArangoDB
    timeout /t 5 /nobreak >nul
) else (
    echo ✅ ArangoDB is running
)

echo.
echo ✅ Step 2: Starting Repository Ingestion Service...
cd services\repository-ingestion
if not exist node_modules (
    echo Installing dependencies...
    npm install
)

echo Starting ingestion service on port 8002...
start /MIN cmd /c "npm start"

echo ✅ Step 3: Waiting for service to initialize...
timeout /t 15 /nobreak >nul

echo.
echo ✅ Step 4: Testing ingestion service...
curl -s http://localhost:8002/health >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Ingestion service not responding. Please check manually.
    echo Open another terminal and run: cd services\repository-ingestion && npm start
    pause
    exit /b 1
) else (
    echo ✅ Ingestion service is ready
)

echo.
echo ✅ Step 5: Ingesting your AI platform (self-analysis)...
curl -X POST http://localhost:8002/api/ingestion/directory ^
  -H "Content-Type: application/json" ^
  -d "{\"path\": \"C:/Users/richa/OneDrive/Documents/Github_Richard_Helms/AI_Software_Development_Platform\", \"options\": {\"recursive\": true, \"includeTests\": true, \"includeDocs\": true}}"

echo.
echo ✅ Step 6: Ingesting React.js for rich sample data...
curl -X POST http://localhost:8002/api/ingestion/repository ^
  -H "Content-Type: application/json" ^
  -d "{\"url\": \"https://github.com/facebook/react\", \"options\": {\"shallow\": true, \"depth\": 1, \"includeTests\": false}}"

echo.
echo ✅ Step 7: Starting API Gateway...
cd ..\..
start /MIN cmd /c "node start-gateway.js"

echo.
echo ✅ Step 8: Starting Frontend...
cd apps\frontend
if not exist node_modules (
    echo Installing frontend dependencies...
    npm install
)
start /MIN cmd /c "npm start"

echo.
echo =========================================
echo           🎉 SETUP COMPLETE!           
echo =========================================
echo.
echo Your AI Platform is now running with real data:
echo.
echo 📊 Repository Ingestion API: http://localhost:8002/docs
echo 🗄️  ArangoDB Web Interface:  http://localhost:8529
echo 🌐 API Gateway Health:       http://localhost:8003/health  
echo 🎨 Frontend Showcase:        http://localhost:3000/showcase
echo.
echo 📋 Monitor ingestion progress:
echo    curl http://localhost:8002/api/ingestion/jobs
echo.
echo 🔍 Check populated collections:
echo    Open http://localhost:8529 (user: root, pass: your ARANGO_PASSWORD)
echo.
echo ⏱️  Repository ingestion will take 5-15 minutes depending on size.
echo    You can monitor progress in the web interfaces above.
echo.
echo Press any key to open the monitoring dashboards...
pause >nul

echo Opening monitoring dashboards...
start http://localhost:8002/docs
timeout /t 2 /nobreak >nul
start http://localhost:8529
timeout /t 2 /nobreak >nul  
start http://localhost:3000/showcase

echo.
echo 🎯 NEXT STEPS:
echo.
echo 1. Monitor ingestion progress at http://localhost:8002/docs
echo 2. Watch collections populate at http://localhost:8529
echo 3. See real data in frontend at http://localhost:3000/showcase
echo 4. Try semantic search once ingestion completes
echo.
echo Happy coding! 🚀
echo.
pause
