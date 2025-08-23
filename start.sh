#!/bin/bash

# AI Software Development Platform Startup Script
# This script starts both the backend API and frontend dashboard

set -e

echo "🚀 Starting AI Software Development Platform..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BACKEND_DIR="services/api-gateway/src/analyzer-legacy"
FRONTEND_DIR="apps/web-dashboard"
BACKEND_PORT=8000
FRONTEND_PORT=3000

# Function to check if port is in use
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Function to start backend
start_backend() {
    echo -e "${BLUE}Starting FastAPI Backend...${NC}"
    
    if check_port $BACKEND_PORT; then
        echo -e "${YELLOW}Backend already running on port $BACKEND_PORT${NC}"
    else
        cd $BACKEND_DIR
        
        # Check if python virtual environment exists
        if [ ! -d "venv" ]; then
            echo "Creating Python virtual environment..."
            python -m venv venv
        fi
        
        # Activate virtual environment
        source venv/bin/activate || source venv/Scripts/activate
        
        # Install dependencies
        if [ -f "requirements.txt" ]; then
            echo "Installing Python dependencies..."
            pip install -r requirements.txt
        fi
        
        # Start FastAPI server
        echo -e "${GREEN}Starting FastAPI server on port $BACKEND_PORT...${NC}"
        uvicorn app:app --host 0.0.0.0 --port $BACKEND_PORT --reload &
        BACKEND_PID=$!
        
        cd - > /dev/null
    fi
}

# Function to start frontend
start_frontend() {
    echo -e "${BLUE}Starting React Frontend...${NC}"
    
    if check_port $FRONTEND_PORT; then
        echo -e "${YELLOW}Frontend already running on port $FRONTEND_PORT${NC}"
    else
        cd $FRONTEND_DIR
        
        # Install dependencies if node_modules doesn't exist
        if [ ! -d "node_modules" ]; then
            echo "Installing Node.js dependencies..."
            pnpm install
        fi
        
        # Start development server
        echo -e "${GREEN}Starting React development server on port $FRONTEND_PORT...${NC}"
        pnpm dev &
        FRONTEND_PID=$!
        
        cd - > /dev/null
    fi
}

# Function to check services
check_services() {
    echo -e "${BLUE}Checking services...${NC}"
    
    # Check backend
    sleep 3
    if curl -s http://localhost:$BACKEND_PORT/api/health > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Backend API is running at http://localhost:$BACKEND_PORT${NC}"
        echo -e "   📊 API Documentation: http://localhost:$BACKEND_PORT/docs"
    else
        echo -e "${RED}❌ Backend API failed to start${NC}"
    fi
    
    # Check frontend
    sleep 2
    if curl -s http://localhost:$FRONTEND_PORT > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Frontend Dashboard is running at http://localhost:$FRONTEND_PORT${NC}"
    else
        echo -e "${YELLOW}⏳ Frontend is starting up...${NC}"
    fi
}

# Function to show status
show_status() {
    echo ""
    echo -e "${BLUE}=== AI Software Development Platform Status ===${NC}"
    echo -e "${GREEN}🖥️  Frontend Dashboard: http://localhost:$FRONTEND_PORT${NC}"
    echo -e "${GREEN}🔧 Backend API:        http://localhost:$BACKEND_PORT${NC}"
    echo -e "${GREEN}📚 API Documentation:  http://localhost:$BACKEND_PORT/docs${NC}"
    echo -e "${GREEN}📈 System Status:      http://localhost:$BACKEND_PORT/api/system/status${NC}"
    echo ""
    echo -e "${YELLOW}Press Ctrl+C to stop all services${NC}"
}

# Function to cleanup on exit
cleanup() {
    echo -e "\n${YELLOW}Stopping services...${NC}"
    
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null || true
    fi
    
    if [ ! -z "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null || true
    fi
    
    # Kill any remaining processes on our ports
    pkill -f "uvicorn.*app:app" || true
    pkill -f "vite.*dev" || true
    
    echo -e "${GREEN}All services stopped.${NC}"
    exit 0
}

# Set up signal handling
trap cleanup SIGINT SIGTERM

# Main execution
main() {
    echo -e "${GREEN}🚀 AI Software Development Platform Startup${NC}"
    echo ""
    
    # Check if we're in the right directory
    if [ ! -d "$BACKEND_DIR" ] || [ ! -d "$FRONTEND_DIR" ]; then
        echo -e "${RED}Error: Please run this script from the project root directory${NC}"
        echo "Expected structure:"
        echo "  - $BACKEND_DIR/"
        echo "  - $FRONTEND_DIR/"
        exit 1
    fi
    
    # Start services
    start_backend
    start_frontend
    
    # Check services
    check_services
    
    # Show status
    show_status
    
    # Wait for user interrupt
    while true; do
        sleep 1
    done
}

# Run main function
main "$@"
