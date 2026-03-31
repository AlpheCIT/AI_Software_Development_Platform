/**
 * Saved Views API Client
 * Handles all saved views related API calls
 */

import { apiClient } from './client';

export interface SavedView {
  _id: string;
  name: string;
  description?: string;
  query: string;
  filters: Record<string, any>;
  visualization: {
    type: 'graph' | 'table' | 'tree' | 'dashboard';
    config: Record<string, any>;
  };
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  isPublic: boolean;
  tags: string[];
}

export interface CreateSavedViewRequest {
  name: string;
  description?: string;
  query: string;
  filters: Record<string, any>;
  visualization: {
    type: 'graph' | 'table' | 'tree' | 'dashboard';
    config: Record<string, any>;
  };
  isPublic?: boolean;
  tags?: string[];
}

export interface GraphData {
  nodes: Array<{
    id: string;
    label: string;
    type: string;
    properties: Record<string, any>;
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    label?: string;
    properties: Record<string, any>;
  }>;
}

export const savedViewsApi = {
  // Get all saved views
  async getSavedViews(params?: {
    search?: string;
    tags?: string[];
    type?: string;
    isPublic?: boolean;
    limit?: number;
    offset?: number;
  }) {
    const queryParams = new URLSearchParams();
    if (params?.search) queryParams.set('search', params.search);
    if (params?.tags) queryParams.set('tags', params.tags.join(','));
    if (params?.type) queryParams.set('type', params.type);
    if (params?.isPublic !== undefined) queryParams.set('isPublic', params.isPublic.toString());
    if (params?.limit) queryParams.set('limit', params.limit.toString());
    if (params?.offset) queryParams.set('offset', params.offset.toString());
    
    const response = await apiClient.get<{
      views: SavedView[];
      total: number;
    }>(`/saved-views?${queryParams}`);
    
    return response.data;
  },

  // Get single saved view
  async getSavedView(id: string) {
    const response = await apiClient.get<SavedView>(`/saved-views/${id}`);
    return response.data;
  },

  // Create new saved view
  async createSavedView(data: CreateSavedViewRequest) {
    const response = await apiClient.post<SavedView>('/saved-views', data);
    return response.data;
  },

  // Update saved view
  async updateSavedView(id: string, data: Partial<CreateSavedViewRequest>) {
    const response = await apiClient.put<SavedView>(`/saved-views/${id}`, data);
    return response.data;
  },

  // Delete saved view
  async deleteSavedView(id: string) {
    await apiClient.delete(`/saved-views/${id}`);
  },

  // Execute saved view query
  async executeSavedView(id: string, params?: {
    parameters?: Record<string, any>;
    format?: 'json' | 'graph';
  }) {
    const queryParams = new URLSearchParams();
    if (params?.format) queryParams.set('format', params.format);
    
    const payload = params?.parameters ? { parameters: params.parameters } : {};
    
    const response = await apiClient.post<{
      view: SavedView;
      data: any;
      graph?: GraphData;
      executedAt: string;
    }>(`/saved-views/${id}/execute?${queryParams}`, payload);
    
    return response.data;
  },

  // Duplicate saved view
  async duplicateSavedView(id: string, name?: string) {
    const response = await apiClient.post<SavedView>(`/saved-views/${id}/duplicate`, {
      name: name || `Copy of ${id}`
    });
    return response.data;
  },

  // Share saved view
  async shareSavedView(id: string, permissions: {
    userIds?: string[];
    isPublic?: boolean;
    permissions?: 'read' | 'write' | 'admin';
  }) {
    const response = await apiClient.post<{
      message: string;
      sharedWith: string[];
    }>(`/saved-views/${id}/share`, permissions);
    return response.data;
  },

  // Get saved view permissions
  async getSavedViewPermissions(id: string) {
    const response = await apiClient.get<{
      viewId: string;
      owner: string;
      isPublic: boolean;
      permissions: Array<{
        userId: string;
        permission: 'read' | 'write' | 'admin';
      }>;
    }>(`/saved-views/${id}/permissions`);
    return response.data;
  }
};

export default savedViewsApi;

