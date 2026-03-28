# Getting Started with AI Software Development Platform

Welcome to the AI Software Development Platform! This guide will help you get up and running quickly.

## 🎯 What You'll Achieve

By the end of this guide, you'll have:
- ✅ A fully functional AI code analysis system
- ✅ ArangoDB graph database running locally
- ✅ REST API with real-time WebSocket updates
- ✅ Modern React dashboard for visualization
- ✅ Your first repository analyzed with AI insights

## 📋 Prerequisites

### Required Software

1. **Node.js 18+** and **npm 9+**
   ```bash
   node --version  # Should be v18.0.0 or higher
   npm --version   # Should be 9.0.0 or higher
   ```
   
   📥 [Download Node.js](https://nodejs.org/)

2. **ArangoDB 3.9+**
   ```bash
   # Windows (using Chocolatey)
   choco install arangodb
   
   # macOS (using Homebrew)
   brew install arangodb
   
   # Ubuntu/Debian
   sudo apt-get install arangodb3
   
   # Or use Docker
   docker run -p 8529:8529 -e ARANGO_ROOT_PASSWORD=<your-arango-password> arangodb:3.11
   ```
   
   📥 [Download ArangoDB](https://www.arangodb.com/download/)

3. **Git** (for cloning and repository analysis)
   ```bash
   git --version
   ```

### Optional but Recommended

- **Docker** and **Docker Compose** (for containerized deployment)
- **VS Code** with recommended extensions
- **Postman** or similar API testing tool

## 🚀 Quick Installation

### 1. Clone and Setup

```bash
# Clone the repository
git clone https://github.com/your-org/ai-code-management-system-v2.git
cd ai-code-management-system-v2

# Install dependencies
npm install

# Copy environment configuration
cp .env.example .env
```

### 2. Configure Environment

Edit the `.env` file with your settings:

```bash
# Database configuration
ARANGO_URL=http://localhost:8529
ARANGODB_USER=root
ARANGO_PASSWORD=<your-arango-password>

# API configuration
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

# Optional: AI services
OPENAI_API_KEY=your-openai-api-key  # For enhanced AI insights
```

### 3. Initialize Database

```bash
# Setup database with schema and initial data
npm run db:setup
```

You should see output like:
```
🚀 Setting up AI Software Development Platform Database...
✅ Database initialized
✅ Database seeded
🎉 Setup completed successfully!
```

### 4. Start the System

```bash
# Start all services
npm start
```

The system will start and display:
```
🚀 AI Software Development Platform is ready!

📋 System Configuration:
🗄️  Database: localhost:8529/ARANGO_AISDP_DB
🌐 API Gateway: http://0.0.0.0:3001
📚 API Docs: http://0.0.0.0:3001/api/docs
❤️  Health Check: http://0.0.0.0:3001/health
```

## 🧪 Verify Installation

### 1. Check API Health

```bash
curl http://localhost:3001/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 123.456,
  "version": "2.0.0"
}
```

### 2. Check Database Status

```bash
npm run db:status
```

Expected output:
```
🔍 Checking database status...
✅ Database connection successful!

📊 Database Statistics:
📁 Document Collections:
  repositories                    0
  files                          0
  functions                      0
  ...

🔗 Edge Collections:
  depends_on                     0
  imports                        0
  ...
```

### 3. Browse API Documentation

Open http://localhost:3001/api/docs in your browser to explore the interactive API documentation.

## 📊 Your First Analysis

Let's analyze a sample repository to see the system in action!

### 1. Prepare a Repository

You can use any JavaScript/TypeScript project. For this example, we'll create a simple test repository:

```bash
# Create a test repository
mkdir test-repo
cd test-repo

# Initialize with some sample files
cat > package.json << EOF
{
  "name": "test-repository",
  "version": "1.0.0",
  "dependencies": {
    "express": "^4.18.0",
    "lodash": "^4.17.21"
  }
}
EOF

cat > index.js << EOF
const express = require('express');
const _ = require('lodash');

// Potential security issue for demonstration
const password = "hardcoded-password-123";

function complexFunction(data) {
  // High complexity function for demonstration
  if (data.length > 0) {
    for (let i = 0; i < data.length; i++) {
      if (data[i].type === 'user') {
        if (data[i].active) {
          if (data[i].permissions.includes('admin')) {
            return processAdminUser(data[i]);
          } else if (data[i].permissions.includes('moderator')) {
            return processModerator(data[i]);
          } else {
            return processRegularUser(data[i]);
          }
        }
      }
    }
  }
  return null;
}

function processAdminUser(user) {
  return { ...user, accessLevel: 'admin' };
}

const app = express();
app.listen(3000);
EOF

cd ..
```

### 2. Run Analysis

```bash
# Analyze the repository
npm run analyze ./test-repo
```

You'll see real-time progress:
```
🔍 Starting repository analysis: ./test-repo
✅ Created repository: test-repository
📊 Analysis progress: 2/2 files processed
🔍 Performing repository-level analysis
✅ Repository analysis completed!

📊 Analysis Results:
   Files analyzed: 2
   Dependencies found: 2
   Security issues: 1
   Performance insights: 1
```

### 3. Explore Results via API

```bash
# Get repository list
curl http://localhost:3001/api/v1/repositories

# Get security findings
curl http://localhost:3001/api/v1/repositories/YOUR_REPO_ID/security-findings

# Get dependency graph
curl http://localhost:3001/api/v1/repositories/YOUR_REPO_ID/dependency-graph
```

## 🎨 Frontend Dashboard (Coming Soon)

The React dashboard is under development. For now, you can:

1. **Use the API directly** via curl or Postman
2. **Explore the interactive API docs** at http://localhost:3001/api/docs
3. **Monitor via command line** with `npm run status`

## 🔧 Development Mode

For active development with hot reload:

```bash
# Start in development mode
npm run dev

# Or start individual services
npm run dev:api        # API only
npm run dev:dashboard  # Frontend only (when available)
```

## 🐳 Docker Alternative

If you prefer Docker:

```bash
# Start with Docker Compose
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f api

# Stop services
docker-compose down
```

## 📈 Next Steps

Now that you have the system running:

### 1. Analyze Real Repositories

```bash
# Analyze your actual projects
npm run analyze /path/to/your/project

# With custom options
npm run analyze /path/to/project -- --batch-size 20 --file-patterns "*.js,*.ts"
```

### 2. Explore Advanced Features

- **Search code**: `GET /api/v1/search/code?q=function_name`
- **Get AI insights**: `GET /api/v1/repositories/:id/ai-insights`
- **Monitor trends**: `GET /api/v1/repositories/:id/quality-trends`
- **Dependency analysis**: `GET /api/v1/repositories/:id/dependencies`

### 3. Integration Examples

#### Using curl
```bash
# Create a repository
curl -X POST http://localhost:3001/api/v1/repositories \
  -H "Content-Type: application/json" \
  -d '{"name": "my-project", "url": "https://github.com/user/repo"}'

# Start analysis
curl -X POST http://localhost:3001/api/v1/repositories/REPO_ID/analyze \
  -H "Content-Type: application/json" \
  -d '{"repositoryPath": "/path/to/repo"}'
```

#### Using JavaScript
```javascript
const apiClient = axios.create({
  baseURL: 'http://localhost:3001/api/v1'
});

// Get repository health score
const healthScore = await apiClient.get('/repositories/REPO_ID/health-score');
console.log('Health Score:', healthScore.data);

// Search for functions
const functions = await apiClient.get('/search/functions?q=authenticate');
console.log('Functions:', functions.data);
```

### 4. Customize Analysis

Create custom analysis configurations:

```javascript
// analysis-config.js
module.exports = {
  filePatterns: ['*.js', '*.ts', '*.jsx', '*.tsx'],
  ignorePatterns: [
    'node_modules/**',
    'dist/**',
    'build/**',
    '*.test.js'
  ],
  securityPatterns: {
    customPattern: /sensitive[_-]?data\s*=\s*['"][^'"]*['"]/i
  },
  complexityThreshold: 15,
  batchSize: 20
};
```

## 🔧 Troubleshooting

### Common Issues

#### ArangoDB Connection Failed
```bash
# Check if ArangoDB is running
curl http://localhost:8529/_api/version

# If not running, start it
# Windows
net start ArangoDB

# macOS/Linux
brew services start arangodb
# or
sudo systemctl start arangodb3
```

#### Port Already in Use
```bash
# Find process using port 3001
lsof -i :3001

# Kill the process (replace PID)
kill -9 PID

# Or use a different port
PORT=3002 npm start
```

#### Permission Errors
```bash
# Fix file permissions
chmod +x scripts/db-init.js
chmod +x src/index.js

# Or run with sudo (not recommended for development)
sudo npm start
```

#### Memory Issues with Large Repositories
```bash
# Increase Node.js memory limit
node --max-old-space-size=4096 src/index.js analyze /large/repo

# Use smaller batch size
npm run analyze /large/repo -- --batch-size 5
```

### Getting Help

1. **Check logs**: `tail -f logs/app.log`
2. **Database status**: `npm run db:status`
3. **System status**: `npm run status`
4. **API health**: `curl http://localhost:3001/health`

## 🎯 Production Deployment

When you're ready to deploy to production:

### 1. Environment Setup
```bash
# Set production environment
export NODE_ENV=production
export ARANGO_PASSWORD=<your-arango-password>
```

### 2. Security Considerations
- Change default passwords
- Enable HTTPS with SSL certificates
- Configure firewall rules
- Set up monitoring and logging
- Enable authentication

### 3. Docker Production Deployment
```bash
# Build production images
docker-compose -f docker-compose.prod.yml build

# Deploy
docker-compose -f docker-compose.prod.yml up -d
```

## 🔄 Regular Maintenance

### Daily Tasks
```bash
# Check system health
npm run status

# Review logs
tail -f logs/app.log
```

### Weekly Tasks
```bash
# Database maintenance
npm run db:status

# Security audit
npm run security:audit

# Performance check
npm run performance:benchmark
```

### Monthly Tasks
```bash
# Update dependencies
npm audit fix
npm update

# Backup database
npm run db:backup

# Review metrics
curl http://localhost:3001/api/v1/analytics/overview
```

## 📚 Additional Resources

- **API Documentation**: http://localhost:3001/api/docs
- **ArangoDB Web Interface**: http://localhost:8529
- **Performance Monitoring**: Set up Grafana + Prometheus
- **Code Examples**: See `examples/` directory
- **Contributing Guide**: See `CONTRIBUTING.md`

## 🎉 You're All Set!

Congratulations! You now have a fully functional AI Software Development Platform. 

**What you can do now:**
- ✅ Analyze code repositories with AI-powered insights
- ✅ Track dependencies and complexity metrics
- ✅ Monitor security vulnerabilities
- ✅ Generate performance recommendations
- ✅ Explore code relationships through graph visualization
- ✅ Search across your entire codebase
- ✅ Get real-time analysis updates

**Next steps:**
1. Analyze your real projects
2. Set up monitoring and alerts
3. Integrate with your CI/CD pipeline
4. Explore the advanced API features
5. Contribute to the project!

Happy coding! 🚀

---

**Need help?** Join our community:
- 📧 Email: richard@alphavirtusai.com
- 💬 GitHub Discussions
- 🐛 Report Issues on GitHub
- 📖 Read the full documentation

*Built with ❤️ for developers who care about code quality*
