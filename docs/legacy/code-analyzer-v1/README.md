# Code Analyzer - Modern Full-Stack Application

A comprehensive code analysis platform built with React, TypeScript, FastAPI, and ArangoDB. This application provides intelligent code search, repository analysis, and team collaboration features.

## 🏗️ Architecture

- **Frontend**: React 18 + TypeScript + Chakra UI + Vite
- **Backend**: FastAPI + Python 3.11
- **Database**: ArangoDB (Graph Database)
- **AI/ML**: Ollama for code embeddings
- **Integration**: Jira & GitHub APIs
- **Deployment**: Docker + Docker Compose

## 🚀 Features

### Code Analysis
- **Semantic Code Search**: Natural language code search using AI embeddings
- **Repository Analysis**: Comprehensive codebase metrics and insights
- **Multi-language Support**: Python, JavaScript, TypeScript, Java, Go, Rust, C++, and more
- **Real-time Analysis**: Background processing with job tracking

### Advanced Search
- **Intelligent Filtering**: Filter by file types, repositories, date ranges, and similarity scores
- **Code Context Viewer**: Monaco Editor integration for full code context
- **Export Capabilities**: Download results and save searches
- **Interactive UI**: Tabbed interface with advanced filters

### Team Collaboration
- **Jira Integration**: Generate stories and tickets from code analysis
- **GitHub Integration**: Repository management and issue tracking
- **System Monitoring**: Real-time system health and performance metrics

## 🌐 Application URLs

### Frontend (React App) - Port 3002
- **Main Application**: `http://localhost:3002`
- **Dashboard**: `http://localhost:3002/` - Overview and system status
- **Repository Analysis**: `http://localhost:3002/analysis` - Analyze code repositories
- **Basic Code Search**: `http://localhost:3002/search` - Simple code search interface
- **Advanced Code Search**: `http://localhost:3002/search/advanced` - Power search with filters
- **Jira Integration**: `http://localhost:3002/jira` - Jira ticket management
- **GitHub Integration**: `http://localhost:3002/github` - GitHub repository management
- **System Status**: `http://localhost:3002/system` - System health and metrics

### Backend API - Port 8000
- **API Documentation**: `http://localhost:8002/docs` - Interactive Swagger UI
- **ReDoc**: `http://localhost:8002/redoc` - Alternative API documentation
- **Health Check**: `http://localhost:8002/api/health` - API health status

#### Core API Endpoints
```
POST /api/repositories/analyze          # Start repository analysis
GET  /api/repositories                  # List all repositories
GET  /api/repositories/{id}/stats       # Get repository statistics
POST /api/code/search                   # Search code with filters
GET  /api/system/status                 # System status and metrics
GET  /api/system/metrics                # Detailed performance metrics
```

#### Integration Endpoints
```
GET  /api/jira/health                   # Jira integration status
POST /api/jira/generate-stories         # Generate Jira stories
GET  /api/github/health                 # GitHub integration status
GET  /api/github/repositories           # List GitHub repositories
```

### Database & Services
- **ArangoDB**: `http://localhost:8529` - Database web interface
- **Ollama**: `http://localhost:11434` - AI model server (if enabled)

## 📋 Usage Guide

### Basic Code Search
1. Navigate to `http://localhost:3002/search`
2. Enter natural language queries like:
   - "function that handles authentication"
   - "database connection setup"
   - "error handling middleware"
3. View results with syntax highlighting and similarity scores
4. Copy code snippets to clipboard

### Advanced Code Search
1. Go to `http://localhost:3002/search/advanced`
2. Use the filter button to set:
   - File types (.py, .js, .ts, etc.)
   - Specific repositories
   - Date ranges
   - Minimum similarity scores
3. Click the eye icon to view code in full context
4. Use Quick Actions tab for saving searches and exporting results

### Repository Analysis
1. Visit `http://localhost:3002/analysis`
2. Enter a GitHub repository URL
3. Monitor analysis progress in real-time
4. View comprehensive metrics and insights

### System Monitoring
1. Check `http://localhost:3002/system` for:
   - System uptime and performance
   - Database connection status
   - Active analysis jobs
   - Memory and CPU usage

## 🛠️ Development Setup

### Prerequisites
- Node.js 18+ and npm
- Python 3.11+
- Docker and Docker Compose
- Git

### Quick Start

1. **Clone the Repository**
   ```bash
   git clone <repository-url>
   cd Streamlit_Code_Analyzer
   ```

2. **Start Services**
   ```bash
   # Start database and AI services
   docker-compose -f docker-compose-modern.yml up -d arangodb ollama

   # Or use the setup script
   ./setup-dev.sh
   ```

3. **Start Backend**
   ```bash
   cd fastapi-backend
   python -m venv venv
   source venv/bin/activate  # Linux/Mac
   pip install -r requirements.txt
   python main.py
   ```

4. **Start Frontend**
   ```bash
   cd react-frontend
   npm install
   npm run dev
   ```

5. **Access Application**
   - Frontend: `http://localhost:3002`
   - Backend API: `http://localhost:8002/docs`

### Environment Configuration

Create `.env` files for configuration:

**Backend (.env)**
```env
ARANGO_HOST=localhost
ARANGO_PORT=8529
ARANGO_USER=root
ARANGO_PASSWORD=openSesame
ARANGO_DATABASE=ARANGO_AISDP_DB
OLLAMA_BASE_URL=http://localhost:11434
```

**Frontend (.env)**
```env
VITE_API_URL=http://localhost:8002
VITE_APP_NAME=Code Analyzer
```

## 🔧 Development Commands

### Frontend
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
npm run lint         # Run ESLint
npm run type-check   # TypeScript type checking
```

### Backend
```bash
python main.py                    # Start development server
uvicorn main:app --reload         # Alternative start command
python -m pytest                  # Run tests
python -c "import main; print('Backend OK')"  # Quick health check
```

### Docker
```bash
docker-compose -f docker-compose-modern.yml up -d    # Start all services
docker-compose -f docker-compose-modern.yml down     # Stop all services
docker-compose logs -f fastapi                       # View backend logs
docker-compose logs -f react-frontend                # View frontend logs
```

## 🔧 Troubleshooting

### Common Issues

1. **Port Conflicts**
   - Frontend default: 3002 (configurable in vite.config.ts)
   - Backend default: 8002 (configurable in main.py)
   - Database: 8529 (ArangoDB)

2. **API Connection Issues**
   - Verify backend is running on port 8002
   - Check CORS settings in main.py
   - Ensure frontend API_BASE_URL is correct

3. **Database Connection**
   - Verify ArangoDB is running: `docker ps | grep arango`
   - Check database credentials in .env
   - Visit `http://localhost:8529` for database UI

4. **Build Issues**
   - Clear node_modules: `rm -rf node_modules package-lock.json && npm install`
   - Clear Python cache: `find . -name "*.pyc" -delete`
   - Restart development servers

### Logs and Debugging

```bash
# View all service logs
docker-compose -f docker-compose-modern.yml logs -f

# View specific service logs
docker-compose logs -f fastapi
docker-compose logs -f react-frontend
docker-compose logs -f arangodb

# Backend logs (when running locally)
tail -f fastapi-backend/logs/app.log

# Check API health
curl http://localhost:8002/api/health
```

## 🔒 Production Deployment

### Docker Production Build
```bash
# Build and start all services
docker-compose -f docker-compose-modern.yml up --build -d

# Production frontend build
cd react-frontend
npm run build
```

### Environment Variables (Production)
- Set strong passwords for ArangoDB
- Configure proper CORS origins
- Enable HTTPS with SSL certificates
- Set up proper logging and monitoring

## 📊 Performance Monitoring

### Key Metrics
- **API Response Times**: Monitor via `/api/system/metrics`
- **Database Performance**: Check ArangoDB web interface
- **Memory Usage**: System status dashboard
- **Search Performance**: Query time tracking in search results

### Health Checks
- Backend: `http://localhost:8002/api/health`
- Database: `http://localhost:8529/_admin/aardvark/`
- Frontend: `http://localhost:3002` (should load without errors)

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

### Code Style
- **Frontend**: ESLint + Prettier for TypeScript/React
- **Backend**: Black + isort for Python
- **Commits**: Conventional commit format

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For issues and questions:
1. Check this README for common solutions
2. Review the GitHub Issues page
3. Check the API documentation at `http://localhost:8002/docs`
4. View application logs for debugging information

---

**Built with ❤️ using modern web technologies for intelligent code analysis and team collaboration.**

The application can be configured through environment variables or by editing `backend/config.py`:

- **Database Settings**: Host, port, credentials for ArangoDB
- **Embedding Settings**: Ollama URL, model selection
- **Analysis Settings**: Batch sizes, excluded directory patterns

## Architecture

The application consists of several components:

- **Database Service**: Handles connection to ArangoDB and performs graph operations
- **Embedding Service**: Generates vector embeddings for code using Ollama
- **Repository Processor**: Clones, parses, and analyzes Git repositories
- **Streamlit Frontend**: Provides a web interface for repository analysis and code search

## Extending the Application

### Adding Support for New Languages

To add support for additional programming languages:

1. Create a new parser class in `backend/repository.py` that inherits from `BaseCodeParser`
2. Implement the `parse()` method to extract nodes and relationships
3. Add the language to the `CodeParserFactory` class

### Using Different Embedding Models

To use a different embedding model:

1. Pull the model in Ollama: `ollama pull new-model-name`
2. Update the `OLLAMA_MODEL` environment variable
3. Restart the application

## Troubleshooting

### ArangoDB Connection Issues

- Verify that ArangoDB is running: `docker ps | grep arango`
- Check logs: `docker-compose logs arangodb`
- Ensure the database name exists: `http://localhost:8529/_db/_system/_admin/aardvark/index.html`

### Embedding Generation Issues

- Verify Ollama is running: `docker ps | grep ollama`
- Check logs: `docker-compose logs ollama`
- Verify model is pulled: `docker-compose exec ollama ollama list`
- For GPU issues, verify GPU access: `docker-compose exec ollama nvidia-smi`

## License

This project is licensed under the MIT License - see the LICENSE file for details.