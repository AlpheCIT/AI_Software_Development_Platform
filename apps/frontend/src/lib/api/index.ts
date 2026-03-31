// Main API index file - exports all API modules
export { default as apiClient, apiRequest, uploadFile, downloadFile, websocketConfig } from './client';
export type { ApiResponse, ApiError, PaginatedResponse } from './client';

export { default as repositoryApi } from './repositories';
export type { 
  Repository, 
  RepositoryValidation, 
  RepositoryFilters 
} from './repositories';

export { default as analysisApi } from './analysis';
export type { 
  AnalysisSession, 
  AnalysisConfiguration, 
  AnalysisProgress, 
  AnalysisResults, 
  Finding 
} from './analysis';

export { default as executiveApi } from './executive';
export type { 
  ExecutiveKPIs, 
  TrendData, 
  TeamPerformance, 
  ROIMetrics, 
  Report, 
  ReportConfiguration, 
  ReportGeneration,
  DashboardFilter 
} from './executive';

export { 
  default as webSocketClient, 
  WebSocketClient, 
  useWebSocket, 
  websocketUtils 
} from './websocket';
export type { 
  WebSocketEvent, 
  AnalysisProgressEvent, 
  AnalysisCompletedEvent, 
  FindingUpdatedEvent, 
  SystemStatusEvent 
} from './websocket';

// Import the default exports to use in the api object
import repositoryApiDefault from './repositories';
import analysisApiDefault from './analysis';
import executiveApiDefault from './executive';
import webSocketClientDefault from './websocket';

// Export all API functions in a single object for convenience
export const api = {
  repositories: repositoryApiDefault,
  analysis: analysisApiDefault,
  executive: executiveApiDefault,
  websocket: webSocketClientDefault
};

