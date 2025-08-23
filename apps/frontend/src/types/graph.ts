// Graph data types for the AI Software Development Platform

export type NodeType = 
  | 'service' 
  | 'module' 
  | 'class' 
  | 'function' 
  | 'api' 
  | 'database' 
  | 'queue' 
  | 'infra' 
  | 'ci_job' 
  | 'secret' 
  | 'test';

export type LayerType = 
  | 'frontend' 
  | 'backend' 
  | 'infra' 
  | 'ci_cd' 
  | 'default';

export type GraphMode = 
  | 'architecture' 
  | 'service' 
  | 'module' 
  | 'class' 
  | 'ci' 
  | 'infra';

export type OverlayType = 
  | 'security' 
  | 'performance' 
  | 'coverage' 
  | 'quality';

export type SecuritySeverity = 
  | 'LOW' 
  | 'MEDIUM' 
  | 'HIGH' 
  | 'CRITICAL';

export type PerformanceStatus = 
  | 'good' 
  | 'warning' 
  | 'critical';

export type EdgeKind = 
  | 'imports' 
  | 'calls' 
  | 'depends_on' 
  | 'deploys_to' 
  | 'monitors';

// Security finding interface
export interface SecurityFinding {
  id: string;
  severity: SecuritySeverity;
  type: string;
  description: string;
  file: string;
  line: number;
  cweId?: string;
  fixSuggestion?: string;
  detectedAt: string;
}

// Performance metric interface
export interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  threshold: number;
  status: PerformanceStatus;
  history?: Array<{
    timestamp: string;
    value: number;
  }>;
  trend?: 'increasing' | 'decreasing' | 'stable';
}

// Quality metric interface
export interface QualityMetric {
  name: string;
  value: number;
  maxValue?: number;
  threshold?: number;
  status: PerformanceStatus;
  unit?: string;
}

// Ownership information
export interface Ownership {
  team: string;
  owner: string;
  contact: string;
  maintainers?: string[];
  slackChannel?: string;
  oncallRotation?: string;
}

// Node metadata
export interface NodeMetadata {
  lastUpdated: string;
  repository?: string;
  path?: string;
  language?: string;
  framework?: string;
  codeLines?: number;
  dependencies?: string[];
  dependents?: string[];
  version?: string;
  deploymentStatus?: string;
  lastDeployment?: string;
}

// Graph node interface
export interface GraphNode {
  id: string;
  name: string;
  type: NodeType;
  layer: LayerType;
  security: SecurityFinding[];
  performance: PerformanceMetric[];
  quality: QualityMetric[];
  ownership: Ownership;
  coverage: number; // 0.0 to 1.0
  metadata: NodeMetadata;
  position?: {
    x: number;
    y: number;
  };
  style?: {
    size?: number;
    color?: string;
    opacity?: number;
  };
}

// Graph edge interface
export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  kind: EdgeKind;
  label?: string;
  weight?: number;
  metadata?: {
    connectionCount?: number;
    lastActivity?: string;
    averageLatency?: number;
  };
  style?: {
    color?: string;
    width?: number;
    opacity?: number;
  };
}

// Graph data interface
export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  metadata?: {
    totalNodes: number;
    totalEdges: number;
    layers: LayerType[];
    timestamp: string;
    repositoryId?: string;
    analysisVersion?: string;
  };
}

// Viewport interface
export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

// Saved view interface
export interface SavedView {
  id: string;
  name: string;
  description?: string;
  graphData: GraphData;
  viewport: Viewport;
  mode: GraphMode;
  activeOverlay?: OverlayType | null;
  filters?: {
    nodeTypes?: NodeType[];
    layers?: LayerType[];
    searchQuery?: string;
  };
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  isPublic?: boolean;
  tags?: string[];
}

// Search result interface
export interface SearchResult {
  id: string;
  name: string;
  type: NodeType;
  layer: LayerType;
  score: number;
  matchedFields: string[];
  snippet: string;
}

// Graph snapshot for undo/redo
export interface GraphSnapshot {
  nodes: GraphNode[];
  edges: GraphEdge[];
  viewport: Viewport;
  timestamp: number;
}

// Graph cluster for performance optimization
export interface GraphCluster {
  id: string;
  nodes: string[];
  position: {
    x: number;
    y: number;
  };
  size: number;
  color: string;
}
