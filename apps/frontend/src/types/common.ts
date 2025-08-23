// Common type definitions for the AI Software Development Platform

export interface BaseEntity {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface SecurityIssue {
  id: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  type: string;
  description: string;
  file: string;
  line: number;
  cweId?: string;
  fixSuggestion?: string;
  detectedAt: string;
}

export interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  threshold: number;
  status: 'good' | 'warning' | 'critical';
  timestamp: string;
  history?: Array<{ timestamp: string; value: number }>;
  trend?: 'increasing' | 'decreasing' | 'stable';
}

export interface QualityMetric {
  name: string;
  value: number;
  maxValue?: number;
  threshold: number;
  status: 'good' | 'warning' | 'critical';
  unit?: string;
}

export interface Ownership {
  team: string;
  owner: string;
  contact: string;
  maintainers: string[];
  slackChannel?: string;
  oncallRotation?: string;
}

export interface Activity {
  type: 'commit' | 'deployment' | 'security_scan' | 'performance_test' | 'code_review';
  author: string;
  message: string;
  timestamp: string;
  environment?: string;
  status?: 'success' | 'failure' | 'pending';
  metadata?: Record<string, any>;
}

export interface CICDPipeline {
  id: string;
  name: string;
  status: 'running' | 'passed' | 'failed' | 'pending';
  lastRun: string;
  duration?: number;
  stages: Array<{
    name: string;
    status: 'running' | 'passed' | 'failed' | 'pending';
    duration?: number;
  }>;
}

export interface CodeFile {
  path: string;
  language: string;
  content?: string;
  lines: number;
  lastModified: string;
  author: string;
}

export interface WebSocketEvent {
  type: string;
  data: any;
  timestamp: string;
}

export interface UserPresence {
  userId: string;
  userName: string;
  nodeId?: string;
  action: 'viewing' | 'editing' | 'left';
  timestamp: string;
}

export interface AIAgent {
  id: string;
  name: string;
  type: 'analyzer' | 'reviewer' | 'optimizer' | 'security';
  status: 'active' | 'idle' | 'processing';
  lastActivity: string;
}

export interface ConversationMessage {
  id: string;
  agentId: string;
  type: 'analysis' | 'recommendation' | 'question' | 'response';
  content: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface JiraTicket {
  id: string;
  key: string;
  summary: string;
  description: string;
  status: string;
  priority: string;
  assignee?: string;
  reporter: string;
  created: string;
  updated: string;
  labels: string[];
}

export interface RepositoryInfo {
  id: string;
  name: string;
  url: string;
  branch: string;
  lastIngestion: string;
  status: 'analyzing' | 'completed' | 'failed' | 'pending';
  progress?: number;
  totalFiles?: number;
  processedFiles?: number;
}

export interface DatabaseSchema {
  tables: Array<{
    name: string;
    columns: Array<{
      name: string;
      type: string;
      nullable: boolean;
    }>;
  }>;
  relationships: Array<{
    from: string;
    to: string;
    type: 'one-to-one' | 'one-to-many' | 'many-to-many';
  }>;
}

export interface SearchQuery {
  query: string;
  type: 'semantic' | 'pattern' | 'natural_language';
  filters?: {
    nodeTypes?: string[];
    layers?: string[];
    severity?: string[];
  };
  options?: {
    fuzzy?: boolean;
    caseSensitive?: boolean;
    wholeWord?: boolean;
  };
}

export interface SearchResult {
  id: string;
  name: string;
  type: string;
  layer: string;
  score: number;
  matchedFields: string[];
  snippet: string;
  metadata?: Record<string, any>;
}

export interface ErrorInfo {
  message: string;
  stack?: string;
  componentStack?: string;
  timestamp: string;
}

export interface LoadingState {
  isLoading: boolean;
  progress?: number;
  message?: string;
}
