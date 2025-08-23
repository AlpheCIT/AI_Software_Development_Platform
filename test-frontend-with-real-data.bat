@echo off
echo ========================================
echo   AI Software Development Platform
echo   Frontend Testing with Real Data
echo ========================================
echo.

echo 🔧 Starting Real Data API Gateway...
echo 📍 Port: 3001
echo 🗄️  Database: ARANGO_AISDP_DB
echo.

start "API Gateway" cmd /k "node start-real-data-gateway.js"

echo ⏳ Waiting 5 seconds for API to start...
timeout /t 5 /nobreak >nul

echo.
echo 🌐 Testing API endpoints...
curl -s http://localhost:3001/health
echo.
echo.

echo 🎨 Starting Frontend Development Server...
echo 📍 Port: 3000
echo 🔗 API: http://localhost:3001
echo.

cd apps\frontend
start "Frontend" cmd /k "npm run dev"

echo.
echo ✅ Both services starting...
echo.
echo 📋 Next Steps:
echo   1. Wait for both services to fully start
echo   2. Open http://localhost:3000 in browser
echo   3. Navigate to /graph page
echo   4. Test node selection and inspector panel
echo   5. Verify search functionality
echo.
echo 🔍 API Endpoints to test:
echo   - Health: http://localhost:3001/health
echo   - Graph:  http://localhost:3001/api/v1/graph/seeds
echo   - Node:   http://localhost:3001/api/v1/graph/node/user-service
echo   - Search: http://localhost:3001/api/v1/graph/search?q=user
echo.
echo Press any key to exit...
pause >nul
