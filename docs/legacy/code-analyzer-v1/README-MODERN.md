# Modern Code Analyzer

A powerful, modern code analysis platform built with React, TypeScript, FastAPI, and advanced AI capabilities. This application provides comprehensive repository analysis, intelligent code search, and team collaboration features.

## 🚀 Features

### Core Capabilities
- **Repository Analysis**: Comprehensive analysis of Git repositories with metrics, quality scores, and insights
- **Intelligent Code Search**: Advanced search with context-aware results and semantic understanding
- **Real-time Collaboration**: Team-based code review and analysis sharing
- **AI-Powered Insights**: Integration with Ollama for intelligent code analysis and suggestions
- **Jira Integration**: Automatic story/issue generation from code analysis
- **GitHub Integration**: Seamless repository management and CI/CD integration

### Technology Stack

#### Frontend (React + TypeScript)
- **React 18** with TypeScript for type-safe development
- **Vite** for fast development and optimized builds
- **Chakra UI** for modern, accessible component library
- **Zustand** for lightweight state management
- **React Query/TanStack Query** for efficient data fetching
- **Monaco Editor** for code viewing and editing
- **Recharts/Plotly.js** for advanced data visualizations
- **React Router** for client-side routing

#### Backend (FastAPI + Python)
- **FastAPI** for high-performance API development
- **Pydantic** for data validation and serialization
- **Background Jobs** for async repository analysis
- **WebSocket Support** for real-time updates
- **RESTful APIs** with comprehensive documentation

#### Infrastructure
- **ArangoDB** for graph-based data storage
- **Ollama** for local AI model serving
- **Docker & Docker Compose** for containerization
- **Nginx** for production deployment
- **Git Integration** for repository management

## 📋 Prerequisites

- **Docker** and **Docker Compose**
- **Node.js** 18+ and **npm**
- **Python** 3.8+ and **pip**
- **Git** for repository operations
- **jq** (optional, for testing scripts)

## 🛠️ Quick Start

### 1. Clone and Setup

```bash
git clone <your-repository-url>
cd Streamlit_Code_Analyzer

# Run the setup script
chmod +x setup-dev.sh
./setup-dev.sh
```

### 2. Start Services

```bash
# Start Docker services (ArangoDB, Ollama)
docker-compose -f docker-compose-modern.yml up -d

# Start the backend
cd fastapi-backend
source venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8002 --reload

# In another terminal, start the frontend
cd react-frontend
npm run dev
```

### 3. Access the Application

- **Frontend**: http://localhost:3002
- **Backend API**: http://localhost:8002
- **API Documentation**: http://localhost:8002/docs
- **ArangoDB Web Interface**: http://localhost:8529
- **Ollama API**: http://localhost:11434

## 🧪 Testing

Run the comprehensive test suite:

```bash
# Run all tests
./test-app.sh

# Run specific test categories
./test-app.sh services     # Test service availability
./test-app.sh api         # Test API endpoints
./test-app.sh docker      # Test Docker services
./test-app.sh integration # Test integration workflows
```

## 📁 Project Structure

```
Streamlit_Code_Analyzer/
├── fastapi-backend/           # FastAPI backend application
│   ├── main.py               # Main FastAPI application
│   ├── jobs.py               # Background job management
│   ├── services.py           # Core business logic
│   ├── dependencies.py       # FastAPI dependencies
│   ├── requirements.txt      # Python dependencies
│   ├── Dockerfile           # Backend container
│   └── routers/             # API route modules
│       ├── jira.py          # Jira integration
│       └── github.py        # GitHub integration
├── react-frontend/           # React TypeScript frontend
│   ├── src/
│   │   ├── components/      # Reusable UI components
│   │   ├── pages/          # Application pages
│   │   ├── hooks/          # Custom React hooks
│   │   ├── services/       # API service layer
│   │   ├── stores/         # Zustand state stores
│   │   ├── types/          # TypeScript type definitions
│   │   └── theme.ts        # Chakra UI theme
│   ├── package.json        # Node.js dependencies
│   ├── vite.config.ts      # Vite configuration
│   ├── tsconfig.json       # TypeScript configuration
│   ├── Dockerfile.prod     # Production container
│   └── nginx.conf          # Nginx configuration
├── backend/                 # Legacy Streamlit backend (reference)
├── docker-compose-modern.yml # Modern Docker composition
├── setup-dev.sh            # Development setup script
├── test-app.sh             # Testing script
└── README.md               # This file
```

## 🔧 Development

### Backend Development

```bash
cd fastapi-backend

# Activate virtual environment
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run with auto-reload
uvicorn main:app --reload

# Add new dependencies
pip install new-package
pip freeze > requirements.txt
```

### Frontend Development

```bash
cd react-frontend

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Type checking
npm run type-check

# Linting
npm run lint
```

### Adding New Features

1. **Backend API Endpoints**:
   - Add routes in `fastapi-backend/routers/`
   - Update main.py to include new routers
   - Add corresponding service logic in `services.py`

2. **Frontend Components**:
   - Create components in `src/components/`
   - Add pages in `src/pages/`
   - Update routing in `src/App.tsx`

3. **State Management**:
   - Extend Zustand stores in `src/stores/`
   - Add new hooks in `src/hooks/`

## 🐳 Docker Deployment

### Development Environment

```bash
# Start all services
docker-compose -f docker-compose-modern.yml up -d

# View logs
docker-compose -f docker-compose-modern.yml logs -f

# Stop services
docker-compose -f docker-compose-modern.yml down
```

### Production Deployment

```bash
# Build production images
docker-compose -f docker-compose-modern.yml build

# Deploy with production configuration
docker-compose -f docker-compose-modern.yml up -d --scale fastapi-backend=2
```

## 🔐 Configuration

### Environment Variables

#### Backend (.env or environment)
```bash
# Database
ARANGO_URL=http://arangodb:8529
ARANGO_DATABASE=code_analyzer
ARANGO_USER=root
ARANGO_PASSWORD=openSesame

# AI Services
OLLAMA_URL=http://ollama:11434
OLLAMA_MODEL=codellama:7b

# External Integrations
JIRA_URL=https://your-domain.atlassian.net
JIRA_TOKEN=your-jira-token
GITHUB_TOKEN=your-github-token

# Application
LOG_LEVEL=info
ENABLE_CORS=true
```

#### Frontend (.env)
```bash
VITE_API_BASE_URL=http://localhost:8002
VITE_WS_BASE_URL=ws://localhost:8002
VITE_JIRA_URL=https://your-domain.atlassian.net
VITE_GITHUB_API_URL=https://api.github.com
VITE_ENABLE_REALTIME=true
```

## 📊 Monitoring and Logging

### Health Checks
- Backend: `GET /api/health`
- System Status: `GET /api/system/status`
- Database: Check ArangoDB web interface

### Logging
- Backend logs: Available via uvicorn output
- Frontend logs: Browser console and network tab
- Docker logs: `docker-compose logs [service-name]`

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 API Documentation

The API documentation is automatically generated and available at:
- **Swagger UI**: http://localhost:8002/docs
- **ReDoc**: http://localhost:8002/redoc

### Key Endpoints

#### Repository Analysis
- `POST /api/repositories/analyze` - Start repository analysis
- `GET /api/repositories/jobs/{job_id}` - Get analysis job status
- `GET /api/repositories/jobs` - List all analysis jobs
- `DELETE /api/repositories/jobs/{job_id}` - Cancel analysis job

#### Code Search
- `POST /api/code/search` - Search code with filters
- `GET /api/repositories/{repo_id}/stats` - Get repository statistics

#### System
- `GET /api/health` - Health check
- `GET /api/system/status` - Comprehensive system status

#### Integrations
- `GET /api/jira/health` - Jira integration status
- `POST /api/jira/generate-stories` - Generate Jira stories from analysis
- `GET /api/github/health` - GitHub integration status
- `GET /api/github/repositories` - List GitHub repositories

## 🔍 Troubleshooting

### Common Issues

1. **Docker services not starting**:
   ```bash
   docker-compose -f docker-compose-modern.yml down -v
   docker system prune -f
   docker-compose -f docker-compose-modern.yml up -d
   ```

2. **Backend dependencies issues**:
   ```bash
   cd fastapi-backend
   rm -rf venv
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```

3. **Frontend build failures**:
   ```bash
   cd react-frontend
   rm -rf node_modules package-lock.json
   npm install
   npm run build
   ```

4. **Port conflicts**:
   - Ensure ports 3002, 8002, 8529, 11434 are available
   - Modify ports in docker-compose-modern.yml if needed

### Performance Optimization

1. **Database**: Monitor ArangoDB performance and add indexes
2. **Backend**: Use async/await properly and implement caching
3. **Frontend**: Implement code splitting and lazy loading
4. **Docker**: Use multi-stage builds and optimize image sizes

## 📚 Additional Resources

- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [React Documentation](https://react.dev/)
- [Chakra UI Documentation](https://chakra-ui.com/)
- [ArangoDB Documentation](https://www.arangodb.com/docs/)
- [Ollama Documentation](https://ollama.ai/docs/)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🎯 Roadmap

### Phase 1 (Current)
- ✅ Basic repository analysis
- ✅ Code search functionality
- ✅ Docker containerization
- ✅ API documentation

### Phase 2 (Next)
- [ ] Advanced AI-powered analysis
- [ ] Real-time collaboration features
- [ ] Enhanced Jira/GitHub integrations
- [ ] Performance optimizations

### Phase 3 (Future)
- [ ] Team management and permissions
- [ ] Advanced analytics and reporting
- [ ] Plugin system for extensibility
- [ ] Enterprise features and SSO

---

**Built with ❤️ using modern web technologies**
