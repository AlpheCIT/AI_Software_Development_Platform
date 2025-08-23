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
import { apiClient } from '../lib/api/client';

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
  preferences: Preferences;
  metrics: Metrics;
}

interface AppContextType extends AppState {
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  loadRepositories: () => Promise<void>;
  createRepository: (repositoryData: any) => Promise<Repository>;
  selectRepository: (repository: Repository | null) => Promise<void>;
  loadAnalysisResults: (repositoryId: string) => Promise<void>;
  loadMetrics: () => Promise<void>;
  updatePreferences: (preferences: Partial<Preferences>) => void;
  handleAnalysisProgress: (data: any) => void;
  handleAnalysisCompleted: (data: any) => void;
  handleAnalysisFailed: (data: any) => void;
}

// Initial state
const initialState: AppState = {
  repositories: [],
  currentRepository: null,
  analysisStatus: null,
  analysisResults: {},
  isLoading: false,
  error: null,
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
} as const;

type Action = 
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
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
const AppContext = createContext<AppContextType | undefined>(undefined);

// Provider component
interface AppProviderProps {
  children: ReactNode;
}

export function AppProvider({ children }: AppProviderProps) {
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
  const setLoading = (loading: boolean) => {
    dispatch({ type: ActionTypes.SET_LOADING, payload: loading });
  };

  const setError = (error: string | null) => {
    dispatch({ type: ActionTypes.SET_ERROR, payload: error });
  };

  const loadRepositories = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/repositories');
      dispatch({ 
        type: ActionTypes.SET_REPOSITORIES, 
        payload: response.data?.repositories || [] 
      });
    } catch (error: any) {
      setError(`Failed to load repositories: ${error.message}`);
    }
  };

  const createRepository = async (repositoryData: any): Promise<Repository> => {
    try {
      setLoading(true);
      const response = await apiClient.post('/repositories', repositoryData);
      dispatch({ type: ActionTypes.ADD_REPOSITORY, payload: response.data });
      return response.data;
    } catch (error: any) {
      setError(`Failed to create repository: ${error.message}`);
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
    loadRepositories,
    createRepository,
    selectRepository,
    loadAnalysisResults,
    loadMetrics,
    updatePreferences,
    
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
