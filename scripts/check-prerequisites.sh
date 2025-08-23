#!/bin/bash

# Prerequisites Check Script for AI Software Development Platform

echo "🔍 Checking Prerequisites for AI Software Development Platform..."
echo "=================================================="

# Check Node.js
echo -n "📦 Node.js: "
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo "✅ $NODE_VERSION"
    if [[ "$NODE_VERSION" < "v18" ]]; then
        echo "⚠️  Warning: Node.js 18+ recommended (you have $NODE_VERSION)"
    fi
else
    echo "❌ Not installed"
    echo "   Please install Node.js 18+ from https://nodejs.org/"
fi

# Check npm
echo -n "📦 npm: "
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    echo "✅ v$NPM_VERSION"
else
    echo "❌ Not installed"
fi

# Check Git
echo -n "📦 Git: "
if command -v git &> /dev/null; then
    GIT_VERSION=$(git --version)
    echo "✅ $GIT_VERSION"
else
    echo "❌ Not installed"
    echo "   Please install Git from https://git-scm.com/"
fi

# Check ArangoDB
echo -n "📦 ArangoDB: "
if command -v arangod &> /dev/null; then
    ARANGO_VERSION=$(arangod --version 2>/dev/null | head -1)
    echo "✅ $ARANGO_VERSION"
else
    echo "❌ Not installed"
    echo "   Please install ArangoDB from https://www.arangodb.com/download/"
fi

# Load environment variables if .env exists
if [ -f ".env" ]; then
    source .env 2>/dev/null || true
fi

# Set defaults if not set
ARANGO_HOST=${ARANGO_HOST:-localhost}
ARANGO_PORT=${ARANGO_PORT:-8529}
ARANGO_URL=${ARANGO_URL:-http://$ARANGO_HOST:$ARANGO_PORT}

# Check if ArangoDB is running
echo -n "🔌 ArangoDB Service: "
if curl -s $ARANGO_URL/_api/version &> /dev/null; then
    echo "✅ Running on $ARANGO_URL"
else
    echo "❌ Not running or not accessible at $ARANGO_URL"
    echo "   Please start ArangoDB service"
fi

# Check Docker (optional)
echo -n "🐳 Docker (optional): "
if command -v docker &> /dev/null; then
    DOCKER_VERSION=$(docker --version)
    echo "✅ $DOCKER_VERSION"
else
    echo "ℹ️  Not installed (optional for containerized deployment)"
fi

echo ""
echo "🎯 Next Steps:"
echo "1. Install any missing prerequisites"
echo "2. Start ArangoDB if not running"
echo "3. Run the setup script: npm run setup"
