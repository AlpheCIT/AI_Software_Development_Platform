/**
 * AI Software Development Platform - Main Application
 * 
 * Modern React application providing world-class graph visualization
 * and code intelligence features with real repository ingestion.
 */

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ChakraProvider, Box } from '@chakra-ui/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Main Dashboard - Our new investor-ready interface
import MainDashboard from './pages/MainDashboard';

// Standalone pages
import GraphPage from './pages/GraphPage';

// Run comparison view
import RunComparisonView from './components/analysis/RunComparisonView';

// Theme
import theme from './design-system/theme';

// Components
import { ErrorBoundary } from './components/common/ErrorBoundary';

// Create QueryClient instance with optimized settings
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,
      staleTime: 5 * 60 * 1000, // 5 minutes
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 1,
    },
  },
});

function App() {
  return (
    <ErrorBoundary>
      <ChakraProvider theme={theme}>
        <QueryClientProvider client={queryClient}>
          <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <Routes>
              {/* Main dashboard - All functionality in one place */}
              <Route path="/" element={<MainDashboard />} />
              <Route path="/dashboard" element={<MainDashboard />} />
              <Route path="/ingestion" element={<MainDashboard />} />
              <Route path="/analytics" element={<MainDashboard />} />
              <Route path="/runs" element={<MainDashboard />} />
              <Route path="/learnings" element={<MainDashboard />} />

              {/* Standalone graph page with repositoryId from URL */}
              <Route path="/graph" element={<GraphPage />} />

              {/* Repository-scoped routes */}
              <Route path="/repo/:repoId" element={<MainDashboard />} />
              <Route path="/repo/:repoId/runs" element={<MainDashboard />} />
              <Route path="/repo/:repoId/graph" element={<GraphPage />} />

              {/* Run comparison view */}
              <Route path="/compare/:runId1/:runId2" element={<RunComparisonView />} />

              {/* Catch all - redirect to main dashboard */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Router>
        </QueryClientProvider>
      </ChakraProvider>
    </ErrorBoundary>
  );
}

export default App;