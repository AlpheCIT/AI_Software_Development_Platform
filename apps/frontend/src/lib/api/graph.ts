/**
 * Graph API Client
 * Handles all graph-related API calls for the frontend
 */

import { apiClient } from './client';
import type { GraphNode, GraphEdge, GraphData, SavedView } from '../../types/graph';

export interface GraphSeedsParams {
  mode?: 'architecture' | 'service' | 'module' | 'class' | 'ci' | 'infra';
  limit?: number;
  repositoryId?: string;
}

export interface NodeDetailsParams {
  nodeId: string;
}

export interface SearchParams {
  q: string;
  types?: string;
  layers?: string;
  limit?: number;
  offset?: number;
}

export interface NeighborhoodParams {
  nodeId: string;
  depth?: number;
  includeTypes?: string;
  excludeTypes?: string;
  limit?: number;
}

// Graph API endpoints
export const graphApi = {
  // Get initial graph data
  async getSeeds(params: GraphSeedsParams = {}) {
    const queryParams = new URLSearchParams();
    if (params.mode) queryParams.set('mode', params.mode);
    if (params.limit) queryParams.set('limit', params.limit.toString());
    if (params.repositoryId) queryParams.set('repositoryId', params.repositoryId);

    const response = await apiClient.get<{
      nodes: GraphNode[];
      edges: GraphEdge[];
      metadata: any;
    }>(`/graph/seeds?${queryParams}`);
    
    return response.data;
  },

  // Get detailed node information
  async getNodeDetails(nodeId: string) {
    const response = await apiClient.get<GraphNode>(`/graph/node/${encodeURIComponent(nodeId)}`);
    return response.data;
  },

  // Search nodes and edges
  async search(params: SearchParams) {
    const queryParams = new URLSearchParams();
    queryParams.set('q', params.q);
    if (params.types) queryParams.set('types', params.types);
    if (params.layers) queryParams.set('layers', params.layers);
    if (params.limit) queryParams.set('limit', params.limit.toString());
    if (params.offset) queryParams.set('offset', params.offset.toString());

    const response = await apiClient.get<{
      query: string;
      results: Array<{
        id: string;
        name: string;
        type: string;
        layer: string;
        score: number;
        matchedFields: string[];
        snippet: string;
      }>;
      metadata: any;
    }>(`/graph/search?${queryParams}`);
    
    return response.data;
  },

  // Get node neighborhood for expansion
  async getNeighborhood(nodeId: string, params: Omit<NeighborhoodParams, 'nodeId'> = {}) {
    const queryParams = new URLSearchParams();
    if (params.depth) queryParams.set('depth', params.depth.toString());
    if (params.includeTypes) queryParams.set('includeTypes', params.includeTypes);
    if (params.excludeTypes) queryParams.set('excludeTypes', params.excludeTypes);
    if (params.limit) queryParams.set('limit', params.limit.toString());

    const response = await apiClient.get<{
      centerNode: string;
      nodes: GraphNode[];
      edges: GraphEdge[];
      metadata: any;
    }>(`/graph/neighborhood/${encodeURIComponent(nodeId)}?${queryParams}`);
    
    return response.data;
  }
};

// Saved Views API
export const savedViewsApi = {
  // Get all saved views
  async getAll() {
    const response = await apiClient.get<SavedView[]>('/graph/saved-views');
    return response.data;
  },

  // Get saved view by ID
  async getById(id: string) {
    const response = await apiClient.get<SavedView>(`/graph/saved-views/${id}`);
    return response.data;
  },

  // Create new saved view
  async create(view: Omit<SavedView, 'id' | 'createdAt' | 'updatedAt'>) {
    const response = await apiClient.post<SavedView>('/graph/saved-views', view);
    return response.data;
  },

  // Update saved view
  async update(id: string, view: Partial<SavedView>) {
    const response = await apiClient.put<SavedView>(`/graph/saved-views/${id}`, view);
    return response.data;
  },

  // Delete saved view
  async delete(id: string) {
    const response = await apiClient.delete(`/graph/saved-views/${id}`);
    return response.data;
  },

  // Import saved views
  async import(views: SavedView[]) {
    const response = await apiClient.post<{ imported: number; skipped: number }>('/graph/saved-views/import', {
      views
    });
    return response.data;
  },

  // Export saved views
  async export() {
    const response = await apiClient.get<SavedView[]>('/graph/saved-views/export');
    return response.data;
  }
};

// Simulation API
export const simulationApi = {
  // Run what-if simulation
  async run(scenario: any) {
    const response = await apiClient.post<any>('/simulation/run', scenario);
    return response.data;
  }
};

// Analytics API
export const analyticsApi = {
  // Get overview metrics
  async getOverview() {
    const response = await apiClient.get<any>('/analytics/overview');
    return response.data;
  },

  // Get trends data
  async getTrends(timeframe = '30d') {
    const response = await apiClient.get<any>(`/analytics/trends?timeframe=${timeframe}`);
    return response.data;
  }
};

// Export all APIs
export default {
  graph: graphApi,
  savedViews: savedViewsApi,
  simulation: simulationApi,
  analytics: analyticsApi
};
