@echo off
title AI Platform - Repository Data Enhancement
color 0A

echo.
echo =========================================
echo  🔧 REPOSITORY DATA ENHANCEMENT TOOL  
echo =========================================
echo.

echo ✅ Step 1: Checking ArangoDB connection...
curl -s http://localhost:8529/_api/version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ ArangoDB not accessible. Please ensure ArangoDB is running.
    echo    Start ArangoDB and try again.
    pause
    exit /b 1
) else (
    echo ✅ ArangoDB is accessible
)

echo.
echo ✅ Step 2: Checking existing entities...
curl -s "http://localhost:8529/_db/ai_code_management/_api/collection/entities/count" >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ No entities collection found. Please run repository ingestion first.
    echo    Run: INGEST_REPOSITORIES.bat
    pause
    exit /b 1
) else (
    echo ✅ Entities collection found
)

echo.
echo ✅ Step 3: Installing required dependencies...
if not exist node_modules\arangojs (
    echo Installing ArangoDB driver...
    npm install arangojs
)

echo.
echo ✅ Step 4: Running data enhancement...
echo    This will add security, performance, and quality metrics to your existing entities.
echo    The process may take 2-5 minutes depending on the number of entities.
echo.

node enhance-repository-data.js

if %errorlevel% neq 0 (
    echo.
    echo ❌ Enhancement failed. Please check the error messages above.
    pause
    exit /b 1
)

echo.
echo =========================================
echo        🎉 ENHANCEMENT COMPLETE!        
echo =========================================
echo.
echo Your repository data now includes:
echo.
echo 🛡️  Security Issues (vulnerabilities, CWE mappings)
echo ⚡ Performance Metrics (response time, memory usage)
echo 📏 Code Quality Metrics (complexity, maintainability)
echo 🧪 Test Coverage (line, function, branch coverage)
echo 💳 Technical Debt (debt minutes, severity levels)
echo.
echo 🌐 View your enhanced data:
echo.
echo 📊 ArangoDB Web Interface: http://localhost:8529
echo    - Collections now have rich data for visualization
echo    - Browse security_issues, performance_metrics, etc.
echo.
echo 🎨 Frontend Dashboard: http://localhost:3000/showcase
echo    - Graph visualization with security overlays
echo    - Performance metrics in inspector tabs
echo    - Quality analysis and recommendations
echo.
echo 🔍 API Endpoints: http://localhost:8002/docs
echo    - Test enhanced API responses
echo    - Search with security/performance filters
echo.

echo Press any key to open the ArangoDB web interface...
pause >nul

echo Opening monitoring interfaces...
start http://localhost:8529
timeout /t 2 /nobreak >nul
start http://localhost:3000/showcase

echo.
echo 🎯 WHAT'S NEXT:
echo.
echo 1. Check the collections in ArangoDB web interface
echo 2. Test the enhanced graph visualization in your frontend
echo 3. Try security and performance overlays in the graph
echo 4. Use the enhanced search with quality filters
echo.
echo Your AI Software Development Platform now has world-class
echo code intelligence with comprehensive security, performance,
echo and quality analysis! 🚀
echo.
pause
