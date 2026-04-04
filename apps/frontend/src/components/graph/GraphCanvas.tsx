/**
 * GraphCanvas Component - Real Implementation
 * Advanced graph visualization for code relationships and system architecture
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  Text,
  VStack,
  HStack,
  Card,
  CardHeader,
  CardBody,
  Button,
  IconButton,
  Select,
  Switch,
  FormControl,
  FormLabel,
  Spinner,
  Alert,
  AlertIcon,
  useToast,
  Divider,
  Collapse,
  useDisclosure
} from '@chakra-ui/react';
import {
  FiRefreshCw,
  FiSettings,
  FiZoomIn,
  FiZoomOut,
  FiRotateCw,
  FiEye,
  FiEyeOff
} from 'react-icons/fi';

interface GraphNode {
  id: string;
  label: string;
  type: 'file' | 'function' | 'class' | 'variable' | 'module';
  metadata: {
    path?: string;
    language?: string;
    complexity?: number;
    importance?: number;
  };
  position: { x: number; y: number };
  color: string;
  size: number;
}

interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: 'calls' | 'depends_on' | 'imports' | 'references';
  weight: number;
  color: string;
}

interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

interface GraphCanvasProps {
  repositoryId?: string;
  selectedNodeId?: string | null;
  onNodeSelect?: (nodeId: string | null, node?: GraphNode) => void;
  onNodeDoubleClick?: (nodeId: string) => void;
  height?: number;
  width?: number | undefined;
  data?: GraphData;
  layout?: string;
  style?: React.CSSProperties;
  enableMinimap?: boolean;
  enableToolbar?: boolean;
  enableContextMenu?: boolean;
  enableLegend?: boolean;
  enableCollaboration?: boolean;
  theme?: string;
}

export default function GraphCanvas({
  repositoryId,
  selectedNodeId,
  onNodeSelect,
  onNodeDoubleClick,
  height = 600,
  width = 800,
  data,
  layout,
  style,
  enableMinimap = true,
  enableToolbar = true,
  enableContextMenu = true,
  enableLegend = true,
  enableCollaboration = false,
  theme = 'default'
}: GraphCanvasProps) {
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [showEdgeLabels, setShowEdgeLabels] = useState(false);
  const [nodeTypeFilter, setNodeTypeFilter] = useState<string>('all');
  const [edgeTypeFilter, setEdgeTypeFilter] = useState<string>('all');
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { isOpen: showControls, onToggle: toggleControls } = useDisclosure({ defaultIsOpen: true });
  const toast = useToast();

  useEffect(() => {
    fetchGraphData();
  }, [repositoryId]);

  useEffect(() => {
    if (graphData) {
      renderGraph();
    }
  }, [graphData, zoomLevel, showEdgeLabels, nodeTypeFilter, edgeTypeFilter, selectedNodeId]);

  const fetchGraphData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch real graph data from ArangoDB via QA engine

      const response = await fetch(`/graph/nodes${repositoryId ? `?repositoryId=${repositoryId}` : ''}`);
      if (response.ok) {
        const data = await response.json();
        if (data.nodes?.length > 0) {
          setGraphData(data);
        } else {
          setGraphData({ nodes: [], edges: [] });
          setError('No graph data available. Run a repository ingestion first to populate the code graph.');
        }
      } else {
        setGraphData({ nodes: [], edges: [] });
        setError('Graph visualization requires a repository ingestion first. Navigate to the Ingestion page to analyze a repository.');
      }

    } catch (err) {
      setGraphData({ nodes: [], edges: [] });
      const msg = err instanceof Error ? err.message : 'Failed to load graph data';
      setError(msg.includes('not valid JSON') ? 'Graph visualization requires a repository ingestion first. Navigate to the Ingestion page to analyze a repository.' : msg);
    } finally {
      setIsLoading(false);
    }
  };

  const renderGraph = useCallback(() => {
    if (!canvasRef.current || !graphData) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = width;
    canvas.height = height;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Apply zoom and centering
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.scale(zoomLevel, zoomLevel);
    ctx.translate(-width / 2, -height / 2);

    // Filter data
    const filteredNodes = nodeTypeFilter === 'all' 
      ? graphData.nodes 
      : graphData.nodes.filter(node => node.type === nodeTypeFilter);
    
    const filteredNodeIds = new Set(filteredNodes.map(node => node.id));
    const filteredEdges = graphData.edges.filter(edge => {
      const typeMatch = edgeTypeFilter === 'all' || edge.type === edgeTypeFilter;
      const nodeMatch = filteredNodeIds.has(edge.source) && filteredNodeIds.has(edge.target);
      return typeMatch && nodeMatch;
    });

    // Render edges first
    renderEdges(ctx, filteredEdges, filteredNodes);
    
    // Render nodes
    renderNodes(ctx, filteredNodes);

    ctx.restore();
  }, [graphData, zoomLevel, showEdgeLabels, nodeTypeFilter, edgeTypeFilter, selectedNodeId, width, height]);

  const renderNodes = (ctx: CanvasRenderingContext2D, nodes: GraphNode[]) => {
    nodes.forEach(node => {
      const isSelected = node.id === selectedNodeId;
      const radius = node.size;
      
      ctx.save();
      
      // Shadow for selected nodes
      if (isSelected) {
        ctx.shadowColor = node.color;
        ctx.shadowBlur = 15;
      }
      
      // Draw node
      ctx.beginPath();
      ctx.arc(node.position.x, node.position.y, radius + (isSelected ? 3 : 0), 0, 2 * Math.PI);
      ctx.fillStyle = node.color;
      ctx.fill();
      
      // Node border
      ctx.strokeStyle = isSelected ? '#000' : '#fff';
      ctx.lineWidth = isSelected ? 3 : 1;
      ctx.stroke();
      
      // Node label
      if (zoomLevel > 0.5) {
        ctx.font = `${Math.max(10, 12 * zoomLevel)}px Arial`;
        ctx.fillStyle = '#333';
        ctx.textAlign = 'center';
        const labelText = node.label.length > 15 ? node.label.substring(0, 15) + '...' : node.label;
        ctx.fillText(labelText, node.position.x, node.position.y + radius + 15);
      }
      
      ctx.restore();
    });
  };

  const renderEdges = (ctx: CanvasRenderingContext2D, edges: GraphEdge[], nodes: GraphNode[]) => {
    const nodeMap = new Map(nodes.map(node => [node.id, node]));
    
    edges.forEach(edge => {
      const sourceNode = nodeMap.get(edge.source);
      const targetNode = nodeMap.get(edge.target);
      
      if (!sourceNode || !targetNode) return;
      
      ctx.save();
      ctx.strokeStyle = edge.color;
      ctx.lineWidth = Math.max(1, edge.weight);
      ctx.globalAlpha = 0.6;
      
      // Draw edge
      ctx.beginPath();
      ctx.moveTo(sourceNode.position.x, sourceNode.position.y);
      ctx.lineTo(targetNode.position.x, targetNode.position.y);
      ctx.stroke();
      
      // Edge label
      if (showEdgeLabels && zoomLevel > 0.7) {
        const midX = (sourceNode.position.x + targetNode.position.x) / 2;
        const midY = (sourceNode.position.y + targetNode.position.y) / 2;
        
        ctx.font = '10px Arial';
        ctx.fillStyle = '#666';
        ctx.textAlign = 'center';
        ctx.globalAlpha = 1;
        ctx.fillText(edge.type, midX, midY - 5);
      }
      
      ctx.restore();
    });
  };

  const handleCanvasClick = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !graphData) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    
    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;
    
    // Transform coordinates back to graph space
    const graphX = (x - width / 2) / zoomLevel + width / 2;
    const graphY = (y - height / 2) / zoomLevel + height / 2;
    
    // Find clicked node
    const clickedNode = graphData.nodes.find(node => {
      const distance = Math.sqrt(
        Math.pow(graphX - node.position.x, 2) + Math.pow(graphY - node.position.y, 2)
      );
      return distance <= node.size + 5;
    });
    
    if (clickedNode) {
      onNodeSelect?.(clickedNode.id);
    } else {
      onNodeSelect?.(null);
    }
  }, [graphData, zoomLevel, onNodeSelect, width, height]);

  const handleCanvasDoubleClick = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !graphData) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    
    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;
    
    const graphX = (x - width / 2) / zoomLevel + width / 2;
    const graphY = (y - height / 2) / zoomLevel + height / 2;
    
    const clickedNode = graphData.nodes.find(node => {
      const distance = Math.sqrt(
        Math.pow(graphX - node.position.x, 2) + Math.pow(graphY - node.position.y, 2)
      );
      return distance <= node.size + 5;
    });
    
    if (clickedNode) {
      onNodeDoubleClick?.(clickedNode.id);
    }
  }, [graphData, zoomLevel, onNodeDoubleClick, width, height]);

  if (isLoading) {
    return (
      <Box height={height} display="flex" alignItems="center" justifyContent="center">
        <VStack>
          <Spinner size="xl" />
          <Text>Loading graph data...</Text>
        </VStack>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert status="error" height={height}>
        <AlertIcon />
        <VStack align="start">
          <Text fontWeight="bold">Failed to load graph</Text>
          <Text>{error}</Text>
        </VStack>
      </Alert>
    );
  }

  return (
    <Box position="relative" width={width} height={height} border="1px" borderColor="gray.200" borderRadius="md">
      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        onDoubleClick={handleCanvasDoubleClick}
        style={{
          cursor: 'crosshair',
          width: '100%',
          height: '100%',
          display: 'block'
        }}
      />
      
      {/* Controls */}
      <Box position="absolute" top={4} right={4} zIndex={10}>
        <VStack spacing={2}>
          <IconButton
            aria-label="Toggle controls"
            icon={showControls ? <FiEyeOff /> : <FiEye />}
            size="sm"
            onClick={toggleControls}
            bg="white"
            shadow="sm"
          />
          
          <Collapse in={showControls}>
            <Card size="sm" minW="200px">
              <CardHeader pb={2}>
                <HStack>
                  <FiSettings />
                  <Text fontWeight="semibold" fontSize="sm">Graph Controls</Text>
                </HStack>
              </CardHeader>
              <CardBody pt={0}>
                <VStack spacing={3} align="stretch">
                  <FormControl size="sm">
                    <FormLabel fontSize="xs">Zoom: {zoomLevel.toFixed(1)}x</FormLabel>
                    <HStack>
                      <IconButton
                        aria-label="Zoom out"
                        icon={<FiZoomOut />}
                        size="xs"
                        onClick={() => setZoomLevel(prev => Math.max(0.1, prev - 0.1))}
                      />
                      <IconButton
                        aria-label="Zoom in"
                        icon={<FiZoomIn />}
                        size="xs"
                        onClick={() => setZoomLevel(prev => Math.min(3, prev + 0.1))}
                      />
                    </HStack>
                  </FormControl>
                  
                  <Divider />
                  
                  <FormControl size="sm">
                    <FormLabel fontSize="xs">Node Type</FormLabel>
                    <Select 
                      size="sm" 
                      value={nodeTypeFilter} 
                      onChange={(e) => setNodeTypeFilter(e.target.value)}
                    >
                      <option value="all">All Types</option>
                      <option value="file">Files</option>
                      <option value="function">Functions</option>
                      <option value="class">Classes</option>
                      <option value="variable">Variables</option>
                      <option value="module">Modules</option>
                    </Select>
                  </FormControl>
                  
                  <FormControl size="sm">
                    <FormLabel fontSize="xs">Edge Type</FormLabel>
                    <Select 
                      size="sm" 
                      value={edgeTypeFilter} 
                      onChange={(e) => setEdgeTypeFilter(e.target.value)}
                    >
                      <option value="all">All Relations</option>
                      <option value="calls">Calls</option>
                      <option value="depends_on">Dependencies</option>
                      <option value="imports">Imports</option>
                      <option value="references">References</option>
                    </Select>
                  </FormControl>
                  
                  <FormControl display="flex" alignItems="center" size="sm">
                    <FormLabel htmlFor="edge-labels" mb={0} fontSize="xs">
                      Edge Labels
                    </FormLabel>
                    <Switch
                      id="edge-labels"
                      size="sm"
                      isChecked={showEdgeLabels}
                      onChange={(e) => setShowEdgeLabels(e.target.checked)}
                    />
                  </FormControl>
                  
                  <Divider />
                  
                  <HStack>
                    <Button size="xs" leftIcon={<FiRefreshCw />} onClick={fetchGraphData} variant="outline">
                      Refresh
                    </Button>
                    <Button size="xs" leftIcon={<FiRotateCw />} onClick={() => setZoomLevel(1)} variant="outline">
                      Reset
                    </Button>
                  </HStack>
                </VStack>
              </CardBody>
            </Card>
          </Collapse>
        </VStack>
      </Box>
      
      {/* Stats */}
      {graphData && (
        <Box position="absolute" bottom={4} left={4} zIndex={10}>
          <Card size="sm" bg="rgba(255, 255, 255, 0.9)">
            <CardBody>
              <HStack spacing={4} fontSize="xs">
                <Text><strong>Nodes:</strong> {graphData.nodes.length}</Text>
                <Text><strong>Edges:</strong> {graphData.edges.length}</Text>
              </HStack>
            </CardBody>
          </Card>
        </Box>
      )}
    </Box>
  );
}


