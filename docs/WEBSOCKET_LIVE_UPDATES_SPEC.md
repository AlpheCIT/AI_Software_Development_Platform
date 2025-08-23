# 🔄 WebSocket Live Updates Specification
**Real-time Graph Synchronization**

**Version:** 2.0  
**Updated:** August 21, 2025  
**Priority:** High - Critical for real-time collaboration  
**Estimated Effort:** 1-2 developer weeks

---

## 📋 **OVERVIEW**

This document specifies the WebSocket implementation for real-time graph updates. The frontend is already equipped with Socket.IO client and ready to receive live updates. This will enable real-time collaboration and dynamic graph visualization as code changes occur.

**WebSocket Server:** `ws://localhost:4001/ws/graph`  
**Protocol:** Socket.IO  
**Frontend Integration:** Already implemented via `socket.io-client`

---

## 🎯 **REAL-TIME UPDATE EVENTS**

### **1. Node Updates**
**Event:** `node.updated`  
**Purpose:** Update node properties (security, performance, coverage, etc.)  
**Trigger:** Code analysis completion, security scan results, performance metrics update

```typescript
// WebSocket Event
{
  "event": "node.updated",
  "data": {
    "nodeId": "service:user-api",
    "changes": {
      "security": [
        {
          "id": "sec-001",
          "severity": "HIGH",
          "type": "SQL_INJECTION",
          "description": "New SQL injection vulnerability detected",
          "file": "user.controller.ts",
          "line": 42,
          "detectedAt": "2025-08-21T10:30:00Z"
        }
      ],
      "performance": [
        {
          "name": "Response Time",
          "value": 180,  // Improved from 250ms
          "unit": "ms",
          "threshold": 200,
          "status": "good",  // Changed from warning
          "timestamp": "2025-08-21T10:30:00Z"
        }
      ],
      "coverage": 0.82  // Improved from 0.75
    },
    "metadata": {
      "lastUpdated": "2025-08-21T10:30:00Z",
      "updateType": "performance_improvement",
      "triggeredBy": "automated_analysis"
    }
  },
  "timestamp": "2025-08-21T10:30:00Z"
}
```

**Frontend Handling:**
```typescript
// In GraphPage.tsx or useWebSocket hook
socket.on('node.updated', (data) => {
  // Update the node in the graph visualization
  updateNodeInGraph(data.nodeId, data.changes);
  
  // Update inspector panel if this node is selected
  if (selectedNodeId === data.nodeId) {
    refreshInspectorData(data.nodeId);
  }
  
  // Show notification for significant changes
  if (data.changes.security?.some(s => s.severity === 'CRITICAL')) {
    showNotification({
      type: 'error',
      title: 'Critical Security Issue',
      message: `Critical vulnerability detected in ${data.nodeId}`
    });
  }
});
```

---

### **2. Edge Updates**
**Event:** `edge.added` / `edge.removed` / `edge.updated`  
**Purpose:** Update relationships between nodes  
**Trigger:** Code dependency analysis, new service connections, infrastructure changes

```typescript
// Edge Added Event
{
  "event": "edge.added",
  "data": {
    "edge": {
      "id": "edge-new-001",
      "source": "service:payment-api",
      "target": "service:notification-service",
      "kind": "calls",
      "label": "payment notifications",
      "weight": 0.6,
      "metadata": {
        "connectionCount": 25,
        "lastActivity": "2025-08-21T10:30:00Z"
      }
    },
    "reason": "new_service_dependency"
  },
  "timestamp": "2025-08-21T10:30:00Z"
}

// Edge Removed Event  
{
  "event": "edge.removed",
  "data": {
    "edgeId": "edge-old-001",
    "reason": "service_decommissioned"
  },
  "timestamp": "2025-08-21T10:30:00Z"
}

// Edge Updated Event
{
  "event": "edge.updated", 
  "data": {
    "edgeId": "edge-001",
    "changes": {
      "weight": 0.9,  // Increased connection strength
      "label": "primary data flow",
      "metadata": {
        "connectionCount": 450,  // Increased activity
        "averageLatency": 25
      }
    }
  },
  "timestamp": "2025-08-21T10:30:00Z"
}
```

---

### **3. New Node Discovery**
**Event:** `node.added`  
**Purpose:** Add new nodes to the graph  
**Trigger:** New service deployment, code file creation, infrastructure provisioning

```typescript
{
  "event": "node.added",
  "data": {
    "node": {
      "id": "service:payment-processor",
      "name": "Payment Processor",
      "type": "service",
      "layer": "backend",
      "security": [],
      "performance": [],
      "quality": [],
      "ownership": {
        "team": "Payments Team",
        "owner": "alice.johnson",
        "contact": "alice.johnson@company.com",
        "maintainers": []
      },
      "coverage": 0.0,
      "metadata": {
        "createdAt": "2025-08-21T10:30:00Z",
        "repository": "payments-service",
        "language": "TypeScript",
        "framework": "Express.js"
      }
    },
    "connectedEdges": [
      {
        "id": "edge-payment-001", 
        "source": "service:api-gateway",
        "target": "service:payment-processor",
        "kind": "calls",
        "label": "payment requests"
      }
    ],
    "reason": "new_service_deployment"
  },
  "timestamp": "2025-08-21T10:30:00Z"
}
```

---

### **4. Node Removal**
**Event:** `node.removed`  
**Purpose:** Remove nodes from the graph  
**Trigger:** Service decommissioning, code deletion, infrastructure teardown

```typescript
{
  "event": "node.removed",
  "data": {
    "nodeId": "service:legacy-processor",
    "reason": "service_decommissioned",
    "affectedEdges": [
      "edge-legacy-001",
      "edge-legacy-002"
    ],
    "migrationTarget": "service:new-processor" // Optional
  },
  "timestamp": "2025-08-21T10:30:00Z"
}
```

---

### **5. Analysis Progress Updates**
**Event:** `analysis.progress`  
**Purpose:** Show real-time analysis progress  
**Trigger:** Repository ingestion, security scans, performance analysis

```typescript
{
  "event": "analysis.progress",
  "data": {
    "analysisId": "analysis_1724234567890",
    "repositoryId": "main-repo",
    "type": "security_scan", // security_scan|performance_analysis|code_quality|dependency_analysis
    "progress": {
      "completed": 750,
      "total": 1000,
      "percentage": 75,
      "currentStep": "Analyzing authentication modules",
      "estimatedTimeRemaining": 180 // seconds
    },
    "results": {
      "newIssuesFound": 3,
      "issuesResolved": 1,
      "nodesAnalyzed": 45
    }
  },
  "timestamp": "2025-08-21T10:30:00Z"
}
```

---

### **6. Analysis Completion**
**Event:** `analysis.completed`  
**Purpose:** Notify when analysis is complete with summary  
**Trigger:** End of analysis workflow

```typescript
{
  "event": "analysis.completed",
  "data": {
    "analysisId": "analysis_1724234567890",
    "repositoryId": "main-repo",
    "type": "security_scan",
    "summary": {
      "duration": 420, // seconds
      "nodesAnalyzed": 156,
      "edgesAnalyzed": 243,
      "issuesFound": {
        "CRITICAL": 1,
        "HIGH": 4, 
        "MEDIUM": 12,
        "LOW": 8
      },
      "coverageImprovement": 0.05, // +5%
      "performanceImpact": {
        "improved": 23,
        "degraded": 3,
        "unchanged": 130
      }
    },
    "affectedNodes": [
      "service:user-api",
      "service:auth-service", 
      "database:users"
    ]
  },
  "timestamp": "2025-08-21T10:30:00Z"
}
```

---

### **7. Collaborative Updates**
**Event:** `user.viewing` / `user.selection`  
**Purpose:** Show which nodes other users are viewing/selecting  
**Trigger:** User interactions in the frontend

```typescript
// User Viewing Event
{
  "event": "user.viewing",
  "data": {
    "userId": "john.doe@company.com",
    "userName": "John Doe",
    "nodeId": "service:payment-api",
    "action": "viewing", // viewing|left
    "timestamp": "2025-08-21T10:30:00Z"
  }
}

// User Selection Event
{
  "event": "user.selection",
  "data": {
    "userId": "jane.smith@company.com", 
    "userName": "Jane Smith",
    "nodeId": "service:user-api",
    "action": "selected", // selected|deselected
    "timestamp": "2025-08-21T10:30:00Z"
  }
}
```

---

## 🔧 **FRONTEND WEBSOCKET INTEGRATION**

### **WebSocket Service Implementation**
```typescript
// src/services/websocket.ts (already exists, needs enhancement)
import io, { Socket } from 'socket.io-client';
import { GraphNode, GraphEdge } from '../types/graph';

class GraphWebSocketService {
  private socket: Socket;
  private listeners: Map<string, Function[]> = new Map();

  constructor() {
    this.socket = io('ws://localhost:4001/ws/graph', {
      transports: ['websocket'],
      autoConnect: false
    });
    
    this.setupEventHandlers();
  }

  connect() {
    this.socket.connect();
  }

  disconnect() {
    this.socket.disconnect();
  }

  // Node update handlers
  onNodeUpdated(callback: (nodeId: string, changes: Partial<GraphNode>) => void) {
    this.socket.on('node.updated', (data) => {
      callback(data.nodeId, data.changes);
    });
  }

  onNodeAdded(callback: (node: GraphNode, edges: GraphEdge[]) => void) {
    this.socket.on('node.added', (data) => {
      callback(data.node, data.connectedEdges);
    });
  }

  onNodeRemoved(callback: (nodeId: string, affectedEdges: string[]) => void) {
    this.socket.on('node.removed', (data) => {
      callback(data.nodeId, data.affectedEdges);
    });
  }

  // Edge update handlers
  onEdgeAdded(callback: (edge: GraphEdge) => void) {
    this.socket.on('edge.added', (data) => {
      callback(data.edge);
    });
  }

  onEdgeRemoved(callback: (edgeId: string) => void) {
    this.socket.on('edge.removed', (data) => {
      callback(data.edgeId);
    });
  }

  onEdgeUpdated(callback: (edgeId: string, changes: Partial<GraphEdge>) => void) {
    this.socket.on('edge.updated', (data) => {
      callback(data.edgeId, data.changes);
    });
  }

  // Analysis progress handlers
  onAnalysisProgress(callback: (progress: any) => void) {
    this.socket.on('analysis.progress', callback);
  }

  onAnalysisCompleted(callback: (summary: any) => void) {
    this.socket.on('analysis.completed', callback);
  }

  // Collaborative features
  onUserViewing(callback: (user: any) => void) {
    this.socket.on('user.viewing', callback);
  }

  onUserSelection(callback: (user: any) => void) {
    this.socket.on('user.selection', callback);
  }

  // Send user actions to other clients
  emitUserViewing(nodeId: string) {
    this.socket.emit('user.viewing', { nodeId, action: 'viewing' });
  }

  emitUserSelection(nodeId: string) {
    this.socket.emit('user.selection', { nodeId, action: 'selected' });
  }

  emitUserLeft(nodeId: string) {
    this.socket.emit('user.viewing', { nodeId, action: 'left' });
  }

  private setupEventHandlers() {
    this.socket.on('connect', () => {
      console.log('🔗 Connected to graph WebSocket');
    });

    this.socket.on('disconnect', () => {
      console.log('❌ Disconnected from graph WebSocket');
    });

    this.socket.on('error', (error) => {
      console.error('🚫 WebSocket error:', error);
    });
  }
}

export const graphWebSocket = new GraphWebSocketService();
```

---

### **React Hook for WebSocket**
```typescript
// src/hooks/useGraphWebSocket.ts
import { useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { graphWebSocket } from '../services/websocket';
import { useToast } from '@chakra-ui/react';

export function useGraphWebSocket(
  selectedNodeId?: string,
  onNodeUpdate?: (nodeId: string, changes: any) => void
) {
  const queryClient = useQueryClient();
  const toast = useToast();

  useEffect(() => {
    graphWebSocket.connect();

    // Handle node updates
    graphWebSocket.onNodeUpdated((nodeId, changes) => {
      // Update React Query cache
      queryClient.setQueryData(['node', nodeId], (oldData: any) => ({
        ...oldData,
        ...changes
      }));

      // Update graph visualization
      onNodeUpdate?.(nodeId, changes);

      // Show notification for significant changes
      if (changes.security?.some((s: any) => s.severity === 'CRITICAL')) {
        toast({
          title: 'Critical Security Issue',
          description: `New critical vulnerability in ${nodeId}`,
          status: 'error',
          duration: 5000,
          isClosable: true
        });
      }
    });

    // Handle new nodes
    graphWebSocket.onNodeAdded((node, edges) => {
      // Invalidate graph query to refresh
      queryClient.invalidateQueries(['graph', 'seeds']);
      
      toast({
        title: 'New Service Detected',
        description: `${node.name} has been added to the system`,
        status: 'info',
        duration: 3000,
        isClosable: true
      });
    });

    // Handle node removal
    graphWebSocket.onNodeRemoved((nodeId, affectedEdges) => {
      queryClient.invalidateQueries(['graph', 'seeds']);
      
      toast({
        title: 'Service Removed',
        description: `${nodeId} has been decommissioned`,
        status: 'warning',
        duration: 3000,
        isClosable: true
      });
    });

    // Handle analysis progress
    graphWebSocket.onAnalysisProgress((progress) => {
      // Could show a progress bar in the UI
      console.log('Analysis progress:', progress);
    });

    // Handle analysis completion
    graphWebSocket.onAnalysisCompleted((summary) => {
      queryClient.invalidateQueries(['graph', 'seeds']);
      
      toast({
        title: 'Analysis Complete',
        description: `Found ${summary.issuesFound.CRITICAL + summary.issuesFound.HIGH} critical/high issues`,
        status: summary.issuesFound.CRITICAL > 0 ? 'error' : 'success',
        duration: 4000,
        isClosable: true
      });
    });

    return () => {
      graphWebSocket.disconnect();
    };
  }, [queryClient, toast, onNodeUpdate]);

  // Emit user interactions
  const handleNodeSelect = useCallback((nodeId: string) => {
    graphWebSocket.emitUserSelection(nodeId);
  }, []);

  const handleNodeView = useCallback((nodeId: string) => {
    graphWebSocket.emitUserViewing(nodeId);
  }, []);

  const handleNodeLeave = useCallback((nodeId: string) => {
    graphWebSocket.emitUserLeft(nodeId);
  }, []);

  return {
    handleNodeSelect,
    handleNodeView,
    handleNodeLeave
  };
}
```

---

### **Updated GraphPage Integration**
```typescript
// src/pages/GraphPage.tsx (additions)
import { useGraphWebSocket } from '../hooks/useGraphWebSocket';

export default function GraphPage() {
  const [selectedNode, setSelectedNode] = useState<string | undefined>();
  
  // WebSocket integration
  const { handleNodeSelect, handleNodeView } = useGraphWebSocket(
    selectedNode,
    (nodeId, changes) => {
      // Update the graph visualization in real-time
      updateGraphNode(nodeId, changes);
    }
  );

  const handleNodeSelect = useCallback((nodeId?: string) => {
    setSelectedNode(nodeId);
    setInspectorOpen(!!nodeId);
    
    // Emit to other users
    if (nodeId) {
      handleNodeSelect(nodeId);
    }
  }, [handleNodeSelect]);

  // ... rest of component
}
```

---

## 🚀 **BACKEND WEBSOCKET IMPLEMENTATION**

### **WebSocket Server Setup**
```javascript
// websocket-server.js (new file or enhancement)
const io = require('socket.io')(4001, {
  cors: {
    origin: ["http://localhost:3000", "http://localhost:5173"],
    credentials: true
  }
});

const graphNamespace = io.of('/ws/graph');

graphNamespace.on('connection', (socket) => {
  console.log(`🔗 User connected: ${socket.id}`);
  
  // Join user to repository rooms for targeted updates
  socket.on('join-repository', (repositoryId) => {
    socket.join(`repo:${repositoryId}`);
    console.log(`👤 User ${socket.id} joined repo:${repositoryId}`);
  });

  // Handle user viewing events
  socket.on('user.viewing', (data) => {
    socket.to(`repo:${data.repositoryId || 'default'}`).emit('user.viewing', {
      ...data,
      userId: socket.userId,
      userName: socket.userName
    });
  });

  // Handle user selection events
  socket.on('user.selection', (data) => {
    socket.to(`repo:${data.repositoryId || 'default'}`).emit('user.selection', {
      ...data,
      userId: socket.userId,
      userName: socket.userName
    });
  });

  socket.on('disconnect', () => {
    console.log(`❌ User disconnected: ${socket.id}`);
  });
});

// Event emission functions for backend services
class GraphEventEmitter {
  static emitNodeUpdate(repositoryId, nodeId, changes) {
    graphNamespace.to(`repo:${repositoryId}`).emit('node.updated', {
      nodeId,
      changes,
      timestamp: new Date().toISOString()
    });
  }

  static emitNodeAdded(repositoryId, node, connectedEdges) {
    graphNamespace.to(`repo:${repositoryId}`).emit('node.added', {
      node,
      connectedEdges,
      timestamp: new Date().toISOString()
    });
  }

  static emitNodeRemoved(repositoryId, nodeId, affectedEdges) {
    graphNamespace.to(`repo:${repositoryId}`).emit('node.removed', {
      nodeId,
      affectedEdges,
      timestamp: new Date().toISOString()
    });
  }

  static emitAnalysisProgress(repositoryId, analysisData) {
    graphNamespace.to(`repo:${repositoryId}`).emit('analysis.progress', {
      ...analysisData,
      timestamp: new Date().toISOString()
    });
  }

  static emitAnalysisCompleted(repositoryId, summary) {
    graphNamespace.to(`repo:${repositoryId}`).emit('analysis.completed', {
      ...summary,
      timestamp: new Date().toISOString()
    });
  }
}

module.exports = { GraphEventEmitter };
```

---

### **Integration with Analysis Services**
```javascript
// In your analysis services (security, performance, etc.)
const { GraphEventEmitter } = require('./websocket-server');

class SecurityAnalysisService {
  async analyzeCode(repositoryId, nodeId) {
    // ... existing analysis logic
    
    const newIssues = await this.findSecurityIssues(nodeId);
    
    if (newIssues.length > 0) {
      // Emit real-time update
      GraphEventEmitter.emitNodeUpdate(repositoryId, nodeId, {
        security: newIssues,
        metadata: {
          lastSecurityScan: new Date().toISOString()
        }
      });
    }
  }
}

class PerformanceMonitoringService {
  async updateMetrics(repositoryId, nodeId, metrics) {
    // ... existing metric collection
    
    // Emit real-time performance update
    GraphEventEmitter.emitNodeUpdate(repositoryId, nodeId, {
      performance: metrics,
      metadata: {
        lastPerformanceUpdate: new Date().toISOString()
      }
    });
  }
}
```

---

## 📋 **DEVELOPMENT CHECKLIST**

### **Backend Team Tasks:**
- [ ] Set up WebSocket server with Socket.IO on port 4001
- [ ] Implement room-based broadcasting (per repository)
- [ ] Create GraphEventEmitter utility class
- [ ] Integrate WebSocket events with security analysis service
- [ ] Integrate WebSocket events with performance monitoring
- [ ] Integrate WebSocket events with code quality analysis
- [ ] Add WebSocket events to repository ingestion pipeline
- [ ] Implement user authentication for WebSocket connections
- [ ] Add rate limiting for WebSocket events
- [ ] Set up WebSocket monitoring and logging

### **Frontend Team Tasks:**
- [ ] Enhance existing WebSocket service with all event handlers
- [ ] Create useGraphWebSocket React hook
- [ ] Update GraphPage to handle real-time updates
- [ ] Add visual indicators for real-time changes (animations, notifications)
- [ ] Implement collaborative features (show other users' selections)
- [ ] Add connection status indicator
- [ ] Handle WebSocket reconnection gracefully
- [ ] Add user preferences for notification types
- [ ] Implement optimistic updates with WebSocket confirmation
- [ ] Add keyboard shortcuts for WebSocket features

### **Integration Testing:**
- [ ] Test real-time node updates during security scans
- [ ] Verify performance metric updates are reflected immediately
- [ ] Test collaborative features with multiple browser sessions
- [ ] Verify WebSocket reconnection after network issues
- [ ] Test with high-frequency updates (stress testing)
- [ ] Validate event ordering and consistency
- [ ] Test WebSocket authentication and authorization

---

## 🚀 **IMPLEMENTATION TIMELINE**

**Week 1:**
- Backend: Set up WebSocket server and basic event emission
- Frontend: Enhance WebSocket service and create React hook

**Week 2:**
- Backend: Integrate WebSocket events with analysis services
- Frontend: Update UI components for real-time updates
- Testing: Collaborative features and stress testing

**Week 3:**
- Polish: Animations, notifications, user experience
- Performance: Optimization and monitoring
- Documentation: API documentation and user guides

---

## 🎯 **SUCCESS METRICS**

- **Real-time Updates**: < 100ms latency for WebSocket events
- **Collaboration**: Multiple users can see each other's activity
- **Reliability**: 99.9% WebSocket uptime with auto-reconnection
- **Performance**: No impact on graph rendering with high update frequency
- **User Experience**: Smooth animations and clear notifications

---

**Contact:** Frontend and backend teams for WebSocket coordination  
**Next Steps:** Begin with basic node update events, then expand to full collaboration features