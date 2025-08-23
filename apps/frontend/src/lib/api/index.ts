/**
 * API Client Index
 * Central export for all API modules
 */

// Re-export the base client
export { apiClient } from './client';

// Import and re-export all API modules
import graphApiClient, { graphApi, savedViewsApi, simulationApi, analyticsApi } from './graph';
import { repositoryApi } from './repository';
import savedViewsApiClient from './savedViews';

// Re-export individual APIs
export { graphApi, savedViewsApi, simulationApi, analyticsApi };
export { repositoryApi };
export { default as savedViewsApiClient } from './savedViews';

// Re-export types
export type { Repository, CreateRepositoryRequest, AIInsight, Recommendation } from './repository';
export type { SavedView, CreateSavedViewRequest } from './savedViews';

// Create a unified API object
export const api = {
  graph: graphApi,
  repository: repositoryApi,
  savedViews: savedViewsApiClient,
  simulation: simulationApi,
  analytics: analyticsApi
};

export default api;
