# 🚀 API Integration Specification
**Frontend ↔ Backend Integration Guide**

**Version:** 2.0  
**Updated:** August 21, 2025  
**Priority:** High - Critical for MVP  
**Estimated Effort:** 2-3 developer weeks

---

## 📋 **OVERVIEW**

This document specifies the API contracts needed to connect the world-class graph visualization frontend with the existing backend services. The frontend is fully implemented and waiting for these API endpoints.

**Backend Services to Integrate:**
- **Unified AI Platform**: `http://localhost:8003` (Main orchestration)
- **Vector Search Service**: `http://localhost:8005` (Semantic search)
- **What-If Simulation Engine**: `services/what-if-simulation-engine.js`
- **Repository Ingestion**: `http://localhost:8002` (Code analysis)

---

## 🎯 **CRITICAL API ENDPOINTS NEEDED**

### **1. Graph Data API**
**Endpoint:** `GET /api/graph/seeds`  
**Purpose:** Fetch initial graph data for visualization  
**Frontend Usage:** `GraphPage.tsx` component

```typescript
// Request
GET /api/graph/seeds?mode=architecture&limit=200&repositoryId=optional

// Response
{
  "nodes": [
    {
      "id": "service:user-api",
      "name": "User API",
      "type": "service", // service|module|class|function|api|database|queue|infra|ci_job|secret|test
      "layer": "backend", // frontend|backend|infra|ci_cd|default
      "security": [
        {
          "id": "sec-001",
          "severity": "HIGH", // LOW|MEDIUM|HIGH|CRITICAL
          "type": "SQL_INJECTION",
          "description": "Potential SQL injection vulnerability",
          "file": "user.service.ts",
          "line": 42
        }
      ],
      "performance": [
        {
          "name": "Response Time",
          "value": 250,
          "unit": "ms",
          "threshold": 200,
          "status": "warning" // good|warning|critical
        }
      ],
      "quality": [
        {
          "name": "Code Coverage",
          "value": 75,
          "maxValue": 100,
          "threshold": 80,
          "status": "warning"
        }
      ],
      "ownership": {
        "team": "Platform Team",
        "owner": "John Doe",
        "contact": "john.doe@company.com",
        "maintainers": ["jane.smith@company.com"]
      },
      "coverage": 0.75, // 0.0 to 1.0
      "metadata": {
        "lastUpdated": "2025-08-21T10:30:00Z",
        "codeLines": 1250,
        "dependencies": ["auth-service", "users-db"]
      }
    }
  ],
  "edges": [
    {
      "id": "edge-001",
      "source": "service:user-api",
      "target": "database:users",
      "kind": "depends_on", // imports|calls|depends_on|deploys_to|monitors
      "label": "queries",
      "weight": 0.8,
      "metadata": {
        "connectionCount": 150,
        "lastActivity": "2025-08-21T10:30:00Z"
      }
    }
  ],
  "metadata": {
    "totalNodes": 42,
    "totalEdges": 67,
    "layers": ["backend", "infra", "ci_cd"],
    "timestamp": "2025-08-21T10:30:00Z",
    "repositoryId": "main-repo",
    "analysisVersion": "1.0"
  }
}
```

**Mode Parameter Values:**
- `architecture` - High-level service architecture
- `service` - Service-level dependencies  
- `module` - Module-level code structure
- `class` - Class and function relationships
- `ci` - CI/CD pipeline visualization
- `infra` - Infrastructure components

---

### **2. Node Details API**
**Endpoint:** `GET /api/graph/node/{nodeId}`  
**Purpose:** Fetch detailed information for a specific node  
**Frontend Usage:** `Inspector.tsx` component

```typescript
// Request
GET /api/graph/node/service:user-api

// Response (Enhanced GraphNode with additional details)
{
  "id": "service:user-api",
  "name": "User API",
  "type": "service",
  "layer": "backend",
  
  // Enhanced security details
  "security": [
    {
      "id": "sec-001",
      "severity": "HIGH",
      "type": "SQL_INJECTION", 
      "description": "Potential SQL injection in user query endpoint",
      "file": "src/controllers/user.controller.ts",
      "line": 42,
      "cweId": "CWE-89",
      "fixSuggestion": "Use parameterized queries",
      "detectedAt": "2025-08-21T08:15:00Z"
    }
  ],
  
  // Enhanced performance metrics
  "performance": [
    {
      "name": "Response Time",
      "value": 250,
      "unit": "ms", 
      "threshold": 200,
      "status": "warning",
      "history": [
        {"timestamp": "2025-08-21T09:00:00Z", "value": 245},
        {"timestamp": "2025-08-21T10:00:00Z", "value": 250}
      ],
      "trend": "increasing"
    },
    {
      "name": "Memory Usage",
      "value": 85,
      "unit": "%",
      "threshold": 80,
      "status": "critical"
    }
  ],
  
  // Code quality metrics
  "quality": [
    {
      "name": "Cyclomatic Complexity",
      "value": 8,
      "threshold": 10,
      "status": "good"
    },
    {
      "name": "Technical Debt Ratio",
      "value": 15,
      "unit": "%",
      "threshold": 10,
      "status": "warning"
    }
  ],
  
  // Ownership and contacts
  "ownership": {
    "team": "Platform Team",
    "owner": "John Doe",
    "contact": "john.doe@company.com",
    "maintainers": ["jane.smith@company.com", "bob.wilson@company.com"],
    "slackChannel": "#platform-team",
    "oncallRotation": "platform-oncall"
  },
  
  // Test coverage
  "coverage": 0.75,
  "coverageDetails": {
    "lines": {"covered": 750, "total": 1000},
    "functions": {"covered": 45, "total": 60},
    "branches": {"covered": 80, "total": 120}
  },
  
  // Additional metadata
  "metadata": {
    "lastUpdated": "2025-08-21T10:30:00Z",
    "repository": "backend-services",
    "path": "services/user-api",
    "language": "TypeScript",
    "framework": "Express.js",
    "codeLines": 1250,
    "dependencies": ["auth-service", "users-db", "redis"],
    "dependents": ["frontend-app", "mobile-api"],
    "version": "2.1.4",
    "deploymentStatus": "deployed",
    "lastDeployment": "2025-08-20T14:30:00Z"
  },
  
  // Recent activity/changes
  "recentActivity": [
    {
      "type": "commit",
      "author": "john.doe",
      "message": "Fix user validation bug",
      "timestamp": "2025-08-21T09:15:00Z"
    },
    {
      "type": "deployment",
      "environment": "production",
      "status": "success",
      "timestamp": "2025-08-20T14:30:00Z"
    }
  ]
}
```

---

### **3. Node Neighborhood Expansion API**
**Endpoint:** `GET /api/graph/neighborhood/{nodeId}`  
**Purpose:** Fetch connected nodes for graph expansion  
**Frontend Usage:** `GraphPage.tsx` for node double-click expansion

```typescript
// Request
GET /api/graph/neighborhood/service:user-api?depth=1&includeTypes=service,database

// Response 
{
  "centerNode": "service:user-api",
  "nodes": [
    // Additional nodes connected to the center node
    {
      "id": "service:auth-service",
      "name": "Auth Service",
      "type": "service",
      "layer": "backend",
      // ... (same structure as main graph nodes)
    },
    {
      "id": "database:users-primary",
      "name": "Users Database",
      "type": "database", 
      "layer": "infra"
    }
  ],
  "edges": [
    // New edges connecting the nodes
    {
      "id": "edge-auth-user",
      "source": "service:user-api",
      "target": "service:auth-service", 
      "kind": "calls",
      "label": "authentication"
    }
  ],
  "metadata": {
    "depth": 1,
    "totalNewNodes": 5,
    "totalNewEdges": 8,
    "timestamp": "2025-08-21T10:30:00Z"
  }
}
```

**Query Parameters:**
- `depth`: How many levels deep to expand (default: 1, max: 3)
- `includeTypes`: Comma-separated node types to include
- `excludeTypes`: Comma-separated node types to exclude
- `limit`: Maximum number of nodes to return (default: 50)

---

### **4. What-If Simulation API**
**Endpoint:** `POST /api/simulation/run`  
**Purpose:** Run architectural change impact simulations  
**Frontend Usage:** `WhatIfSimulation.tsx` component

```typescript
// Request
POST /api/simulation/run
{
  "scenarioId": "scenario_1724234567890",
  "repositoryId": "main-repo", 
  "type": "architectural", // architectural|performance|security|refactoring
  "changes": ["add_service", "refactor_monolith"],
  "description": "Add new payment service and refactor user management",
  "metadata": {
    "createdBy": "john.doe@company.com",
    "createdAt": "2025-08-21T10:30:00Z"
  }
}

// Response
{
  "simulationId": "sim_1724234567890",
  "scenarioId": "scenario_1724234567890", 
  "type": "architectural",
  "predictions": {
    "immediate": {
      "performanceChange": -0.05, // -1.0 to 1.0 (negative = degradation)
      "resourceUsage": 1.1, // multiplier
      "stability": 0.95 // 0.0 to 1.0
    },
    "shortTerm": {
      "maintainabilityImprovement": 0.15,
      "developmentVelocity": 1.2, // multiplier  
      "bugReduction": 0.1 // 0.0 to 1.0
    },
    "longTerm": {
      "scalabilityGain": 0.3,
      "technicalDebtReduction": 0.25,
      "teamProductivity": 1.15 // multiplier
    },
    "uncertainty": {
      "dataConfidence": 0.8, // 0.0 to 1.0
      "modelAccuracy": 0.75,
      "externalFactors": 0.6
    }
  },
  "confidenceScores": {
    "overall": 0.75,
    "factors": {
      "dataQuality": 0.8,
      "modelAccuracy": 0.75, 
      "historicalRelevance": 0.7,
      "expertValidation": 0.65,
      "complexity": 0.6
    },
    "breakdown": {
      "immediate": 0.85,
      "shortTerm": 0.75,
      "longTerm": 0.55
    }
  },
  "impactSummary": {
    "overallImpact": "moderate_positive", // negative|slight_negative|neutral|slight_positive|moderate_positive|major_positive
    "keyAreas": ["performance", "maintainability", "scalability"],
    "riskLevel": "low", // low|medium|high|critical
    "recommendationCount": 3,
    "confidenceLevel": 0.75
  },
  "recommendations": [
    {
      "type": "implementation",
      "priority": "high", // low|medium|high
      "content": "Implement changes gradually with comprehensive monitoring",
      "reasoning": "Reduces deployment risk and allows for real-time adjustment"
    },
    {
      "type": "monitoring", 
      "priority": "medium",
      "content": "Set up performance monitoring for new payment service",
      "reasoning": "Validate performance predictions against actual metrics"
    }
  ],
  "metadata": {
    "modelVersion": "1.0",
    "executionTime": 2450, // milliseconds
    "dataQuality": 0.8,
    "assumptions": [
      "Historical patterns will continue",
      "No major external dependencies change",
      "Team capabilities remain constant",
      "Infrastructure capacity is sufficient"
    ]
  },
  "timestamp": "2025-08-21T10:30:00Z"
}
```

---

### **5. Search API**
**Endpoint:** `GET /api/graph/search`  
**Purpose:** Search nodes and edges by name, type, or metadata  
**Frontend Usage:** Search bar in `GraphToolbars.tsx`

```typescript
// Request
GET /api/graph/search?q=user&types=service,database&limit=20

// Response
{
  "query": "user",
  "results": [
    {
      "id": "service:user-api",
      "name": "User API", 
      "type": "service",
      "layer": "backend",
      "score": 0.95, // relevance score 0.0 to 1.0
      "matchedFields": ["name", "description"],
      "snippet": "User API service handling authentication and profile management"
    },
    {
      "id": "database:users",
      "name": "Users Database",
      "type": "database", 
      "layer": "infra",
      "score": 0.87,
      "matchedFields": ["name"],
      "snippet": "Primary user data storage"
    }
  ],
  "metadata": {
    "totalResults": 12,
    "executionTime": 45, // milliseconds
    "suggestions": ["user-service", "user-management", "user-auth"]
  }
}
```

**Query Parameters:**
- `q`: Search query string
- `types`: Comma-separated node types to search
- `layers`: Comma-separated layers to search  
- `limit`: Maximum results (default: 20, max: 100)
- `offset`: Pagination offset

---

## 🔧 **IMPLEMENTATION GUIDANCE**

### **Backend Implementation Priority:**
1. **Graph Data API** - Critical for basic visualization
2. **Node Details API** - Required for inspector panel
3. **Search API** - Important for usability
4. **Neighborhood Expansion** - Nice to have for v1
5. **What-If Simulation** - Strategic feature for v2

### **Data Source Integration:**
```javascript
// Example: Connect to existing services
const graphDataService = {
  async getSeeds(mode, limit, repositoryId) {
    // Pull from ArangoDB collections
    const nodes = await arangoService.query(`
      FOR node IN doc_code_entities
      FILTER node.repository_id == @repositoryId
      LIMIT @limit
      RETURN node
    `, { repositoryId, limit });
    
    // Enhance with security data
    const enhancedNodes = await Promise.all(
      nodes.map(async (node) => ({
        ...node,
        security: await getSecurityIssues(node.id),
        performance: await getPerformanceMetrics(node.id),
        quality: await getQualityMetrics(node.id)
      }))
    );
    
    return { nodes: enhancedNodes, edges: [...], metadata: {...} };
  }
};
```

### **Error Handling:**
```typescript
// Standard error response format
{
  "error": {
    "code": "GRAPH_DATA_NOT_FOUND",
    "message": "No graph data found for repository",
    "details": {
      "repositoryId": "invalid-repo",
      "availableRepositories": ["main-repo", "frontend-app"]
    },
    "timestamp": "2025-08-21T10:30:00Z"
  }
}
```

### **Performance Requirements:**
- **Graph Data API**: < 2 seconds for 500 nodes
- **Node Details API**: < 500ms response time  
- **Search API**: < 200ms response time
- **Simulation API**: < 30 seconds for complex scenarios

### **Authentication:**
```javascript
// Headers required for all API calls
headers: {
  'Authorization': 'Bearer <jwt_token>',
  'Content-Type': 'application/json',
  'X-Request-ID': '<unique_request_id>'
}
```

---

## 📋 **DEVELOPMENT CHECKLIST**

### **Backend Team Tasks:**
- [ ] Implement Graph Data API (`/api/graph/seeds`)
- [ ] Implement Node Details API (`/api/graph/node/{id}`)  
- [ ] Implement Search API (`/api/graph/search`)
- [ ] Implement Neighborhood Expansion API (`/api/graph/neighborhood/{id}`)
- [ ] Integrate What-If Simulation Engine with API endpoint
- [ ] Add proper error handling and validation
- [ ] Set up API documentation (Swagger/OpenAPI)
- [ ] Add request/response logging
- [ ] Implement rate limiting
- [ ] Add API versioning (v1 prefix)

### **Frontend Team Tasks:**
- [ ] Update API service to use real endpoints instead of mocks
- [ ] Add proper error handling for API failures
- [ ] Implement loading states for all API calls
- [ ] Add retry logic for failed requests
- [ ] Update GraphPage to handle real data structure
- [ ] Test with real backend data
- [ ] Add API response caching
- [ ] Implement optimistic updates where appropriate

### **Integration Testing:**
- [ ] Test graph visualization with large datasets (1000+ nodes)
- [ ] Verify overlay functionality with real security/performance data
- [ ] Test node expansion with complex dependency graphs
- [ ] Validate search functionality across different node types
- [ ] Test What-If simulation with realistic scenarios
- [ ] Performance testing with concurrent users
- [ ] End-to-end testing of complete user workflows

---

## 🚀 **NEXT STEPS**

1. **Backend team** implements Graph Data API first
2. **Frontend team** updates GraphPage to consume real API  
3. **Iterative testing** with real data
4. **Performance optimization** based on real usage
5. **Feature completion** with remaining APIs

**Estimated Timeline:** 2-3 weeks for full API integration

---

**Contact:** Frontend architecture team for questions about data structure requirements  
**Documentation:** This spec will be updated as APIs are implemented