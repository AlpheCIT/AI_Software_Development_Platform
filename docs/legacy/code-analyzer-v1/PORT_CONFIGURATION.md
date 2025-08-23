# Port Configuration and Service Endpoints

## Current Service Ports

### ✅ Active Project Services
- **Backend API**: `http://localhost:8002`
  - Main API server running via `python api/app.py`
  - Handles all project management, Jira sync, and duplicate detection
  - Status: ✅ Running (Process ID: 1016335)

- **Frontend (React/Vite)**: `http://localhost:3002`
  - Project management interface with duplicate detection
  - Enhanced Kanban board, team management, analytics
  - Status: ✅ Running (Node Process ID: 837609)

### 🚫 Other Services (Not Part of This Project)
- **Port 3000**: `http://localhost:3000`
  - **NOT USED BY THIS PROJECT**
  - Currently occupied by Docker container running Open WebUI
  - ⚠️ **Do not use this port for the Code Management Analyzer**

- **Port 8080**: `http://localhost:8080`
  - Open WebUI service (unrelated to this project)
  - Status: Running in Docker container

- **Port 8501**: `http://localhost:8501`
  - Streamlit application (unrelated to this project)
  - Status: Running

## Accessing the Application

### 🎯 Correct URLs
- **Main Application**: http://localhost:3002
- **API Documentation**: http://localhost:8002/docs
- **Health Check**: http://localhost:8002/api/health
- **Duplicate Detection**: http://localhost:3002 → "Duplicate Detection" tab

### 🔧 Development Commands
```bash
# Start Backend (if not running)
cd /home/rhelmsjr/Documents/Code/Code_Management_Analyzer
python api/app.py

# Start Frontend (if not running) 
cd /home/rhelmsjr/Documents/Code/Code_Management_Analyzer/frontend
npm run dev

# Check running services
netstat -tlnp | grep -E ":(3002|8002)"
```

## Environment Configuration

### Backend (.env or environment variables)
```bash
# API Configuration
HOST=0.0.0.0
PORT=8002

# Database
ARANGO_URL=http://localhost:8529
ARANGO_DATABASE=ARANGO_AISDP_DB

# Jira Integration
JIRA_URL=https://your-company.atlassian.net
JIRA_USERNAME=your-email@company.com
JIRA_API_TOKEN=your-api-token
JIRA_PROJECT_KEY=SCRUM
```

### Frontend (vite.config.ts)
```typescript
server: {
  port: parseInt(process.env.VITE_PORT || '3002'), // Uses 3002, NOT 3000
  host: true,
  proxy: {
    '/api': {
      target: process.env.VITE_API_URL || 'http://localhost:8002'
    }
  }
}
```

## Important Notes

### ⚠️ Port 3000 Confusion
- **Port 3000 is NOT used by the Code Management Analyzer**
- It's currently used by Open WebUI (Docker container)
- Always use **port 3002** for the frontend interface
- This prevents conflicts with existing services

### 🔄 Task Configuration
The VS Code task "Start Frontend Dev Server" correctly uses port 3002:
```json
{
  "label": "Start Frontend Dev Server",
  "type": "shell", 
  "command": "cd /home/rhelmsjr/Documents/Code/Code_Management_Analyzer/frontend && npm run dev",
  "group": "build",
  "isBackground": true
}
```

### 🧪 Testing Endpoints
```bash
# Test backend health
curl http://localhost:8002/api/health

# Test duplicate detection API
curl http://localhost:8002/api/jira/duplicates

# Test frontend accessibility
curl -I http://localhost:3002
```

## Service Dependencies

### Required for Full Functionality
1. **ArangoDB**: Database for local story storage
2. **Backend API** (port 8002): Core business logic and Jira integration
3. **Frontend** (port 3002): User interface and project management

### Optional Services
- **Open WebUI** (port 3000): Unrelated AI interface
- **Streamlit** (port 8501): Unrelated analytics dashboard

## Troubleshooting

### Common Issues
1. **"Can't connect to frontend"**
   - ✅ Use http://localhost:3002 (NOT 3000)
   - Check if the frontend service is running: `netstat -tlnp | grep :3002`

2. **"API calls failing"**
   - ✅ Backend should be on port 8002
   - Check backend status: `curl http://localhost:8002/api/health`

3. **"Port already in use"**
   - ✅ Port 3000 is occupied by Open WebUI - this is normal
   - ✅ Use port 3002 for the Code Management Analyzer frontend

### Service Status Check
```bash
# Quick status check for all project services
echo "Backend API (port 8002):"
curl -s http://localhost:8002/api/health || echo "❌ Not running"

echo -e "\nFrontend (port 3002):"
curl -sI http://localhost:3002 | head -1 || echo "❌ Not running"

echo -e "\nPort usage:"
netstat -tlnp 2>/dev/null | grep -E ":(3000|3002|8002)" | awk '{print $4 " - " $7}'
```

---

**Remember**: Always use **port 3002** for the Code Management Analyzer frontend, never port 3000!
