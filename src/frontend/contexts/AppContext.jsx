/**
 * App Context - Global State Management
 * 
 * Provides centralized state management for:
 * - Repository data and selection
 * - Analysis status and results
 * - User preferences
 * - Error handling
 * - Loading states
 */

import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { apiClient } from '../utils/apiClient';

// Initial state
const initialState = {
  // Repositories
  repositories: [],
  currentRepository: null,
  
  // Analysis
  analysisStatus: null,
  analysisResults: {},
  
  // UI State
  isLoading: false,
  error: null,
  
  // User preferences
  preferences: {
    theme: 'dark',
    autoRefresh: true,
    refreshInterval: 30000,
    defaultView: 'dashboard'
  },
  
  // Metrics and analytics
  metrics: {
    overview: null,
    trends: null,
    lastUpdated: null
  }
};

// Action types
const ActionTypes = {
  SET_LOADING: 'SET_LOADING',
  SET_ERROR: 'SET_ERROR',
  SET_REPOSITORIES: 'SET_REPOSITORIES',
  SET_CURRENT_REPOSITORY: 'SET_CURRENT_REPOSITORY',
  SET_ANALYSIS_STATUS: 'SET_ANALYSIS_STATUS',
  SET_ANALYSIS_RESULTS: 'SET_ANALYSIS_RESULTS',
  SET_METRICS: 'SET_METRICS',
  SET_PREFERENCES: 'SET_PREFERENCES',
  UPDATE_REPOSITORY: 'UPDATE_REPOSITORY',
  ADD_REPOSITORY: 'ADD_REPOSITORY',
  REMOVE_REPOSITORY: 'REMOVE_REPOSITORY'
};

// Reducer
function appReducer(state, action) {
  switch (action.type) {
    case ActionTypes.SET_LOADING:
      return {
        ...state,
        isLoading: action.payload
      };
      
    case ActionTypes.SET_ERROR:
      return {
        ...state,
        error: action.payload,
        isLoading: false
      };
      
    case ActionTypes.SET_REPOSITORIES:
      return {
        ...state,
        repositories: action.payload,
        isLoading: false
      };
      
    case ActionTypes.SET_CURRENT_REPOSITORY:
      return {
        ...state,
        currentRepository: action.payload
      };
      
    case ActionTypes.SET_ANALYSIS_STATUS:
      return {
        ...state,
        analysisStatus: action.payload
      };
      
    case ActionTypes.SET_ANALYSIS_RESULTS:
      return {
        ...state,
        analysisResults: {
          ...state.analysisResults,
          [action.payload.repositoryId]: action.payload.results
        }
      };
      
    case ActionTypes.SET_METRICS:
      return {
        ...state,
        metrics: {
          ...state.metrics,
          ...action.payload,
          lastUpdated: new Date().toISOString()
        }
      };
      
    case ActionTypes.SET_PREFERENCES:
      return {
        ...state,
        preferences: {
          ...state.preferences,
          ...action.payload
        }
      };
      
    case ActionTypes.ADD_REPOSITORY:
      return {
        ...state,
        repositories: [...state.repositories, action.payload]
      };
      
    case ActionTypes.UPDATE_REPOSITORY:
      return {
        ...state,
        repositories: state.repositories.map(repo =>
          repo._id === action.payload._id ? { ...repo, ...action.payload } : repo
        ),
        currentRepository: state.currentRepository?._id === action.payload._id 
          ? { ...state.currentRepository, ...action.payload }
          : state.currentRepository
      };
      
    case ActionTypes.REMOVE_REPOSITORY:
      return {
        ...state,
        repositories: state.repositories.filter(repo => repo._id !== action.payload),
        currentRepository: state.currentRepository?._id === action.payload 
          ? null 
          : state.currentRepository
      };
      
    default:
      return state;
  }
}

// Context
const AppContext = createContext();

// Provider component
export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  // Load initial data
  useEffect(() => {
    loadRepositories();
    loadMetrics();
    loadPreferences();
  }, []);

  // Auto-refresh metrics
  useEffect(() => {
    if (!state.preferences.autoRefresh) return;

    const interval = setInterval(() => {
      loadMetrics();
    }, state.preferences.refreshInterval);

    return () => clearInterval(interval);
  }, [state.preferences.autoRefresh, state.preferences.refreshInterval]);

  // Actions
  const setLoading = (loading) => {
    dispatch({ type: ActionTypes.SET_LOADING, payload: loading });
  };

  const setError = (error) => {
    dispatch({ type: ActionTypes.SET_ERROR, payload: error });
  };

  const loadRepositories = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/repositories');
      dispatch({ 
        type: ActionTypes.SET_REPOSITORIES, 
        payload: response.data.repositories || [] 
      });
    } catch (error) {
      setError(`Failed to load repositories: ${error.message}`);
    }
  };

  const createRepository = async (repositoryData) => {
    try {
      setLoading(true);
      const response = await apiClient.post('/repositories', repositoryData);
      dispatch({ type: ActionTypes.ADD_REPOSITORY, payload: response.data });
      return response.data;
    } catch (error) {
      setError(`Failed to create repository: ${error.message}`);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const selectRepository = async (repository) => {
    try {
      dispatch({ type: ActionTypes.SET_CURRENT_REPOSITORY, payload: repository });
      
      // Load analysis results for this repository
      if (repository) {
        await loadAnalysisResults(repository._id);
      }
    } catch (error) {
      setError(`Failed to select repository: ${error.message}`);
    }
  };

  const analyzeRepository = async (repositoryId, repositoryPath, options = {}) => {
    try {
      setLoading(true);
      
      dispatch({ 
        type: ActionTypes.SET_ANALYSIS_STATUS, 
        payload: { 
          repositoryId, 
          status: 'starting',
          startedAt: new Date().toISOString()
        } 
      });

      const response = await apiClient.post(`/repositories/${repositoryId}/analyze`, {
        repositoryPath,
        options
      });

      dispatch({ 
        type: ActionTypes.SET_ANALYSIS_STATUS, 
        payload: { 
          repositoryId, 
          status: 'analyzing',
          message: response.data.message
        } 
      });

    } catch (error) {
      setError(`Failed to start analysis: ${error.message}`);
      dispatch({ 
        type: ActionTypes.SET_ANALYSIS_STATUS, 
        payload: { 
          repositoryId, 
          status: 'failed',
          error: error.message
        } 
      });
    } finally {
      setLoading(false);
    }
  };

  const loadAnalysisResults = async (repositoryId) => {
    try {
      const [healthScore, dependencies, securityFindings, performance] = await Promise.all([
        apiClient.get(`/repositories/${repositoryId}/health-score`).catch(() => ({ data: null })),
        apiClient.get(`/repositories/${repositoryId}/dependencies`).catch(() => ({ data: { dependencies: [] } })),
        apiClient.get(`/repositories/${repositoryId}/security-findings`).catch(() => ({ data: { security_findings: [] } })),
        apiClient.get(`/repositories/${repositoryId}/performance-insights`).catch(() => ({ data: { performance_insights: [] } }))
      ]);

      dispatch({
        type: ActionTypes.SET_ANALYSIS_RESULTS,
        payload: {
          repositoryId,
          results: {
            healthScore: healthScore.data,
            dependencies: dependencies.data.dependencies,
            securityFindings: securityFindings.data.security_findings,
            performanceInsights: performance.data.performance_insights
          }
        }
      });
    } catch (error) {
      console.error('Failed to load analysis results:', error);
    }
  };

  const loadMetrics = async () => {
    try {
      const [overview, trends] = await Promise.all([
        apiClient.get('/analytics/overview').catch(() => ({ data: { overview: null } })),
        apiClient.get('/analytics/trends').catch(() => ({ data: null }))
      ]);

      dispatch({
        type: ActionTypes.SET_METRICS,
        payload: {
          overview: overview.data.overview,
          trends: trends.data
        }
      });
    } catch (error) {
      console.error('Failed to load metrics:', error);
    }
  };

  const loadPreferences = () => {
    try {
      const saved = localStorage.getItem('appPreferences');
      if (saved) {
        const preferences = JSON.parse(saved);
        dispatch({ type: ActionTypes.SET_PREFERENCES, payload: preferences });
      }
    } catch (error) {
      console.error('Failed to load preferences:', error);
    }
  };

  const updatePreferences = (newPreferences) => {
    try {
      const updated = { ...state.preferences, ...newPreferences };
      localStorage.setItem('appPreferences', JSON.stringify(updated));
      dispatch({ type: ActionTypes.SET_PREFERENCES, payload: newPreferences });
    } catch (error) {
      console.error('Failed to save preferences:', error);
    }
  };

  const searchCode = async (query, options = {}) => {
    try {
      const response = await apiClient.get('/search/code', {
        params: { q: query, ...options }
      });
      return response.data;
    } catch (error) {
      setError(`Search failed: ${error.message}`);
      return { results: [], total: 0 };
    }
  };

  const getDependencyGraph = async (repositoryId, options = {}) => {
    try {
      const response = await apiClient.get(`/repositories/${repositoryId}/dependency-graph`, {
        params: options
      });
      return response.data.dependency_graph;
    } catch (error) {
      setError(`Failed to load dependency graph: ${error.message}`);
      return { nodes: [], edges: [] };
    }
  };

  const getAIInsights = async (repositoryId, options = {}) => {
    try {
      const response = await apiClient.get(`/repositories/${repositoryId}/ai-insights`, {
        params: options
      });
      return response.data.ai_insights;
    } catch (error) {
      setError(`Failed to load AI insights: ${error.message}`);
      return [];
    }
  };

  const getRecommendations = async (repositoryId) => {
    try {
      const response = await apiClient.get(`/repositories/${repositoryId}/recommendations`);
      return response.data.recommendations;
    } catch (error) {
      setError(`Failed to load recommendations: ${error.message}`);
      return [];
    }
  };

  const getQualityTrends = async (repositoryId, timeframe = '30d') => {
    try {
      const response = await apiClient.get(`/repositories/${repositoryId}/quality-trends`, {
        params: { timeframe }
      });
      return response.data.quality_trends;
    } catch (error) {
      setError(`Failed to load quality trends: ${error.message}`);
      return { security: [], performance: [], complexity: [] };
    }
  };

  // WebSocket event handlers
  const handleAnalysisProgress = (data) => {
    dispatch({
      type: ActionTypes.SET_ANALYSIS_STATUS,
      payload: {
        repositoryId: data.repository_id,
        status: 'analyzing',
        progress: data.progress
      }
    });
  };

  const handleAnalysisCompleted = (data) => {
    dispatch({
      type: ActionTypes.SET_ANALYSIS_STATUS,
      payload: {
        repositoryId: data.repository_id,
        status: 'completed',
        completedAt: new Date().toISOString()
      }
    });

    // Reload analysis results
    if (data.repository_id) {
      loadAnalysisResults(data.repository_id);
    }

    // Reload metrics
    loadMetrics();
  };

  const handleAnalysisFailed = (data) => {
    dispatch({
      type: ActionTypes.SET_ANALYSIS_STATUS,
      payload: {
        repositoryId: data.repository_id,
        status: 'failed',
        error: data.error
      }
    });
  };

  // Context value
  const contextValue = {
    // State
    ...state,
    
    // Actions
    setLoading,
    setError,
    loadRepositories,
    createRepository,
    selectRepository,
    analyzeRepository,
    loadAnalysisResults,
    loadMetrics,
    updatePreferences,
    searchCode,
    getDependencyGraph,
    getAIInsights,
    getRecommendations,
    getQualityTrends,
    
    // WebSocket handlers
    handleAnalysisProgress,
    handleAnalysisCompleted,
    handleAnalysisFailed
  };

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
}

// Hook to use the context
export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
}

export { AppContext };
