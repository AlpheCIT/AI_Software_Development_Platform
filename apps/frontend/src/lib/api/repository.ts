/**
 * Repository API Client
 * Handles all repository-related API calls
 */

import { apiClient } from './client';

export interface Repository {
  _id: string;
  name: string;
  url: string;
  description?: string;
  language: string;
  owner?: string;
  defaultBranch?: string;
  lastAnalyzed?: string;
  status: 'active' | 'analyzing' | 'error' | 'pending';
  healthScore?: {
    overall: number;
    security: number;
    performance: number;
    quality: number;
    coverage: number;
  };
  stats?: {
    totalFiles: number;
    totalLines: number;
    totalFunctions: number;
    totalClasses: number;
    dependencies: number;
    issues: number;
  };
  integrations?: {
    jira?: {
      projectKey: string;
      connected: boolean;
      issues?: number;
    };
    github?: {
      connected: boolean;
      prs?: number;
    };
  };
}

export interface CreateRepositoryRequest {
  name: string;
  url: string;
  description?: string;
  language: string;
}

export interface AnalyzeRepositoryRequest {
  repositoryPath: string;
  options?: {
    includeAI?: boolean;
    includeSecurity?: boolean;
    includePerformance?: boolean;
    includeQuality?: boolean;
  };
}

export interface AIInsight {
  id: string;
  type: 'security' | 'performance' | 'quality' | 'architecture' | 'recommendation';
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  createdAt: string;
  file?: string;
  line?: number;
}

export interface Recommendation {
  id: string;
  type: 'performance' | 'security' | 'architecture' | 'best-practice';
  title: string;
  description: string;
  impact: 'low' | 'medium' | 'high';
  effort: 'low' | 'medium' | 'high';
  priority: number;
  actionItems: string[];
}

export const repositoryApi = {
  // Get all repositories
  async getRepositories(params?: {
    search?: string;
    language?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }) {
    const queryParams = new URLSearchParams();
    if (params?.search) queryParams.set('search', params.search);
    if (params?.language) queryParams.set('language', params.language);
    if (params?.status) queryParams.set('status', params.status);
    if (params?.limit) queryParams.set('limit', params.limit.toString());
    if (params?.offset) queryParams.set('offset', params.offset.toString());
    
    const response = await apiClient.get<{
      repositories: Repository[];
      total: number;
    }>(`/repositories?${queryParams}`);
    
    return response.data;
  },

  // Get single repository
  async getRepository(id: string) {
    const response = await apiClient.get<Repository>(`/repositories/${id}`);
    return response.data;
  },

  // Create new repository
  async createRepository(data: CreateRepositoryRequest) {
    const response = await apiClient.post<Repository>('/repositories', data);
    return response.data;
  },

  // Update repository
  async updateRepository(id: string, data: Partial<CreateRepositoryRequest>) {
    const response = await apiClient.put<Repository>(`/repositories/${id}`, data);
    return response.data;
  },

  // Delete repository
  async deleteRepository(id: string) {
    await apiClient.delete(`/repositories/${id}`);
  },

  // Analyze repository
  async analyzeRepository(id: string, data: AnalyzeRepositoryRequest) {
    const response = await apiClient.post<{
      message: string;
      repository_id: string;
      status: string;
    }>(`/repositories/${id}/analyze`, data);
    return response.data;
  },

  // Get repository health score
  async getHealthScore(id: string) {
    const response = await apiClient.get<{
      health_score: {
        overall: number;
        security: number;
        performance: number;
        quality: number;
        coverage: number;
      };
      timestamp: string;
    }>(`/repositories/${id}/health-score`);
    return response.data;
  },

  // Get AI insights
  async getAIInsights(id: string, params?: {
    type?: string;
    severity?: string;
    limit?: number;
  }) {
    const queryParams = new URLSearchParams();
    if (params?.type) queryParams.set('type', params.type);
    if (params?.severity) queryParams.set('severity', params.severity);
    if (params?.limit) queryParams.set('limit', params.limit.toString());
    
    const response = await apiClient.get<{
      repository_id: string;
      ai_insights: AIInsight[];
      total: number;
    }>(`/repositories/${id}/ai-insights?${queryParams}`);
    
    return response.data;
  },

  // Generate AI insights
  async generateAIInsights(id: string, data: {
    type: string;
    content: string;
    confidence?: number;
  }) {
    const response = await apiClient.post<AIInsight>(`/repositories/${id}/ai-insights`, data);
    return response.data;
  },

  // Get recommendations
  async getRecommendations(id: string, params?: {
    type?: string;
    priority?: number;
    limit?: number;
  }) {
    const queryParams = new URLSearchParams();
    if (params?.type) queryParams.set('type', params.type);
    if (params?.priority) queryParams.set('priority', params.priority.toString());
    if (params?.limit) queryParams.set('limit', params.limit.toString());
    
    const response = await apiClient.get<{
      repository_id: string;
      recommendations: Recommendation[];
      total: number;
    }>(`/repositories/${id}/recommendations?${queryParams}`);
    
    return response.data;
  },

  // Get quality trends
  async getQualityTrends(id: string, params?: {
    timeframe?: string;
    metrics?: string[];
  }) {
    const queryParams = new URLSearchParams();
    if (params?.timeframe) queryParams.set('timeframe', params.timeframe);
    if (params?.metrics) queryParams.set('metrics', params.metrics.join(','));
    
    const response = await apiClient.get<{
      repository_id: string;
      quality_trends: {
        [metric: string]: Array<{
          timestamp: string;
          value: number;
        }>;
      };
    }>(`/repositories/${id}/quality-trends?${queryParams}`);
    
    return response.data;
  },

  // Get dependency graph
  async getDependencyGraph(id: string, params?: {
    maxDepth?: number;
    nodeTypes?: string;
  }) {
    const queryParams = new URLSearchParams();
    if (params?.maxDepth) queryParams.set('maxDepth', params.maxDepth.toString());
    if (params?.nodeTypes) queryParams.set('nodeTypes', params.nodeTypes);
    
    const response = await apiClient.get<{
      repository_id: string;
      dependency_graph: {
        nodes: any[];
        edges: any[];
      };
    }>(`/repositories/${id}/dependency-graph?${queryParams}`);
    
    return response.data;
  },

  // Get architecture graph
  async getArchitectureGraph(id: string) {
    const response = await apiClient.get<{
      repository_id: string;
      architecture_graph: {
        nodes: any[];
        edges: any[];
        repository: any;
      };
    }>(`/repositories/${id}/architecture-graph`);
    
    return response.data;
  }
};

export default repositoryApi;

