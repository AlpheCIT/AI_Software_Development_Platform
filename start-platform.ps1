#!/usr/bin/env pwsh
# 🚀 AI Software Development Platform - COMPLETE UNIFIED STARTUP SCRIPT (PowerShell)
# Cross-platform startup script for Windows/Linux/macOS

param(
    [switch]$NoTest,
    [switch]$Quiet
)

Write-Host ""
Write-Host "████████████████████████████████████████████████████████████████████████████████" -ForegroundColor Blue
Write-Host "🚀 AI SOFTWARE DEVELOPMENT PLATFORM - COMPLETE STARTUP" -ForegroundColor Blue  
Write-Host "████████████████████████████████████████████████████████████████████████████████" -ForegroundColor Blue
Write-Host ""

# Function to test if a port is in use
function Test-Port {
    param([int]$Port)
    
    try {
        $connection = New-Object System.Net.Sockets.TcpClient
        $connection.Connect('127.0.0.1', $Port)
        $connection.Close()
        return $true
    }
    catch {
        return $false
    }
}

# Function to wait for service to be ready
function Wait-ForService {
    param(
        [string]$Url,
        [string]$ServiceName,
        [int]$MaxAttempts = 30
    )
    
    Write-Host "⏳ Waiting for $ServiceName to be ready..." -ForegroundColor Yellow
    
    for ($i = 1; $i -le $MaxAttempts; $i++) {
        try {
            $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2
            if ($response.StatusCode -eq 200) {
                Write-Host "✅ $ServiceName is ready!" -ForegroundColor Green
                return $true
            }
        }
        catch {
            Write-Host "." -NoNewline -ForegroundColor Yellow
            Start-Sleep -Seconds 2
        }
    }
    
    Write-Host ""
    Write-Host "❌ $ServiceName failed to start within timeout" -ForegroundColor Red
    return $false
}

# Prerequisites check
Write-Host "🔍 STEP 1: Checking Prerequisites..." -ForegroundColor Blue
Write-Host "========================================" -ForegroundColor Blue

# Check Node.js
try {
    $nodeVersion = node --version
    Write-Host "✅ Node.js: $nodeVersion" -ForegroundColor Green
}
catch {
    Write-Host "❌ Node.js is not installed. Please install Node.js 18+ and try again." -ForegroundColor Red
    exit 1
}

# Check npm
try {
    $npmVersion = npm --version
    Write-Host "✅ npm: v$npmVersion" -ForegroundColor Green
}
catch {
    Write-Host "❌ npm is not installed. Please install npm and try again." -ForegroundColor Red
    exit 1
}

# Check Docker (optional)
try {
    docker --version | Out-Null
    Write-Host "✅ Docker is available" -ForegroundColor Green
}
catch {
    Write-Host "⚠️  Docker not found. Please ensure ArangoDB is running manually." -ForegroundColor Yellow
}

Write-Host ""

# Database check
Write-Host "🗄️  STEP 2: Checking ArangoDB Database..." -ForegroundColor Blue
Write-Host "=========================================" -ForegroundColor Blue

# Check if ArangoDB is accessible
try {
    $response = Invoke-WebRequest -Uri "http://localhost:8529/_api/version" -UseBasicParsing -TimeoutSec 5
    Write-Host "✅ ArangoDB is accessible on port 8529" -ForegroundColor Green
}
catch {
    Write-Host "❌ ArangoDB is not accessible" -ForegroundColor Red
    Write-Host "Please ensure ArangoDB is running:" -ForegroundColor Yellow
    Write-Host "docker run -d -p 8529:8529 -e ARANGO_ROOT_PASSWORD=password --name aisdp_db arangodb:3.11" -ForegroundColor Yellow
    exit 1
}

Write-Host ""

# Dependencies installation
Write-Host "📦 STEP 3: Installing Dependencies..." -ForegroundColor Blue
Write-Host "=====================================" -ForegroundColor Blue

# Install root dependencies
if (Test-Path "package.json") {
    Write-Host "Installing root dependencies..." -ForegroundColor Cyan
    npm install --silent
    Write-Host "✅ Root dependencies installed" -ForegroundColor Green
}

# Install frontend dependencies  
if (Test-Path "apps/frontend/package.json") {
    Write-Host "Installing frontend dependencies..." -ForegroundColor Cyan
    Push-Location "apps/frontend"
    npm install --silent
    Pop-Location
    Write-Host "✅ Frontend dependencies installed" -ForegroundColor Green
}

# Install MCP server dependencies
if (Test-Path "arangodb-ai-platform-mcp/package.json") {
    Write-Host "Installing MCP server dependencies..." -ForegroundColor Cyan
    Push-Location "arangodb-ai-platform-mcp"
    npm install --silent
    Pop-Location
    Write-Host "✅ MCP server dependencies installed" -ForegroundColor Green
}

Write-Host ""

# Port availability check
Write-Host "🔌 STEP 4: Checking Port Availability..." -ForegroundColor Blue
Write-Host "========================================" -ForegroundColor Blue

$portsToCheck = @(3000, 3001, 3002)
foreach ($port in $portsToCheck) {
    if (Test-Port -Port $port) {
        Write-Host "❌ Port $port is already in use. Please stop the service and try again." -ForegroundColor Red
        exit 1
    }
    else {
        Write-Host "✅ Port $port is available" -ForegroundColor Green
    }
}

Write-Host ""

# Service startup
Write-Host "🚀 STEP 5: Starting All Services..." -ForegroundColor Blue
Write-Host "==================================" -ForegroundColor Blue

# Start MCP HTTP Server
Write-Host "Starting MCP HTTP Server on port 3002..." -ForegroundColor Cyan
if ($IsWindows -or $PSVersionTable.PSVersion.Major -le 5) {
    Start-Process -FilePath "cmd" -ArgumentList "/c", "cd arangodb-ai-platform-mcp && node http-server.js" -WindowStyle Minimized
}
else {
    Start-Process -FilePath "node" -ArgumentList "arangodb-ai-platform-mcp/http-server.js" -WindowStyle Hidden
}

# Wait and verify MCP server
if (Wait-ForService -Url "http://localhost:3002/health" -ServiceName "MCP HTTP Server") {
    Write-Host "✅ MCP HTTP Server started successfully" -ForegroundColor Green
}

# Start API Gateway
Write-Host "Starting API Gateway on port 3001..." -ForegroundColor Cyan
if ($IsWindows -or $PSVersionTable.PSVersion.Major -le 5) {
    Start-Process -FilePath "cmd" -ArgumentList "/c", "node services/frontend-api-gateway.js" -WindowStyle Minimized
}
else {
    Start-Process -FilePath "node" -ArgumentList "services/frontend-api-gateway.js" -WindowStyle Hidden
}

# Wait and verify API Gateway
if (Wait-ForService -Url "http://localhost:3001/health" -ServiceName "API Gateway") {
    Write-Host "✅ API Gateway started successfully" -ForegroundColor Green
}

# Start Frontend
Write-Host "Starting Frontend on port 3000..." -ForegroundColor Cyan
if ($IsWindows -or $PSVersionTable.PSVersion.Major -le 5) {
    Start-Process -FilePath "cmd" -ArgumentList "/c", "cd apps/frontend && npm run dev" -WindowStyle Minimized
}
else {
    Start-Process -FilePath "bash" -ArgumentList "-c", "cd apps/frontend && npm run dev" -WindowStyle Hidden
}

Start-Sleep -Seconds 5

Write-Host ""

# Final verification
Write-Host "🔍 STEP 6: Final Service Verification..." -ForegroundColor Blue
Write-Host "=======================================" -ForegroundColor Blue

$services = @(
    @{Name = "ArangoDB"; Url = "http://localhost:8529/_api/version"; Port = 8529},
    @{Name = "MCP Server"; Url = "http://localhost:3002/health"; Port = 3002},
    @{Name = "API Gateway"; Url = "http://localhost:3001/health"; Port = 3001},
    @{Name = "Frontend"; Url = "http://localhost:3000"; Port = 3000}
)

$allHealthy = $true

foreach ($service in $services) {
    try {
        $response = Invoke-WebRequest -Uri $service.Url -UseBasicParsing -TimeoutSec 3
        Write-Host "✅ $($service.Name) ($($service.Port)): Healthy" -ForegroundColor Green
    }
    catch {
        Write-Host "❌ $($service.Name) ($($service.Port)): Not responding" -ForegroundColor Red
        $allHealthy = $false
    }
}

Write-Host ""
Write-Host "████████████████████████████████████████████████████████████████████████████████" -ForegroundColor Blue
Write-Host "🎉 AI SOFTWARE DEVELOPMENT PLATFORM STATUS" -ForegroundColor Blue
Write-Host "████████████████████████████████████████████████████████████████████████████████" -ForegroundColor Blue
Write-Host ""

if ($allHealthy) {
    Write-Host "🎉 ALL SERVICES ARE HEALTHY! PLATFORM IS READY! 🎉" -ForegroundColor Green
}
else {
    Write-Host "⚠️  Some services need attention. Check above for details." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "📱 APPLICATION ACCESS:" -ForegroundColor Green
Write-Host "   🌐 Frontend:     http://localhost:3000" -ForegroundColor White
Write-Host "   🔗 API Gateway:  http://localhost:3001" -ForegroundColor White
Write-Host "   📊 MCP Server:   http://localhost:3002" -ForegroundColor White
Write-Host "   🗄️  ArangoDB:    http://localhost:8529" -ForegroundColor White
Write-Host ""
Write-Host "🔍 HEALTH CHECKS:" -ForegroundColor Green
Write-Host "   • API Gateway:   http://localhost:3001/health" -ForegroundColor White
Write-Host "   • MCP Server:    http://localhost:3002/health" -ForegroundColor White
Write-Host "   • ArangoDB:      http://localhost:8529/_api/version" -ForegroundColor White
Write-Host ""

# Open browser
Write-Host "🌐 Opening application in browser..." -ForegroundColor Cyan
Start-Process "http://localhost:3000"

Write-Host ""
Write-Host "✅ Platform startup complete!" -ForegroundColor Green
Write-Host "🛑 Use STOP_PLATFORM.bat to shutdown all services" -ForegroundColor Yellow
Write-Host ""

# Run tests if requested
if (-not $NoTest) {
    Write-Host "🧪 Running platform tests..." -ForegroundColor Blue
    & "./TEST_PLATFORM.bat"
}
