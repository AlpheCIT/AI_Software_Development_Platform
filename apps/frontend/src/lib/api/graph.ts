/**
 * Graph API Client
 * Handles all graph-related API calls for the frontend
 */

import { apiRequest } from './client';
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

// Graph API endpoints - using the existing API client methods
export const graphApi = {
  // Get initial graph data
  async getSeeds(params: GraphSeedsParams = {}) {
    try {
      const limit = params.limit || 50;
      const response = await apiRequest.get(`/api/graph/seeds?limit=${limit}`);
      const data = response as any;
      return {
        nodes: data.nodes || [],
        edges: data.edges || [],
        metadata: { total: data.total || 0 }
      };
    } catch (error) {
      console.error('Error fetching graph seeds:', error);
      return { nodes: [], edges: [], metadata: { total: 0 } };
    }
  },

  // Get detailed node information
  async getNodeDetails(nodeId: string) {
    try {
      const response = await apiRequest.get(`/api/graph/nodes/${nodeId}/details`);
      return response;
    } catch (error) {
      console.error('Error fetching node details:', error);
      return null;
    }
  },

  // Search graph nodes and edges
  async search(params: SearchParams) {
    try {
      const response = await apiRequest.get(`/api/graph/search?q=${encodeURIComponent(params.q)}&limit=${params.limit || 20}`);
      return response;
    } catch (error) {
      console.error('Error searching graph:', error);
      return { nodes: [], edges: [] };
    }
  },

  // Get node neighborhood for expansion
  async getNeighborhood(nodeId: string, params: Omit<NeighborhoodParams, 'nodeId'> = {}) {
    try {
      const depth = params.depth || 1;
      const response = await apiRequest.get(`/api/graph/nodes/${nodeId}/expand?depth=${depth}`);
      const data = response as any;
      return {
        centerNode: nodeId,
        nodes: data.nodes || [],
        edges: data.edges || [],
        metadata: data.metadata || {}
      };
    } catch (error) {
      console.error('Error fetching node neighborhood:', error);
      return {
        centerNode: nodeId,
        nodes: [],
        edges: [],
        metadata: {}
      };
    }
  }
};

// Saved Views API - using existing API client methods
export const savedViewsApi = {
  // Get all saved views
  async getAll() {
    try {
      return await apiRequest.get('/api/graph/saved-views');
    } catch (error) {
      console.error('Error fetching saved views:', error);
      return [];
    }
  },

  // Get saved view by ID
  async getById(id: string): Promise<SavedView | null> {
    try {
      const allViews = await apiRequest.get('/api/graph/saved-views');
      return Array.isArray(allViews) ? allViews.find((view: any) => view.id === id) || null : null;
    } catch (error) {
      console.error('Error fetching saved view:', error);
      return null;
    }
  },

  // Create new saved view
  async create(view: Omit<SavedView, 'id' | 'createdAt' | 'updatedAt'>) {
    try {
      return await apiRequest.post('/api/graph/saved-views', view);
    } catch (error) {
      console.error('Error creating saved view:', error);
      throw error;
    }
  },

  // Update saved view
  async update(id: string, view: Partial<SavedView>) {
    try {
      return await apiRequest.put(`/api/graph/saved-views/${id}`, view);
    } catch (error) {
      console.error('Error updating saved view:', error);
      throw error;
    }
  },

  // Delete saved view
  async delete(id: string) {
    try {
      await apiRequest.delete(`/api/graph/saved-views/${id}`);
    } catch (error) {
      console.error('Error deleting saved view:', error);
      throw error;
    }
  }
};

// Simulation API - placeholder for future implementation
export const simulationApi = {
  // Run what-if simulation
  async run(scenario: any) {
    try {
      // This would need to be implemented in the API client when needed
      console.warn('Simulation API not yet implemented');
      return { success: false, message: 'Not implemented' };
    } catch (error) {
      console.error('Error running simulation:', error);
      throw error;
    }
  }
};

// Analytics API - using existing API client methods
export const analyticsApi = {
  // Get overview metrics
  async getOverview() {
    try {
      return await apiRequest.get('/api/analytics/repository');
    } catch (error) {
      console.error('Error fetching analytics overview:', error);
      return null;
    }
  },

  // Get trends data
  async getTrends(timeframe = '30d') {
    try {
      // This would need to be implemented in the API client if needed
      console.warn('Trends API not yet implemented');
      return null;
    } catch (error) {
      console.error('Error fetching trends:', error);
      return null;
    }
  }
};

// Legacy function aliases for backward compatibility with existing components
export const fetchNodeDetails = (nodeId: string) => graphApi.getNodeDetails(nodeId);

// Default React Query options for graph-related queries
export const createGraphQueryOptions = () => ({
  staleTime: 5 * 60 * 1000, // 5 minutes
  cacheTime: 10 * 60 * 1000, // 10 minutes
  retry: 3,
  retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 30000),
  onError: (error: any) => {
    console.error('Graph API error:', error);
  }
});

// Export all APIs
export default {
  graph: graphApi,
  savedViews: savedViewsApi,
  simulation: simulationApi,
  analytics: analyticsApi
};

