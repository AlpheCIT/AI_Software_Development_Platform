# AI Software Development Platform

A comprehensive platform for analyzing repositories with 27 specialized analyzers across 7 categories, providing code intelligence, security analysis, and more.

## Getting Started

### Prerequisites

- Node.js (v16+)
- Docker and Docker Compose (for running ArangoDB and backend services)
- Git

### Starting the Platform

Use our PowerShell script to start all components of the platform:

```powershell
.\start-all.ps1
```

This script will:
1. Start ArangoDB in a Docker container
2. Start the API Gateway service on port 3001
3. Start the WebSocket service on port 4001
4. Start the frontend on port 3000

Alternatively, you can start each component individually:

```bash
# Start ArangoDB
docker run -d -p 8529:8529 -e ARANGO_ROOT_PASSWORD=password --name arangodb arangodb:3.10

# Start API Gateway
cd apps/api-gateway
npm install
npm start

# Start WebSocket Service
cd ../../services/websocket-service
npm install
npm start

# Start Frontend
cd ../../apps/frontend
npm install
npm run dev
```

## Repository Analysis

The platform provides comprehensive repository analysis with 27 specialized analyzers across 7 categories:

### Analyzer Categories

1. **🔎 Code Quality (4 analyzers)**
   - Code Smell Analyzer
   - Code Complexity Analyzer
   - Refactor Opportunity Analyzer
   - API Contract Analyzer

2. **🔐 Security (4 analyzers)**
   - Secrets & Compliance Analyzer
   - Supply Chain Risk Analyzer
   - Container/Infra Analyzer
   - SAST Security Analyzer

3. **🧪 Testing (4 analyzers)**
   - Mutation Testing Analyzer
   - Flakiness Analyzer
   - Chaos Engineering Analyzer
   - Regression Analyzer

4. **⚙️ Performance (4 analyzers)**
   - Scalability Analyzer
   - Resource Utilization Analyzer
   - Observability Gap Analyzer
   - Cost Efficiency Analyzer

5. **📚 Documentation (3 analyzers)**
   - Knowledge Drift Analyzer
   - Onboarding Analyzer
   - Traceability Analyzer

6. **🤝 Team (4 analyzers)**
   - Team Metrics Analyzer
   - Delivery Pipeline Analyzer
   - Value Stream Analyzer
   - Knowledge Sharing Analyzer

7. **🧠 AI/Advanced (4 analyzers)**
   - Predictive Defect Analyzer
   - Semantic Code Analyzer
   - AI Code Review Assistant
   - Business Alignment Analyzer

## Using the Platform

### Analyzing a Repository

1. Navigate to the dashboard at http://localhost:3000
2. Click the "Ingestion" tab in the main menu
3. Choose either:
   - Remote repository: Enter a Git repository URL
   - Local repository: Enter the path to a local repository on your system
4. Select which analyzers to run (all are enabled by default)
5. Click "Start Analysis"
6. Monitor the progress in real-time

### Viewing Analysis Results

After analysis is complete, you can:

1. Navigate through the dashboard to see various analysis results
2. Use the Graph view to visualize code relationships
3. View security vulnerabilities in the Security dashboard
4. Explore code quality issues in the Code Quality dashboard
5. And much more!

## Troubleshooting

### Connection Issues

If you see ECONNREFUSED errors in the frontend console, it likely means the backend services aren't running. Check:

1. ArangoDB is running: `docker ps | grep arangodb`
2. API Gateway is running: Check for a running Node.js process on port 3001
3. WebSocket service is running: Check for a running Node.js process on port 4001

### Starting Individual Services

If you need to start services individually:

- ArangoDB: `docker run -d -p 8529:8529 -e ARANGO_ROOT_PASSWORD=password --name arangodb arangodb:3.10`
- API Gateway: `cd apps/api-gateway && npm start`
- WebSocket: `cd services/websocket-service && npm start`
- Frontend: `cd apps/frontend && npm run dev`

## Contributing

Please see CONTRIBUTING.md for details on our code of conduct and the process for submitting pull requests.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
