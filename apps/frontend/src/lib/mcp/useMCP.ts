// ArangoDB MCP Integration for Frontend
// This provides a React hook interface to ArangoDB operations via MCP proxy

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../api/client';

export interface MCPCollection {
  name: string;
  type: 'document' | 'edge';
  count: number;
  status: 'empty' | 'populated' | 'populating';
  lastUpdated: string;
}

export interface MCPNode {
  id: string;
  key: string;
  type: string;
  name: string;
  properties: Record<string, any>;
  collection: string;
}

export interface MCPEdge {
  id: string;
  key: string;
  from: string;
  to: string;
  type: string;
  properties: Record<string, any>;
  collection: string;
}

export interface MCPGraphData {
  nodes: MCPNode[];
  edges: MCPEdge[];
  total: number;
}

export interface MCPAnalytics {
  security: {
    totalVulnerabilities: number;
    criticalIssues: number;
    highIssues: number;
    mediumIssues: number;
    lowIssues: number;
  };
  performance: {
    averageComplexity: number;
    totalFunctions: number;
    testCoverage: number;
    codeQualityScore: number;
  };
  repository: {
    totalFiles: number;
    totalLines: number;
    languages: Record<string, number>;
    lastAnalyzed: string;
  };
}

export interface UseMCPReturn {
  // Collections
  collections: MCPCollection[];
  collectionsLoading: boolean;
  collectionsError: string | null;
  refreshCollections: () => Promise<void>;

  // Graph data
  graphData: MCPGraphData | null;
  graphLoading: boolean;
  graphError: string | null;
  loadGraphSeeds: (limit?: number) => Promise<void>;

  // Node operations
  loadNodeDetails: (nodeId: string) => Promise<MCPNode | null>;
  expandNodeNeighborhood: (nodeId: string, depth?: number) => Promise<MCPGraphData | null>;

  // Search
  searchGraph: (query: string, limit?: number) => Promise<MCPNode[]>;

  // Analytics
  analytics: MCPAnalytics | null;
  analyticsLoading: boolean;
  analyticsError: string | null;
  refreshAnalytics: () => Promise<void>;

  // AQL execution
  executeAQL: (query: string, bindVars?: Record<string, any>) => Promise<any>;

  // Collection browsing
  browseCollection: (name: string, limit?: number, offset?: number) => Promise<any>;
}

export const useMCP = (): UseMCPReturn => {
  // Collections state
  const [collections, setCollections] = useState<MCPCollection[]>([]);
  const [collectionsLoading, setCollectionsLoading] = useState(false);
  const [collectionsError, setCollectionsError] = useState<string | null>(null);

  // Graph data state
  const [graphData, setGraphData] = useState<MCPGraphData | null>(null);
  const [graphLoading, setGraphLoading] = useState(false);
  const [graphError, setGraphError] = useState<string | null>(null);

  // Analytics state
  const [analytics, setAnalytics] = useState<MCPAnalytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);

  // Refresh collections from real API
  const refreshCollections = useCallback(async () => {
    setCollectionsLoading(true);
    setCollectionsError(null);

    try {
      const result = await apiClient.mcpBrowseCollections();
      setCollections(result.collections || []);
    } catch (error) {
      const errorMessage = apiClient.handleApiError(error);
      setCollectionsError(errorMessage);
      setCollections([]);
      console.error('Failed to fetch collections:', error);
    } finally {
      setCollectionsLoading(false);
    }
  }, []);

  // Load graph seeds from real API
  const loadGraphSeeds = useCallback(async (limit: number = 20) => {
    setGraphLoading(true);
    setGraphError(null);

    try {
      const result = await apiClient.get('/api/v1/graph/seeds?limit=' + limit);
      if (result.data?.success && result.data?.data) {
        setGraphData(result.data.data);
      } else {
        setGraphData({ nodes: [], edges: [], total: 0 });
      }
    } catch (error) {
      const errorMessage = apiClient.handleApiError(error);
      setGraphError(errorMessage);
      setGraphData({ nodes: [], edges: [], total: 0 });
      console.error('Failed to load graph seeds:', error);
    } finally {
      setGraphLoading(false);
    }
  }, []);

  // Load node details from real API
  const loadNodeDetails = useCallback(async (nodeId: string): Promise<MCPNode | null> => {
    try {
      const result = await apiClient.getNodeDetails(nodeId);
      return result;
    } catch (error) {
      console.error('Failed to load node details:', error);
      return null;
    }
  }, []);

  // Expand node neighborhood from real API
  const expandNodeNeighborhood = useCallback(async (
    nodeId: string,
    depth: number = 1
  ): Promise<MCPGraphData | null> => {
    try {
      const result = await apiClient.expandNodeNeighborhood(nodeId, depth);
      return result;
    } catch (error) {
      console.error('Failed to expand node neighborhood:', error);
      return null;
    }
  }, []);

  // Search graph from real API
  const searchGraph = useCallback(async (
    query: string,
    limit: number = 20
  ): Promise<MCPNode[]> => {
    try {
      const result = await apiClient.searchGraph(query, limit);
      return result.nodes || [];
    } catch (error) {
      console.error('Failed to search graph:', error);
      return [];
    }
  }, []);

  // Refresh analytics from real API
  const refreshAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    setAnalyticsError(null);

    try {
      const result = await apiClient.mcpGetAnalytics('7d');
      setAnalytics(result);
    } catch (error) {
      const errorMessage = apiClient.handleApiError(error);
      setAnalyticsError(errorMessage);
      setAnalytics(null);
      console.error('Failed to fetch analytics:', error);
    } finally {
      setAnalyticsLoading(false);
    }
  }, []);

  // Execute AQL query
  const executeAQL = useCallback(async (
    query: string,
    bindVars?: Record<string, any>
  ): Promise<any> => {
    try {
      const result = await apiClient.mcpExecuteAQL(query, bindVars);
      return result;
    } catch (error) {
      console.error('Failed to execute AQL query:', error);
      throw error;
    }
  }, []);

  // Browse collection
  const browseCollection = useCallback(async (
    name: string,
    limit: number = 10,
    offset: number = 0
  ): Promise<any> => {
    try {
      const result = await apiClient.mcpBrowseCollection(name, limit);
      return result;
    } catch (error) {
      console.error(`Failed to browse collection ${name}:`, error);
      throw error;
    }
  }, []);

  // Load initial data
  useEffect(() => {
    refreshCollections();
    loadGraphSeeds();
    refreshAnalytics();
  }, [refreshCollections, loadGraphSeeds, refreshAnalytics]);

  return {
    // Collections
    collections,
    collectionsLoading,
    collectionsError,
    refreshCollections,

    // Graph data
    graphData,
    graphLoading,
    graphError,
    loadGraphSeeds,

    // Node operations
    loadNodeDetails,
    expandNodeNeighborhood,

    // Search
    searchGraph,

    // Analytics
    analytics,
    analyticsLoading,
    analyticsError,
    refreshAnalytics,

    // AQL execution
    executeAQL,

    // Collection browsing
    browseCollection
  };
};

// Hook for specific collection monitoring
export const useMCPCollection = (collectionName: string) => {
  const [data, setData] = useState<any[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!collectionName) return;

    setLoading(true);
    setError(null);

    try {
      const result = await apiClient.browseCollection(collectionName, 100, 0);
      setData(result.documents || []);
      setCount(result.total || 0);
    } catch (error) {
      const errorMessage = apiClient.handleApiError(error);
      setError(errorMessage);
      console.error(`Failed to load collection ${collectionName}:`, error);
    } finally {
      setLoading(false);
    }
  }, [collectionName]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    data,
    count,
    loading,
    error,
    refresh
  };
};

// Hook for real-time collection monitoring
export const useMCPCollectionMonitor = () => {
  const [collectionCounts, setCollectionCounts] = useState<Record<string, number>>({});
  const [isMonitoring, setIsMonitoring] = useState(false);

  const startMonitoring = useCallback(async () => {
    setIsMonitoring(true);

    // Initial load
    try {
      const collections = await apiClient.mcpBrowseCollections();
      const counts: Record<string, number> = {};

      for (const collection of collections.collections || []) {
        counts[collection.name] = collection.count;
      }

      setCollectionCounts(counts);
    } catch (error) {
      console.error('Failed to load initial collection counts:', error);
    }

    // Set up polling for updates
    const interval = setInterval(async () => {
      try {
        const collections = await apiClient.mcpBrowseCollections();
        const counts: Record<string, number> = {};

        for (const collection of collections.collections || []) {
          counts[collection.name] = collection.count;
        }

        setCollectionCounts(counts);
      } catch (error) {
        console.error('Failed to refresh collection counts:', error);
      }
    }, 5000); // Poll every 5 seconds

    return () => {
      clearInterval(interval);
      setIsMonitoring(false);
    };
  }, []);

  return {
    collectionCounts,
    isMonitoring,
    startMonitoring
  };
};
