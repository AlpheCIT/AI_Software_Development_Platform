# 🚀 AI Software Development Platform - STARTUP GUIDE

## 📋 Quick Reference

| Action | Command | Description |
|--------|---------|-------------|
| **🚀 Start Everything** | `START_COMPLETE_PLATFORM.bat` | One-click startup of all services |
| **🧪 Test Platform** | `SIMPLE_TEST.bat` | Quick health check of all services |
| **🛑 Stop Everything** | `STOP_PLATFORM.bat` | Clean shutdown of all services |
| **🔍 Check Status** | `netstat -ano \| findstr ":300"` | See what ports are in use |

---

## 🎯 Complete Platform Startup

### **Windows (Recommended)**
```batch
# Double-click or run from command line:
START_COMPLETE_PLATFORM.bat
```

### **Cross-Platform PowerShell**
```powershell
.\start-platform.ps1
```

### **What Gets Started:**
1. ✅ **ArangoDB Database** (Docker) - Port 8529
2. ✅ **MCP HTTP Server** - Port 3002  
3. ✅ **API Gateway** (Express + WebSocket) - Port 3001
4. ✅ **React Frontend** (Vite Dev Server) - Port 3000

---

## 🧪 Testing & Verification

### **Quick Health Check**
```batch
SIMPLE_TEST.bat
```

### **Manual Service Tests**
```batch
# Test individual services:
curl http://localhost:8529/_api/version      # ArangoDB
curl http://localhost:3002/health            # MCP Server  
curl http://localhost:3001/health            # API Gateway
curl http://localhost:3000                   # Frontend
```

### **Expected Test Results:**
- ✅ **ArangoDB Database Connection**: Should return version info
- ✅ **MCP Server Health Check**: Should return `{"status":"healthy"}`
- ✅ **API Gateway Health Check**: Should return health status  
- ✅ **Frontend Service Running**: Port 3000 should be listening
- ✅ **Production Mode Configuration**: `DEMO_MODE=false` in .env
- ✅ **MCP Collections Endpoint**: Should return collection data
- ✅ **API Gateway CORS Support**: Should accept cross-origin requests

---

## 🌐 Service Access Points

### **Primary Application**
- **🎨 Frontend Dashboard**: http://localhost:3000
  - Main React application with investor-ready interface
  - Repository ingestion and visualization
  - Real-time progress tracking

### **Backend Services**
- **🔗 API Gateway**: http://localhost:3001
  - RESTful API endpoints
  - WebSocket support for real-time updates
  - Health: http://localhost:3001/health

- **📊 MCP Server**: http://localhost:3002  
  - ArangoDB bridge with HTTP wrapper
  - Collections: http://localhost:3002/browse-collections
  - Analytics: http://localhost:3002/analytics
  - Health: http://localhost:3002/health

- **🗄️ ArangoDB**: http://localhost:8529
  - Graph database with real data collections
  - Version: http://localhost:8529/_api/version
  - Web UI: http://localhost:8529/_db/_system/_admin/aardvark/

---

## 🔧 Troubleshooting

### **Common Issues & Solutions**

#### **❌ "Port already in use"**
```batch
# Check what's using ports:
netstat -ano | findstr ":300"

# Stop all Node services:
taskkill /F /IM node.exe

# Or use clean shutdown:
STOP_PLATFORM.bat
```

#### **❌ "ArangoDB not accessible"**
```batch
# Check Docker container:
docker ps | findstr arangodb

# Start ArangoDB if needed:
docker run -d -p 8529:8529 -e ARANGO_ROOT_PASSWORD=password --name aisdp_db arangodb:3.11
```

#### **❌ "MCP Server not responding"**
```batch
# Check MCP dependencies:
cd arangodb-ai-platform-mcp
npm install

# Test MCP server manually:
cd arangodb-ai-platform-mcp
node http-server.js
```

#### **❌ "Frontend not loading"**
```batch
# Check frontend dependencies:
cd apps/frontend  
npm install

# Start frontend manually:
cd apps/frontend
npm run dev
```

### **Service Dependencies**
```
┌─────────────────────────────────────────────┐
│ DEPENDENCY CHAIN:                           │
│                                             │
│ 1. ArangoDB (Docker) ← Must be running     │
│ 2. MCP Server ← Connects to ArangoDB       │
│ 3. API Gateway ← Uses MCP Server           │
│ 4. Frontend ← Connects to API Gateway      │
│                                             │
│ Start in this order for best results!      │
└─────────────────────────────────────────────┘
```

---

## 🎯 Demo & Investor Presentation

### **Pre-Demo Checklist**
- [ ] Run `START_COMPLETE_PLATFORM.bat`
- [ ] Wait 10-15 seconds for all services to initialize  
- [ ] Run `SIMPLE_TEST.bat` to verify all systems
- [ ] Open http://localhost:3000 in browser
- [ ] Confirm all 4 services show as healthy

### **Demo URLs to Bookmark**
- **🌐 Main App**: http://localhost:3000
- **📊 Health Dashboard**: http://localhost:3001/health
- **🗄️ Database UI**: http://localhost:8529/_db/_system/_admin/aardvark/

### **Test Repositories for Demo**
```
https://github.com/facebook/react
https://github.com/microsoft/typescript  
https://github.com/express/express
https://github.com/vercel/next.js
```

---

## 🛠️ Development Mode

### **Individual Service Startup** (for development)
```batch
# Start services individually:

# 1. ArangoDB (if not running)
docker run -d -p 8529:8529 -e ARANGO_ROOT_PASSWORD=password --name aisdp_db arangodb:3.11

# 2. MCP Server
cd arangodb-ai-platform-mcp
node http-server.js

# 3. API Gateway  
node services/frontend-api-gateway.js

# 4. Frontend
cd apps/frontend
npm run dev
```

### **Development URLs**
- **Frontend Dev Server**: http://localhost:3000 (Vite HMR enabled)
- **API with Hot Reload**: http://localhost:3001 (nodemon recommended)
- **Database Admin**: http://localhost:8529 (ArangoDB Web Interface)

---

## 📊 Production Deployment Notes

### **Environment Preparation**
- Ensure `DEMO_MODE=false` in all .env files
- Verify no fallback or mock data endpoints
- All services connect to real ArangoDB instance
- CORS configured for production domains

### **Service Health Monitoring**
```bash
# Continuous health monitoring:
while true; do
  echo "=== $(date) ==="
  curl -s http://localhost:3001/health | jq .
  curl -s http://localhost:3002/health | jq .  
  sleep 30
done
```

### **Performance Verification**
- Database response times < 100ms
- API Gateway response times < 50ms  
- Frontend load time < 2 seconds
- WebSocket connections stable

---

## 🆘 Emergency Procedures

### **Complete System Reset**
```batch
# 1. Stop everything
STOP_PLATFORM.bat

# 2. Kill any remaining processes  
taskkill /F /IM node.exe
taskkill /F /IM npm.exe

# 3. Clean Docker (if needed)
docker stop aisdp_db
docker rm aisdp_db

# 4. Fresh start
START_COMPLETE_PLATFORM.bat
```

### **Quick Restart** (services only)
```batch
# Keep database running, restart Node services:
STOP_PLATFORM.bat
START_COMPLETE_PLATFORM.bat
```

---

## ✅ Success Indicators

### **Platform Ready When:**
- ✅ All 4 services respond to health checks
- ✅ Frontend loads without errors  
- ✅ Database shows real collections (not demo data)
- ✅ WebSocket connections established
- ✅ Repository ingestion form accepts GitHub URLs
- ✅ Graph visualization renders properly

**🎉 When all indicators are green, your platform is investor-ready!**
