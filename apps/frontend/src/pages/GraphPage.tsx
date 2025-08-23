/**
 * Graph Page - Main Graph Visualization Interface
 * 
 * This is the primary interface for viewing and interacting with the code graph.
 * Integrates all the components we built: GraphCanvas, InspectorTabs, SavedViews, etc.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  HStack,
  VStack,
  Heading,
  Text,
  Button,
  Select,
  Input,
  IconButton,
  Spinner,
  Alert,
  AlertIcon,
  useToast,
  Drawer,
  DrawerBody,
  DrawerHeader,
  DrawerOverlay,
  DrawerContent,
  DrawerCloseButton,
  useDisclosure
} from '@chakra-ui/react';
import { Search, Settings, Save, FolderOpen } from 'lucide-react';

// Import our world-class components
import GraphCanvas from '../components/graph/GraphCanvas';
import InspectorTabs from '../components/graph/inspector/InspectorTabs';
import SavedViews from '../components/graph/SavedViews';
import GraphToolbar from '../components/graph/GraphToolbar';
import GraphStatusBar from '../components/graph/GraphStatusBar';

// Import API and hooks
import { graphApi } from '../lib/api/graph';
import { useWebSocket } from '../hooks/useWebSocket';

// Import types
import type { GraphNode, GraphEdge, GraphMode, OverlayType } from '../types/graph';

export default function GraphPage() {
  // State management
  const [graphData, setGraphData] = useState<{ nodes: GraphNode[]; edges: GraphEdge[] }>({ nodes: [], edges: [] });
  const [selectedNodeId, setSelectedNodeId] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<GraphMode>('architecture');
  const [activeOverlay, setActiveOverlay] = useState<OverlayType | null>(null);
  
  // UI state
  const { isOpen: isInspectorOpen, onOpen: openInspector, onClose: closeInspector } = useDisclosure();
  const { isOpen: isSavedViewsOpen, onOpen: openSavedViews, onClose: closeSavedViews } = useDisclosure();
  
  const toast = useToast();

  // WebSocket for real-time updates
  const { on, off, subscribeToGraph } = useWebSocket();

  // Load initial graph data
  const loadGraphData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const data = await graphApi.getSeeds({
        mode,
        limit: 200,
        repositoryId: 'current-repo' // You can make this dynamic
      });
      
      setGraphData({
        nodes: data.nodes || [],
        edges: data.edges || []
      });
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load graph data';
      setError(errorMessage);
      
      toast({
        title: 'Graph Load Error',
        description: errorMessage,
        status: 'error',
        duration: 5000,
        isClosable: true
      });
      
    } finally {
      setIsLoading(false);
    }
  }, [mode, toast]);

  // Handle node selection
  const handleNodeSelect = useCallback((nodeId?: string) => {
    setSelectedNodeId(nodeId);
    if (nodeId) {
      openInspector();
    } else {
      closeInspector();
    }
  }, [openInspector, closeInspector]);

  // Handle node double-click (expansion)
  const handleNodeExpand = useCallback(async (nodeId: string) => {
    try {
      const neighborhoodData = await graphApi.getNeighborhood(nodeId, {
        depth: 1,
        limit: 50
      });
      
      // Add new nodes and edges to the graph
      setGraphData(prevData => ({
        nodes: [
          ...prevData.nodes,
          ...neighborhoodData.nodes.filter(newNode => 
            !prevData.nodes.some(existingNode => existingNode.id === newNode.id)
          )
        ],
        edges: [
          ...prevData.edges,
          ...neighborhoodData.edges.filter(newEdge => 
            !prevData.edges.some(existingEdge => existingEdge.id === newEdge.id)
          )
        ]
      }));
      
      toast({
        title: 'Node Expanded',
        description: `Added ${neighborhoodData.nodes.length} connected nodes`,
        status: 'success',
        duration: 3000,
        isClosable: true
      });
      
    } catch (err) {
      toast({
        title: 'Expansion Failed',
        description: err instanceof Error ? err.message : 'Failed to expand node',
        status: 'error',
        duration: 5000,
        isClosable: true
      });
    }
  }, [toast]);

  // Handle search
  const handleSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      await loadGraphData();
      return;
    }
    
    try {
      const searchResults = await graphApi.search({
        q: query,
        limit: 100
      });
      
      // Filter current graph to show only matching nodes
      const matchingNodeIds = new Set(searchResults.results.map(r => r.id));
      
      setGraphData(prevData => ({
        nodes: prevData.nodes.filter(node => matchingNodeIds.has(node.id)),
        edges: prevData.edges.filter(edge => 
          matchingNodeIds.has(edge.source) && matchingNodeIds.has(edge.target)
        )
      }));
      
    } catch (err) {
      toast({
        title: 'Search Failed',
        description: err instanceof Error ? err.message : 'Search failed',
        status: 'error',
        duration: 5000,
        isClosable: true
      });
    }
  }, [loadGraphData, toast]);

  // Load data on mount and mode change
  useEffect(() => {
    loadGraphData();
  }, [loadGraphData]);

  // Subscribe to WebSocket updates
  useEffect(() => {
    subscribeToGraph('current-repo');
    
    // Handle real-time node updates
    const handleNodeUpdate = (data: any) => {
      setGraphData(prevData => ({
        ...prevData,
        nodes: prevData.nodes.map(node => 
          node.id === data.nodeId ? { ...node, ...data.changes } : node
        )
      }));
      
      // Refresh inspector if the updated node is selected
      if (selectedNodeId === data.nodeId) {
        // InspectorTabs will automatically refetch data
        toast({
          title: 'Node Updated',
          description: 'Node data has been updated in real-time',
          status: 'info',
          duration: 3000,
          isClosable: true
        });
      }
    };

    const handleAnalysisComplete = (data: any) => {
      toast({
        title: 'Analysis Complete',
        description: 'Repository analysis finished. Refreshing graph...',
        status: 'success',
        duration: 4000,
        isClosable: true
      });
      
      // Reload the entire graph
      loadGraphData();
    };

    // Subscribe to WebSocket events
    on('node.updated', handleNodeUpdate);
    on('analysis.completed', handleAnalysisComplete);

    // Cleanup
    return () => {
      off('node.updated', handleNodeUpdate);
      off('analysis.completed', handleAnalysisComplete);
    };
  }, [on, off, subscribeToGraph, selectedNodeId, toast, loadGraphData]);

  // Render loading state
  if (isLoading) {
    return (
      <Box 
        height="100vh" 
        display="flex" 
        alignItems="center" 
        justifyContent="center"
        flexDirection="column"
        gap={4}
      >
        <Spinner size="xl" color="blue.500" />
        <Text>Loading graph data...</Text>
      </Box>
    );
  }

  // Render error state
  if (error) {
    return (
      <Box p={6}>
        <Alert status="error">
          <AlertIcon />
          <Box>
            <Text fontWeight="bold">Failed to load graph</Text>
            <Text>{error}</Text>
          </Box>
        </Alert>
        <Button mt={4} onClick={loadGraphData}>
          Retry
        </Button>
      </Box>
    );
  }

  return (
    <Box display="flex" flexDirection="column" minHeight="calc(100vh - 120px)">
      {/* Header */}
      <Box p={4} borderBottom="1px" borderColor="gray.200">
        <HStack justify="space-between" align="center">
          <VStack align="start" spacing={1}>
            <Heading size="lg">Code Graph Visualization</Heading>
            <Text color="gray.600">
              {graphData.nodes.length} nodes, {graphData.edges.length} edges
            </Text>
          </VStack>
          
          <HStack spacing={3}>
            {/* Graph Mode Selector */}
            <Select 
              value={mode} 
              onChange={(e) => setMode(e.target.value as GraphMode)}
              width="200px"
            >
              <option value="architecture">Architecture</option>
              <option value="service">Service</option>
              <option value="module">Module</option>
              <option value="class">Class</option>
              <option value="ci">CI/CD</option>
              <option value="infra">Infrastructure</option>
            </Select>

            {/* Overlay Selector */}
            <Select 
              value={activeOverlay || ''} 
              onChange={(e) => setActiveOverlay(e.target.value as OverlayType || null)}
              width="180px"
              placeholder="No overlay"
            >
              <option value="security">Security Issues</option>
              <option value="performance">Performance</option>
              <option value="coverage">Test Coverage</option>
              <option value="quality">Code Quality</option>
            </Select>

            {/* Action Buttons */}
            <IconButton
              aria-label="Open saved views"
              icon={<FolderOpen size={20} />}
              onClick={openSavedViews}
              variant="outline"
            />
            
            <IconButton
              aria-label="Graph settings"
              icon={<Settings size={20} />}
              variant="outline"
            />
          </HStack>
        </HStack>

        {/* Search and Toolbar */}
        <GraphToolbar 
          onSearch={handleSearch}
          mode={mode}
          onModeChange={setMode}
          activeOverlay={activeOverlay}
          onOverlayChange={setActiveOverlay}
        />
      </Box>

      {/* Main Content */}
      <Box flex={1} position="relative" overflow="hidden">
        <HStack height="100%" spacing={0}>
          {/* Graph Canvas */}
          <Box flex={1} position="relative">
            <GraphCanvas
              data={graphData}
              mode={mode}
              overlay={activeOverlay}
              selectedNodeId={selectedNodeId}
              onNodeSelect={handleNodeSelect}
              onNodeDoubleClick={handleNodeExpand}
            />
            
            {/* Status Bar */}
            <GraphStatusBar 
              nodeCount={graphData.nodes.length}
              edgeCount={graphData.edges.length}
              selectedNodeId={selectedNodeId}
              mode={mode}
            />
          </Box>

          {/* Inspector Panel */}
          <Drawer
            isOpen={isInspectorOpen}
            placement="right"
            onClose={closeInspector}
            size="lg"
          >
            <DrawerOverlay />
            <DrawerContent>
              <DrawerCloseButton />
              <DrawerHeader>
                Node Inspector
              </DrawerHeader>
              <DrawerBody>
                {selectedNodeId && (
                  <InspectorTabs nodeId={selectedNodeId} />
                )}
              </DrawerBody>
            </DrawerContent>
          </Drawer>
        </HStack>
      </Box>

      {/* Saved Views Panel */}
      <Drawer
        isOpen={isSavedViewsOpen}
        placement="left"
        onClose={closeSavedViews}
        size="md"
      >
        <DrawerOverlay />
        <DrawerContent>
          <DrawerCloseButton />
          <DrawerHeader>
            Saved Views
          </DrawerHeader>
          <DrawerBody>
            <SavedViews />
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    </Box>
  );
}
