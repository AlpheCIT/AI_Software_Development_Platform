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

import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { apiClient, ApiError, apiRequest } from '../lib/api/client';
import { useErrorHandler } from '../components/common/ErrorBoundary';

// Types
interface Repository {
  _id: string;
  id: string;
  name: string;
  url: string;
  branch: string;
  status: 'analyzing' | 'completed' | 'failed' | 'pending';
  lastIngestion?: string;
  progress?: number;
  totalFiles?: number;
  processedFiles?: number;
}

interface AnalysisStatus {
  repositoryId: string;
  status: 'analyzing' | 'completed' | 'failed';
  progress?: number;
  completedAt?: string;
  error?: string;
}

interface Preferences {
  theme: 'light' | 'dark';
  autoRefresh: boolean;
  refreshInterval: number;
  defaultView: string;
}

interface Metrics {
  overview: any;
  trends: any;
  lastUpdated: string | null;
}

interface AppState {
  repositories: Repository[];
  currentRepository: Repository | null;
  analysisStatus: AnalysisStatus | null;
  analysisResults: Record<string, any>;
  isLoading: boolean;
  error: string | null;
  lastError: ApiError | null;
  preferences: Preferences;
  metrics: Metrics;
  connectionStatus: 'connected' | 'disconnected' | 'reconnecting';
}

interface AppContextType extends AppState {
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  setConnectionStatus: (status: 'connected' | 'disconnected' | 'reconnecting') => void;
  loadRepositories: () => Promise<void>;
  createRepository: (repositoryData: any) => Promise<Repository>;
  selectRepository: (repository: Repository | null) => Promise<void>;
  loadAnalysisResults: (repositoryId: string) => Promise<void>;
  loadMetrics: () => Promise<void>;
  updatePreferences: (preferences: Partial<Preferences>) => void;
  handleAnalysisProgress: (data: any) => void;
  handleAnalysisCompleted: (data: any) => void;
  handleAnalysisFailed: (data: any) => void;
  retryLastAction: () => Promise<void>;
}

// Initial state
const initialState: AppState = {
  repositories: [],
  currentRepository: null,
  analysisStatus: null,
  analysisResults: {},
  isLoading: false,
  error: null,
  lastError: null,
  preferences: {
    theme: 'dark',
    autoRefresh: true,
    refreshInterval: 30000,
    defaultView: 'dashboard'
  },
  metrics: {
    overview: null,
    trends: null,
    lastUpdated: null
  },
  connectionStatus: 'connected'
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
  REMOVE_REPOSITORY: 'REMOVE_REPOSITORY',
  SET_LAST_ERROR: 'SET_LAST_ERROR',
  SET_CONNECTION_STATUS: 'SET_CONNECTION_STATUS',
  CLEAR_ERROR: 'CLEAR_ERROR'
} as const;

type Action = 
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_LAST_ERROR'; payload: ApiError | null }
  | { type: 'SET_CONNECTION_STATUS'; payload: 'connected' | 'disconnected' | 'reconnecting' }
  | { type: 'CLEAR_ERROR' }
  | { type: 'SET_REPOSITORIES'; payload: Repository[] }
  | { type: 'SET_CURRENT_REPOSITORY'; payload: Repository | null }
  | { type: 'SET_ANALYSIS_STATUS'; payload: AnalysisStatus }
  | { type: 'SET_ANALYSIS_RESULTS'; payload: { repositoryId: string; results: any } }
  | { type: 'SET_METRICS'; payload: Partial<Metrics> }
  | { type: 'SET_PREFERENCES'; payload: Partial<Preferences> }
  | { type: 'ADD_REPOSITORY'; payload: Repository }
  | { type: 'UPDATE_REPOSITORY'; payload: Repository }
  | { type: 'REMOVE_REPOSITORY'; payload: string };

// Reducer
function appReducer(state: AppState, action: Action): AppState {
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

    case 'SET_LAST_ERROR':
      return {
        ...state,
        lastError: action.payload,
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
      
    case 'SET_LAST_ERROR':
      return {
        ...state,
        lastError: action.payload,
        isLoading: false
      };
      
    case 'SET_CONNECTION_STATUS':
      return {
        ...state,
        connectionStatus: action.payload
      };
      
    case 'CLEAR_ERROR':
      return {
        ...state,
        error: null,
        lastError: null
      };
      
    default:
      return state;
  }
}

// Context
const AppContext = createContext<AppContextType | undefined>(undefined);

// Provider component
interface AppProviderProps {
  children: ReactNode;
}

export function AppProvider({ children }: AppProviderProps) {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const { handleApiError } = useErrorHandler();

  // Load initial data
  useEffect(() => {
    loadRepositories();
    loadMetrics();
    loadPreferences();
    setupErrorListeners();
    
    return () => {
      cleanupErrorListeners();
    };
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
  const setLoading = (loading: boolean) => {
    dispatch({ type: ActionTypes.SET_LOADING, payload: loading });
  };

  const setError = (error: string | null) => {
    dispatch({ type: ActionTypes.SET_ERROR, payload: error });
  };

  const clearError = () => {
    dispatch({ type: 'CLEAR_ERROR' });
  };

  const setConnectionStatus = (status: 'connected' | 'disconnected' | 'reconnecting') => {
    dispatch({ type: 'SET_CONNECTION_STATUS', payload: status });
  };

  const setupErrorListeners = () => {
    // Listen for authentication errors
    const handleAuthUnauthorized = () => {
      setError('Authentication expired. Please log in again.');
      setConnectionStatus('disconnected');
      // Could trigger redirect to login here
    };

    const handleAuthForbidden = () => {
      setError('Access denied. You do not have permission for this action.');
    };

    // Listen for global app errors
    const handleAppError = (event: any) => {
      const { error, context } = event.detail;
      if (error.code) {
        dispatch({ type: 'SET_LAST_ERROR', payload: error });
        handleApiError(error, context);
      }
    };

    window.addEventListener('auth:unauthorized', handleAuthUnauthorized);
    window.addEventListener('auth:forbidden', handleAuthForbidden);
    window.addEventListener('app:error', handleAppError);

    // Store cleanup functions
    (window as any).__appErrorCleanup = () => {
      window.removeEventListener('auth:unauthorized', handleAuthUnauthorized);
      window.removeEventListener('auth:forbidden', handleAuthForbidden);
      window.removeEventListener('app:error', handleAppError);
    };
  };

  const cleanupErrorListeners = () => {
    if ((window as any).__appErrorCleanup) {
      (window as any).__appErrorCleanup();
    }
  };

  const retryLastAction = async () => {
    // Implement retry logic based on last error or action
    if (state.lastError && state.lastError.retryable) {
      clearError();
      setConnectionStatus('reconnecting');
      
      try {
        // Retry the last failed action - this is a simplified version
        await loadRepositories();
        setConnectionStatus('connected');
      } catch (error) {
        setConnectionStatus('disconnected');
      }
    }
  };

  const loadRepositories = async () => {
    try {
      setLoading(true);
      dispatch({ type: 'SET_CONNECTION_STATUS', payload: 'connected' });
      
      // Use apiRequest utility for better error handling
      const data = await apiRequest.get('/repositories');
      
      dispatch({ 
        type: ActionTypes.SET_REPOSITORIES, 
        payload: (data as any)?.repositories || [] 
      });
    } catch (error: any) {
      setError(`Failed to load repositories: ${error.message}`);
      dispatch({ type: 'SET_CONNECTION_STATUS', payload: 'disconnected' });
    } finally {
      setLoading(false);
    }
  };

  const createRepository = async (repositoryData: any): Promise<Repository> => {
    try {
      setLoading(true);
      
      // Use apiRequest utility for repository creation
      const data = await apiRequest.post('/repositories', repositoryData);
      
      dispatch({ type: ActionTypes.ADD_REPOSITORY, payload: data as Repository });
      return data as Repository;
    } catch (error: any) {
      if (error.code) {
        // It's an ApiError
        dispatch({ type: 'SET_LAST_ERROR', payload: error });
        setError(`Failed to create repository: ${error.message}`);
      } else {
        setError(`Failed to create repository: ${error.message}`);
      }
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const selectRepository = async (repository: Repository | null) => {
    try {
      dispatch({ type: ActionTypes.SET_CURRENT_REPOSITORY, payload: repository });
      
      // Load analysis results for this repository
      if (repository) {
        await loadAnalysisResults(repository._id);
      }
    } catch (error: any) {
      setError(`Failed to select repository: ${error.message}`);
    }
  };

  const loadAnalysisResults = async (repositoryId: string) => {
    try {
      // Load various analysis results
      const results = {};
      
      // You can add more API calls here as needed
      dispatch({
        type: ActionTypes.SET_ANALYSIS_RESULTS,
        payload: {
          repositoryId,
          results
        }
      });
    } catch (error) {
      console.error('Failed to load analysis results:', error);
    }
  };

  const loadMetrics = async () => {
    try {
      // Load overview and trends
      const metrics = {};
      
      dispatch({
        type: ActionTypes.SET_METRICS,
        payload: metrics
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

  const updatePreferences = (newPreferences: Partial<Preferences>) => {
    try {
      const updated = { ...state.preferences, ...newPreferences };
      localStorage.setItem('appPreferences', JSON.stringify(updated));
      dispatch({ type: ActionTypes.SET_PREFERENCES, payload: newPreferences });
    } catch (error) {
      console.error('Failed to save preferences:', error);
    }
  };

  // WebSocket event handlers
  const handleAnalysisProgress = (data: any) => {
    dispatch({
      type: ActionTypes.SET_ANALYSIS_STATUS,
      payload: {
        repositoryId: data.repository_id,
        status: 'analyzing',
        progress: data.progress
      }
    });
  };

  const handleAnalysisCompleted = (data: any) => {
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

  const handleAnalysisFailed = (data: any) => {
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
  const contextValue: AppContextType = {
    // State
    ...state,
    
    // Actions
    setLoading,
    setError,
    clearError,
    setConnectionStatus,
    loadRepositories,
    createRepository,
    selectRepository,
    loadAnalysisResults,
    loadMetrics,
    updatePreferences,
    retryLastAction,
    
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


