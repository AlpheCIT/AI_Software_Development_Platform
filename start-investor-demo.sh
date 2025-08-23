#!/bin/bash

# 🚀 AI Software Development Platform - Complete Startup Script
# This script starts the complete investor-ready frontend with backend integration

echo "🚀 Starting AI Software Development Platform - Investor Ready Frontend"
echo "=================================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check if a port is in use
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null ; then
        return 0
    else
        return 1
    fi
}

# Function to start service in background
start_service() {
    local name=$1
    local command=$2
    local port=$3
    
    echo -e "${BLUE}Starting $name on port $port...${NC}"
    
    if check_port $port; then
        echo -e "${YELLOW}⚠️  Port $port is already in use. Skipping $name.${NC}"
    else
        eval $command &
        local pid=$!
        echo -e "${GREEN}✅ $name started with PID $pid${NC}"
        sleep 2
    fi
}

# Check prerequisites
echo -e "${BLUE}Checking prerequisites...${NC}"

# Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed. Please install Node.js 18+ and try again.${NC}"
    exit 1
fi

# Check npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm is not installed. Please install npm and try again.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Prerequisites check passed${NC}"
echo ""

# Navigate to project root
cd "$(dirname "$0")"

# Install dependencies if needed
echo -e "${BLUE}Installing dependencies...${NC}"

# Install root dependencies
if [ -f "package.json" ]; then
    npm install --silent
fi

# Install frontend dependencies
if [ -f "apps/frontend/package.json" ]; then
    cd apps/frontend
    npm install --silent
    cd ../..
fi

echo -e "${GREEN}✅ Dependencies installed${NC}"
echo ""

# Start services
echo -e "${BLUE}Starting services...${NC}"
echo ""

# Start Frontend API Gateway (Mock backend for development)
start_service "Frontend API Gateway" "node services/frontend-api-gateway.js" 3001

# Start Frontend Development Server
start_service "Frontend App" "cd apps/frontend && npm run dev" 5173

# Wait for services to start
echo ""
echo -e "${BLUE}Waiting for services to initialize...${NC}"
sleep 5

# Check service health
echo ""
echo -e "${BLUE}Checking service health...${NC}"

# Check API Gateway
if check_port 3001; then
    echo -e "${GREEN}✅ API Gateway: http://localhost:3001${NC}"
    echo -e "   Health check: http://localhost:3001/health"
else
    echo -e "${RED}❌ API Gateway failed to start${NC}"
fi

# Check Frontend
if check_port 5173; then
    echo -e "${GREEN}✅ Frontend App: http://localhost:5173${NC}"
else
    echo -e "${RED}❌ Frontend App failed to start${NC}"
fi

echo ""
echo "=================================================================="
echo -e "${GREEN}🎉 AI SOFTWARE DEVELOPMENT PLATFORM READY!${NC}"
echo "=================================================================="
echo ""
echo -e "${YELLOW}📱 APPLICATION ACCESS:${NC}"
echo "   🌐 Frontend: http://localhost:5173"
echo "   🔗 API Gateway: http://localhost:3001"
echo "   📊 Health Check: http://localhost:3001/health"
echo ""
echo -e "${YELLOW}✨ INVESTOR DEMO FEATURES:${NC}"
echo "   📥 Repository Ingestion - Input any GitHub URL"
echo "   📊 Real-time Progress - Watch live collection population"
echo "   🎨 Graph Visualization - Interactive repository structure"
echo "   🔍 Advanced Inspector - 7-tab detailed analysis"
echo "   📱 Mobile Responsive - Works on all devices"
echo ""
echo -e "${YELLOW}🎯 DEMO REPOSITORIES TO TRY:${NC}"
echo "   • https://github.com/facebook/react"
echo "   • https://github.com/microsoft/typescript"
echo "   • https://github.com/express/express"
echo ""
echo -e "${BLUE}💡 To stop all services, press Ctrl+C${NC}"
echo ""

# Keep script running and handle shutdown
cleanup() {
    echo ""
    echo -e "${YELLOW}🛑 Shutting down services...${NC}"
    
    # Kill all background jobs
    jobs -p | xargs -r kill
    
    # Kill services on specific ports
    for port in 3001 5173; do
        if check_port $port; then
            lsof -ti:$port | xargs -r kill
            echo -e "${GREEN}✅ Stopped service on port $port${NC}"
        fi
    done
    
    echo -e "${GREEN}👋 All services stopped. Goodbye!${NC}"
    exit 0
}

# Trap Ctrl+C
trap cleanup INT

# Wait for user interrupt
while true; do
    sleep 1
done