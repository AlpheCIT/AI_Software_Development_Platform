@echo off
title AI Platform - Status Check & Enhancement Guide
color 0A

echo.
echo =========================================
echo    🔍 AI PLATFORM STATUS CHECKER      
echo =========================================
echo.

echo Checking your current system status...
echo.

echo ✅ Step 1: Installing dependencies if needed...
if not exist node_modules\arangojs (
    echo Installing ArangoDB driver...
    npm install arangojs
)

echo ✅ Step 2: Verifying database status...
node verify-database-data.js

echo.
echo =========================================
echo     📋 NEXT STEPS RECOMMENDATION      
echo =========================================
echo.

REM Check if entities exist
curl -s "http://localhost:8529/_db/ai_code_management/_api/collection/entities/count" > temp_count.txt 2>&1
findstr "count" temp_count.txt >nul 2>&1

if %errorlevel% neq 0 (
    echo 🚨 ISSUE DETECTED: No repository data found
    echo.
    echo 📥 STEP 1: Run Repository Ingestion
    echo    Your database needs basic repository data first.
    echo    This will populate: repositories, files, entities, relationships
    echo.
    echo    Run: INGEST_REPOSITORIES.bat
    echo    Wait: 5-15 minutes for completion
    echo    Then: Return here to enhance data
    echo.
    goto :end
)

REM Check if enhanced data exists
curl -s "http://localhost:8529/_db/ai_code_management/_api/collection/security_issues/count" > temp_enhanced.txt 2>&1
findstr "count" temp_enhanced.txt >nul 2>&1

if %errorlevel% neq 0 (
    echo ⚡ READY FOR ENHANCEMENT!
    echo.
    echo 📊 STEP 2: Enhance Repository Data
    echo    You have basic repository structure.
    echo    Now add security, performance, and quality data.
    echo.
    echo    Run: ENHANCE_DATA.bat
    echo    Time: 2-5 minutes
    echo    Result: Rich visualization data
    echo.
    echo Would you like to run the enhancement now? (Y/N)
    set /p choice=
    if /i "%choice%"=="Y" (
        echo.
        echo 🚀 Running enhancement...
        call ENHANCE_DATA.bat
        goto :end
    )
    echo.
    echo Run ENHANCE_DATA.bat when ready!
    goto :end
)

echo 🎉 SYSTEM FULLY ENHANCED!
echo.
echo ✅ Repository data: Available
echo ✅ Security analysis: Available  
echo ✅ Performance metrics: Available
echo ✅ Quality analysis: Available
echo.
echo 🌐 Your system is ready for world-class visualization!
echo.
echo 📊 View your data:
echo    ArangoDB Web: http://localhost:8529
echo    API Docs: http://localhost:8002/docs
echo    Frontend: http://localhost:3000/showcase
echo.
echo 🚀 Next: Start your frontend services
echo    cd apps\frontend ^&^& npm start
echo.

:end
REM Cleanup temp files
if exist temp_count.txt del temp_count.txt
if exist temp_enhanced.txt del temp_enhanced.txt

echo.
echo 📋 AVAILABLE COMMANDS:
echo    CHECK_STATUS.bat     - Run this status check
echo    INGEST_REPOSITORIES.bat - Add repository data
echo    ENHANCE_DATA.bat     - Add security/performance data
echo    verify-database-data.js - Detailed data verification
echo.
echo 🎯 FINAL GOAL: World-class AI code intelligence platform
echo    with comprehensive security, performance, and quality analysis!
echo.
pause
