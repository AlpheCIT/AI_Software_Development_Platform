// API Client for AI Software Development Platform
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
const API_TIMEOUT = 30000; // 30 seconds

export interface ApiResponse<T = any> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
  timestamp: string;
}

export interface IngestionRequest {
  repositoryUrl: string;
  analysisDepth: 'basic' | 'comprehensive' | 'deep';
  realTimeUpdates: boolean;
  populateCollections: boolean;
}

export interface IngestionResponse {
  jobId: string;
  status: 'started' | 'queued';
  estimatedDuration: string;
  message: string;
}

export interface GraphSeedsResponse {
  nodes: Array<{
    id: string;
    type: string;
    name: string;
    properties: Record<string, any>;
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    type: string;
    properties: Record<string, any>;
  }>;
  total: number;
}

export interface CollectionStatusResponse {
  collections: Array<{
    name: string;
    count: number;
    status: 'empty' | 'populated' | 'populating';
    lastUpdated: string;
  }>;
  totalCollections: number;
  populatedCollections: number;
}

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: API_TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor — skip requests entirely when gateway is known to be down
    this.client.interceptors.request.use(
      (config) => {
        // If gateway is known to be unreachable, reject immediately without making the network call
        if ((window as any).__apiGatewayDown) {
          return Promise.reject(new axios.Cancel('API gateway offline — skipping request'));
        }

        // Add authentication token if available
        const token = localStorage.getItem('auth_token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }

        return config;
      },
      (error) => {
        console.error('Request interceptor error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor for error handling and logging
    this.client.interceptors.response.use(
      (response: AxiosResponse) => {
        // Log response in development
        if (import.meta.env.MODE === 'development') {
          console.log(`API Response: ${response.status} ${response.config.url}`, response.data);
        }

        return response;
      },
      (error) => {
        // Handle common error scenarios
        if (error.response) {
          // Server responded with error status
          console.error(`API Error ${error.response.status}:`, error.response.data);
          
          if (error.response.status === 401) {
            // Unauthorized - clear auth and redirect to login
            localStorage.removeItem('auth_token');
            // Could trigger a redirect to login here
          }
        } else if (error.request) {
          // Network error — suppress repeated logs when gateway is unreachable
          if (!(window as any).__apiGatewayDown) {
            console.warn('API gateway unreachable at', error.config?.baseURL || 'unknown', '— running in standalone mode');
            (window as any).__apiGatewayDown = true;
          }
        } else {
          // Other error
          console.error('API Client Error:', error.message);
        }

        return Promise.reject(error);
      }
    );
  }

  // Generic request methods
  async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.client.get(url, config);
  }

  async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.client.post(url, data, config);
  }

  async put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.client.put(url, data, config);
  }

  async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.client.delete(url, config);
  }

  // Repository Ingestion API
  async startRepositoryIngestion(request: IngestionRequest): Promise<IngestionResponse> {
    const response = await this.post<ApiResponse<IngestionResponse>>('/api/v1/ingestion/repository/progressive', request);
    return response.data.data;
  }

  async getIngestionStatus(jobId: string): Promise<any> {
    const response = await this.get<ApiResponse<any>>(`/api/v1/ingestion/jobs/${jobId}`);
    return response.data.data;
  }

  async getIngestionJobs(): Promise<any[]> {
    const response = await this.get<ApiResponse<any[]>>('/api/v1/ingestion/jobs');
    return response.data.data;
  }

  // Graph API
  async getGraphSeeds(limit: number = 50): Promise<GraphSeedsResponse> {
    const response = await this.get<ApiResponse<GraphSeedsResponse>>(`/api/v1/graph/seeds?limit=${limit}`);
    return response.data.data;
  }

  async getNodeDetails(nodeId: string): Promise<any> {
    const response = await this.get<ApiResponse<any>>(`/api/v1/graph/node/${nodeId}`);
    return response.data.data;
  }

  async expandNodeNeighborhood(nodeId: string, depth: number = 1): Promise<any> {
    const response = await this.get<ApiResponse<any>>(`/api/v1/graph/node/${nodeId}/expand?depth=${depth}`);
    return response.data.data;
  }

  async searchGraph(query: string, limit: number = 20): Promise<any> {
    const response = await this.get<ApiResponse<any>>(`/api/v1/graph/search?q=${encodeURIComponent(query)}&limit=${limit}`);
    return response.data.data;
  }

  // Collections API
  async getCollectionStatus(): Promise<CollectionStatusResponse> {
    const response = await this.get<ApiResponse<CollectionStatusResponse>>('/api/v1/collections/status');
    return response.data.data;
  }

  async browseCollection(name: string, limit: number = 10, offset: number = 0): Promise<any> {
    const response = await this.get<ApiResponse<any>>(`/api/v1/collections/${name}?limit=${limit}&offset=${offset}`);
    return response.data.data;
  }

  // Analytics API
  async getRepositoryAnalytics(repositoryId?: string): Promise<any> {
    const url = repositoryId 
      ? `/api/v1/analytics/repository/${repositoryId}`
      : '/api/v1/analytics/overview';
    const response = await this.get<ApiResponse<any>>(url);
    return response.data.data;
  }

  async getSecurityMetrics(repositoryId?: string): Promise<any> {
    const url = repositoryId
      ? `/api/v1/analytics/security/${repositoryId}`
      : '/api/v1/analytics/security';
    const response = await this.get<ApiResponse<any>>(url);
    return response.data.data;
  }

  async getPerformanceMetrics(repositoryId?: string): Promise<any> {
    const url = repositoryId
      ? `/api/v1/analytics/performance/${repositoryId}`
      : '/api/v1/analytics/performance';
    const response = await this.get<ApiResponse<any>>(url);
    return response.data.data;
  }

  // Search API
  async semanticSearch(query: string, collections?: string[], limit: number = 20): Promise<any> {
    const params = new URLSearchParams({
      q: query,
      limit: limit.toString()
    });

    if (collections && collections.length > 0) {
      params.append('collections', collections.join(','));
    }

    const response = await this.get<ApiResponse<any>>(`/api/v1/search/semantic?${params}`);
    return response.data.data;
  }

  async advancedSearch(filters: Record<string, any>, limit: number = 20): Promise<any> {
    const response = await this.post<ApiResponse<any>>('/api/v1/search/advanced', { filters, limit });
    return response.data.data;
  }

  // Health Check
  async healthCheck(): Promise<any> {
    const response = await this.get<ApiResponse<any>>('/health');
    return response.data.data;
  }

  // MCP Proxy API (for ArangoDB operations)
  async mcpBrowseCollections(): Promise<any> {
    const response = await this.get<ApiResponse<any>>('/api/v1/mcp/browse-collections');
    return response.data.data;
  }

  async mcpBrowseCollection(name: string, limit: number = 10): Promise<any> {
    const response = await this.get<ApiResponse<any>>(`/api/v1/mcp/browse-collection/${name}?limit=${limit}`);
    return response.data.data;
  }

  async mcpExecuteAQL(query: string, bindVars?: Record<string, any>): Promise<any> {
    const response = await this.post<ApiResponse<any>>('/api/v1/mcp/execute-aql', { query, bindVars });
    return response.data.data;
  }

  async mcpGetAnalytics(timeRange: string = '7d'): Promise<any> {
    const response = await this.get<ApiResponse<any>>(`/api/v1/mcp/analytics?timeRange=${timeRange}`);
    return response.data.data;
  }

  // Saved Views API
  async getSavedViews(): Promise<any> {
    const response = await this.get<ApiResponse<any>>('/api/v1/views');
    return response.data.data;
  }

  async createSavedView(view: { name: string; description?: string; graphState: any }): Promise<any> {
    const response = await this.post<ApiResponse<any>>('/api/v1/views', view);
    return response.data.data;
  }

  async updateSavedView(id: string, updates: Partial<{ name: string; description?: string; graphState: any }>): Promise<any> {
    const response = await this.put<ApiResponse<any>>(`/api/v1/views/${id}`, updates);
    return response.data.data;
  }

  async deleteSavedView(id: string): Promise<void> {
    await this.delete(`/api/v1/views/${id}`);
  }

  // Utility method to handle API errors consistently
  handleApiError(error: any): string {
    if (error.response?.data?.message) {
      return error.response.data.message;
    } else if (error.response?.data?.error) {
      return error.response.data.error;
    } else if (error.message) {
      return error.message;
    } else {
      return 'An unexpected error occurred';
    }
  }
}

// Create and export singleton instance
export const apiClient = new ApiClient();
export default apiClient;