# start-platform.ps1 - AI Software Development Platform Unified Startup Script
# PowerShell version for Windows PowerShell users

param(
    [switch]$Verbose
)

# Set console encoding to handle emojis properly
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

# Global process tracking for cleanup
$global:backgroundProcesses = @()

# Cleanup function
function Stop-BackgroundServices {
    Write-Host "Stopping background services..." -ForegroundColor Yellow
    foreach ($proc in $global:backgroundProcesses) {
        if ($proc -and !$proc.HasExited) {
            Write-Host "Stopping process PID: $($proc.Id)" -ForegroundColor Cyan
            try {
                $proc.Kill()
                $proc.WaitForExit(5000)
            } catch {
                Write-Host "Failed to stop process: $_" -ForegroundColor Red
            }
        }
    }
    
    # Also kill by port as backup
    try {
        npx kill-port 3000 3001 4001 2>$null
    } catch {
        # Ignore errors
    }
}

# Set up Ctrl+C handler
[Console]::TreatControlCAsInput = $false
$null = Register-EngineEvent PowerShell.Exiting -Action { Stop-BackgroundServices }

try {
    Write-Host ""
    Write-Host "🚀 AI Software Development Platform - Unified Startup" -ForegroundColor Green
    Write-Host "======================================================" -ForegroundColor Green
    Write-Host ""

    # Create logs directory if it doesn't exist
    if (!(Test-Path "logs")) {
        New-Item -ItemType Directory -Path "logs" | Out-Null
        Write-Host "📁 Created logs directory" -ForegroundColor Cyan
    }

    # Clean up any existing processes on our target ports
    Write-Host "🧹 Cleaning up existing processes..." -ForegroundColor Yellow
    try {
        npx kill-port 3000 3001 4001 2>$null
        Start-Sleep -Seconds 2
    } catch {
        Write-Host "Warning: Could not clean ports (kill-port not available)" -ForegroundColor Yellow
    }

    # Check if ArangoDB is accessible
    Write-Host "🔍 Checking ArangoDB connection..." -ForegroundColor Yellow
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:8529/_api/version" -Method GET -TimeoutSec 3 -ErrorAction Stop
        Write-Host "✅ ArangoDB is accessible on port 8529" -ForegroundColor Green
    } catch {
        Write-Host "⚠️  ArangoDB not accessible on port 8529" -ForegroundColor Yellow
        Write-Host "    Please start ArangoDB manually:" -ForegroundColor Cyan
        Write-Host "    docker run -d -p 8529:8529 -e ARANGO_ROOT_PASSWORD=password --name arangodb arangodb:3.10" -ForegroundColor Cyan
        Write-Host ""
    }

    # Start Ingestion Engine (port 3000) - Critical for repository ingestion
    Write-Host "🌟 Starting Ingestion Engine on port 3000..." -ForegroundColor Yellow
    try {
        $ingestionProcess = Start-Process powershell -WorkingDirectory "services\ingestion-engine" -ArgumentList "-Command `"npm run dev *>`"`"..\..\logs\ingestion-engine.log`"`"`"" -WindowStyle Minimized -PassThru
        $global:backgroundProcesses += $ingestionProcess
        Write-Host "✅ Ingestion Engine started (PID: $($ingestionProcess.Id))" -ForegroundColor Green
        Start-Sleep -Seconds 3
    } catch {
        Write-Host "❌ Failed to start Ingestion Engine: $_" -ForegroundColor Red
    }

    # Start API Gateway (port 3001) - Required for repository stats  
    Write-Host "🌟 Starting API Gateway on port 3001..." -ForegroundColor Yellow
    try {
        $apiProcess = Start-Process powershell -WorkingDirectory "apps\api-gateway" -ArgumentList "-Command `"npm run dev *>`"`"..\..\logs\api-gateway.log`"`"`"" -WindowStyle Minimized -PassThru
        $global:backgroundProcesses += $apiProcess
        Write-Host "✅ API Gateway started (PID: $($apiProcess.Id))" -ForegroundColor Green
        Start-Sleep -Seconds 3
    } catch {
        Write-Host "❌ Failed to start API Gateway: $_" -ForegroundColor Red
    }

    # Start WebSocket Service (port 4001) - Required for real-time updates
    Write-Host "🌟 Starting WebSocket Service on port 4001..." -ForegroundColor Yellow
    try {
        $wsProcess = Start-Process powershell -WorkingDirectory "services\websocket" -ArgumentList "-Command `"npm run dev *>`"`"..\..\logs\websocket.log`"`"`"" -WindowStyle Minimized -PassThru
        $global:backgroundProcesses += $wsProcess
        Write-Host "✅ WebSocket Service started (PID: $($wsProcess.Id))" -ForegroundColor Green
        Start-Sleep -Seconds 5
    } catch {
        Write-Host "❌ Failed to start WebSocket Service: $_" -ForegroundColor Red
    }

    # Service status check
    Write-Host ""
    Write-Host "📊 Service Status Check..." -ForegroundColor Blue
    Write-Host "========================" -ForegroundColor Blue

    $port3000 = netstat -ano | Select-String ":3000" | Select-Object -First 1
    $port3001 = netstat -ano | Select-String ":3001" | Select-Object -First 1  
    $port4001 = netstat -ano | Select-String ":4001" | Select-Object -First 1

    if ($port3000) {
        Write-Host "✅ Port 3000 - Ingestion Engine" -ForegroundColor Green
    } else {
        Write-Host "❌ Port 3000 - Ingestion Engine" -ForegroundColor Red
    }

    if ($port3001) {
        Write-Host "✅ Port 3001 - API Gateway" -ForegroundColor Green
    } else {
        Write-Host "❌ Port 3001 - API Gateway" -ForegroundColor Red
    }

    if ($port4001) {
        Write-Host "✅ Port 4001 - WebSocket Service" -ForegroundColor Green
    } else {
        Write-Host "❌ Port 4001 - WebSocket Service" -ForegroundColor Red
    }

    Write-Host ""
    Write-Host "📱 Service URLs:" -ForegroundColor Blue
    Write-Host "==================" -ForegroundColor Blue
    Write-Host "🌐 Frontend:           http://localhost:3000  (starting next...)" -ForegroundColor Cyan
    Write-Host "🔗 API Gateway:        http://localhost:3001" -ForegroundColor Cyan
    Write-Host "📥 Ingestion Engine:   http://localhost:3000/api/v1/ingestion" -ForegroundColor Cyan
    Write-Host "🔌 WebSocket Service:  ws://localhost:4001" -ForegroundColor Cyan
    Write-Host "💾 ArangoDB:           http://localhost:8529" -ForegroundColor Cyan

    Write-Host ""
    Write-Host "📝 Service logs are available in the logs\ directory" -ForegroundColor Gray
    Write-Host "🛑 Press Ctrl+C to stop all services" -ForegroundColor Yellow
    Write-Host "⏳ Starting Frontend development server..." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "======================================================" -ForegroundColor Green

    # Start Frontend (runs in current window for easy monitoring)
    Set-Location "apps\frontend"
    try {
        npm run dev
    } finally {
        # When frontend exits, cleanup
        Set-Location $PSScriptRoot
        Write-Host ""
        Write-Host "🛑 Frontend stopped. Cleaning up background services..." -ForegroundColor Yellow
        Stop-BackgroundServices
        Write-Host "✅ Cleanup complete." -ForegroundColor Green
    }

} catch {
    Write-Host "❌ Startup failed: $_" -ForegroundColor Red
    Stop-BackgroundServices
    exit 1
}
