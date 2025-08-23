/**
 * AI Software Development Platform - Main Application
 * 
 * Modern React application providing world-class graph visualization
 * and code intelligence features.
 */

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ChakraProvider, Box } from '@chakra-ui/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Context providers
import { AppProvider } from './contexts/AppContext';

// Theme
import theme from './design-system/theme';

// Pages
import GraphPage from './pages/GraphPage';
import DashboardPage from './pages/DashboardPage';
import SimulationPage from './pages/SimulationPage';
import RepositoryPage from './pages/RepositoryPage';
import ProjectManagementPage from './pages/ProjectManagementPage';

// Components
import { ErrorBoundary } from './components/common/ErrorBoundary';
import Navigation from './components/common/Navigation';
import BackendShowcase from './components/showcase/BackendShowcase';

// Create QueryClient instance
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,
      staleTime: 5 * 60 * 1000, // 5 minutes
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  return (
    <ErrorBoundary>
      <ChakraProvider theme={theme}>
        <QueryClientProvider client={queryClient}>
          <AppProvider>
            <Router>
              <Navigation>
                <Routes>
                  {/* Default route */}
                  <Route path="/" element={<Navigate to="/repositories" replace />} />
                  
                  {/* Repository management */}
                  <Route path="/repositories" element={<RepositoryPage />} />
                  
                  {/* Main graph visualization */}
                  <Route path="/graph" element={<GraphPage />} />
                  
                  {/* Dashboard overview */}
                  <Route path="/dashboard" element={<DashboardPage />} />
                  
                  {/* What-if simulation */}
                  <Route path="/simulation" element={<SimulationPage />} />
                  
                  {/* Backend showcase - NEW! */}
                  <Route path="/showcase" element={<BackendShowcase />} />
                  
                  {/* Project Management - Jira Kanban Board */}
                  <Route path="/projects/:projectKey" element={<ProjectManagementPage />} />
                  <Route path="/projects" element={<ProjectManagementPage />} />
                  
                  {/* Catch all - redirect to repositories */}
                  <Route path="*" element={<Navigate to="/repositories" replace />} />
                </Routes>
              </Navigation>
            </Router>
          </AppProvider>
        </QueryClientProvider>
      </ChakraProvider>
    </ErrorBoundary>
  );
}

export default App;
