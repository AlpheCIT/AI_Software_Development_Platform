import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Box, Spinner, Alert, AlertIcon, useToast } from '@chakra-ui/react';
import G6, { Graph, NodeConfig, EdgeConfig } from '@antv/g6';
import { useMCP } from '../../lib/mcp/useMCP';

export interface GraphNode extends NodeConfig {
  id: string;
  type: 'service' | 'database' | 'file' | 'class' | 'function' | 'component';
  name: string;
  properties: {
    language?: string;
    complexity?: number;
    lines?: number;
    security_issues?: number;
    performance_issues?: number;
    [key: string]: any;
  };
}

export interface GraphEdge extends EdgeConfig {
  id: string;
  source: string;
  target: string;
  type: 'depends_on' | 'calls' | 'imports' | 'contains' | 'uses';
  properties?: {
    weight?: number;
    frequency?: number;
    [key: string]: any;
  };
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

interface GraphCanvasProps {
  data?: GraphData;
  selectedNodeId?: string;
  onNodeSelect?: (nodeId: string | null) => void;
  onNodeDoubleClick?: (nodeId: string) => void;
  width?: number;
  height?: number;
  layout?: string;
}

const nodeTypeColors = {
  service: '#1f77b4',      // Blue
  database: '#ff7f0e',     // Orange
  file: '#2ca02c',         // Green
  class: '#d62728',        // Red
  function: '#9467bd',     // Purple
  component: '#8c564b',    // Brown
  default: '#7f7f7f'       // Gray
};

const edgeTypeColors = {
  depends_on: '#1f77b4',
  calls: '#ff7f0e',
  imports: '#2ca02c',
  contains: '#d62728',
  uses: '#9467bd',
  default: '#999999'
};

export const GraphCanvas: React.FC<GraphCanvasProps> = ({
  data,
  selectedNodeId,
  onNodeSelect,
  onNodeDoubleClick,
  width = 800,
  height = 600,
  layout = 'force'
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<Graph | null>(null);
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], edges: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  // MCP integration for real data
  const { 
    graphData: mcpGraphData, 
    graphLoading, 
    graphError, 
    loadGraphSeeds,
    loadNodeDetails,
    expandNodeNeighborhood 
  } = useMCP();

  // Transform MCP data to G6 format
  const transformMCPData = useCallback((mcpData: any): GraphData => {
    if (!mcpData) return { nodes: [], edges: [] };

    const nodes: GraphNode[] = mcpData.nodes.map((node: any) => ({
      id: node.id,
      type: node.type || 'default',
      name: node.name || node.id,
      properties: node.properties || {},
      // G6 specific styling
      style: {
        fill: getNodeColor(node.type),
        stroke: selectedNodeId === node.id ? '#1890ff' : '#fff',
        lineWidth: selectedNodeId === node.id ? 3 : 1,
        r: getNodeSize(node)
      },
      label: node.name || node.id,
      labelCfg: {
        position: 'bottom',
        offset: 5,
        style: {
          fill: '#333',
          fontSize: 12,
          textAlign: 'center' as const
        }
      }
    }));

    const edges: GraphEdge[] = mcpData.edges.map((edge: any) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: edge.type || 'default',
      properties: edge.properties || {},
      // G6 specific styling
      style: {
        stroke: getEdgeColor(edge.type),
        lineWidth: getEdgeWidth(edge),
        opacity: 0.6
      },
      label: edge.type,
      labelCfg: {
        style: {
          fill: '#666',
          fontSize: 10
        }
      }
    }));

    return { nodes, edges };
  }, [selectedNodeId]);

  const getNodeSize = (node: any): number => {
    const baseSize = 20;
    const complexity = node.properties?.complexity || 1;
    const lines = node.properties?.lines || 0;
    
    // Size based on complexity or lines of code
    if (lines > 0) {
      return Math.max(baseSize, Math.min(60, baseSize + Math.log(lines) * 3));
    } else if (complexity > 1) {
      return Math.max(baseSize, Math.min(50, baseSize + complexity * 2));
    }
    
    return baseSize;
  };

  const getNodeColor = (type: string): string => {
    return nodeTypeColors[type as keyof typeof nodeTypeColors] || nodeTypeColors.default;
  };

  const getEdgeColor = (type: string): string => {
    return edgeTypeColors[type as keyof typeof edgeTypeColors] || edgeTypeColors.default;
  };

  const getEdgeWidth = (edge: any): number => {
    const weight = edge.properties?.weight || 1;
    const frequency = edge.properties?.frequency || 1;
    return Math.max(1, Math.min(5, weight * frequency));
  };

  // Initialize G6 graph
  useEffect(() => {
    if (!containerRef.current) return;

    // Create G6 graph instance
    const graph = new G6.Graph({
      container: containerRef.current,
      width,
      height,
      modes: {
        default: ['drag-canvas', 'zoom-canvas', 'drag-node']
      },
      layout: {
        type: layout,
        ...(layout === 'force' && {
          preventOverlap: true,
          nodeSize: 30,
          nodeSpacing: 10,
          linkDistance: 100,
          nodeStrength: 30,
          edgeStrength: 0.1,
          collideStrength: 0.8,
          alpha: 0.3,
          alphaDecay: 0.028,
          alphaMin: 0.01,
        }),
        ...(layout === 'circular' && {
          radius: Math.min(width, height) * 0.3,
          startAngle: 0,
          endAngle: 2 * Math.PI,
        }),
        ...(layout === 'concentric' && {
          minNodeSpacing: 10,
          preventOverlap: true,
          nodeSize: 30,
        })
      },
      defaultNode: {
        type: 'circle',
        size: [20],
        style: {
          fill: '#5B8FF9',
          stroke: '#5B8FF9',
          lineWidth: 2,
        },
        labelCfg: {
          position: 'bottom',
          offset: 5,
          style: {
            fill: '#666',
            fontSize: 12,
          }
        }
      },
      defaultEdge: {
        type: 'line',
        style: {
          stroke: '#e2e2e2',
          lineWidth: 1,
        },
        labelCfg: {
          autoRotate: true,
          style: {
            fill: '#666',
            fontSize: 10,
          }
        }
      },
      nodeStateStyles: {
        hover: {
          stroke: '#1890ff',
          lineWidth: 2,
        },
        selected: {
          stroke: '#1890ff',
          lineWidth: 3,
        },
      },
      edgeStateStyles: {
        hover: {
          stroke: '#1890ff',
          opacity: 0.8,
        },
      },
    });

    // Event handlers
    graph.on('node:click', async (evt) => {
      const node = evt.item;
      if (node) {
        const nodeModel = node.getModel();
        const nodeId = nodeModel.id as string;
        
        // Load additional node details
        try {
          const details = await loadNodeDetails(nodeId);
          if (details) {
            // Update node with additional details
            node.update({
              ...nodeModel,
              properties: { ...nodeModel.properties, ...details.properties }
            });
          }
        } catch (error) {
          console.error('Failed to load node details:', error);
        }

        onNodeSelect?.(nodeId);
      }
    });

    graph.on('node:dblclick', async (evt) => {
      const node = evt.item;
      if (node) {
        const nodeModel = node.getModel();
        const nodeId = nodeModel.id as string;
        
        // Expand node neighborhood
        try {
          const neighborhood = await expandNodeNeighborhood(nodeId, 1);
          if (neighborhood) {
            const transformedData = transformMCPData(neighborhood);
            
            // Get current data
            const currentData = graph.save() as any;
            const existingNodeIds = new Set(currentData.nodes.map((n: any) => n.id));
            const existingEdgeIds = new Set(currentData.edges.map((e: any) => e.id));

            // Add new nodes and edges
            const newNodes = transformedData.nodes.filter(n => !existingNodeIds.has(n.id));
            const newEdges = transformedData.edges.filter(e => !existingEdgeIds.has(e.id));

            // Add to graph
            newNodes.forEach(node => graph.addItem('node', node));
            newEdges.forEach(edge => graph.addItem('edge', edge));

            // Re-layout
            graph.layout();

            toast({
              title: 'Node Expanded',
              description: `Added ${newNodes.length} nodes and ${newEdges.length} connections`,
              status: 'success',
              duration: 2000,
            });
          }
        } catch (error) {
          console.error('Failed to expand node:', error);
          toast({
            title: 'Expansion Failed',
            description: 'Could not expand node neighborhood',
            status: 'error',
            duration: 3000,
          });
        }

        onNodeDoubleClick?.(nodeId);
      }
    });

    graph.on('canvas:click', () => {
      onNodeSelect?.(null);
    });

    graphRef.current = graph;

    return () => {
      if (graphRef.current) {
        graphRef.current.destroy();
      }
    };
  }, [width, height, layout, loadNodeDetails, expandNodeNeighborhood, onNodeSelect, onNodeDoubleClick, toast, transformMCPData]);

  // Update graph data when MCP data changes
  useEffect(() => {
    if (mcpGraphData) {
      const transformed = transformMCPData(mcpGraphData);
      setGraphData(transformed);
      setLoading(false);
      setError(null);

      // Update graph with new data
      if (graphRef.current) {
        graphRef.current.data(transformed);
        graphRef.current.render();
        graphRef.current.fitView();
      }
    } else if (data) {
      setGraphData(data);
      setLoading(false);
      setError(null);

      // Update graph with provided data
      if (graphRef.current) {
        graphRef.current.data(data);
        graphRef.current.render();
        graphRef.current.fitView();
      }
    }
  }, [mcpGraphData, data, transformMCPData]);

  // Handle loading and error states
  useEffect(() => {
    setLoading(graphLoading);
    setError(graphError);
  }, [graphLoading, graphError]);

  // Load initial graph data
  useEffect(() => {
    if (!data && !mcpGraphData) {
      loadGraphSeeds(100);
    }
  }, [data, mcpGraphData, loadGraphSeeds]);

  // Update selected node styling
  useEffect(() => {
    if (graphRef.current) {
      // Clear previous selection
      graphRef.current.getNodes().forEach(node => {
        graphRef.current!.clearItemStates(node, 'selected');
      });

      // Set new selection
      if (selectedNodeId) {
        const node = graphRef.current.findById(selectedNodeId);
        if (node) {
          graphRef.current.setItemState(node, 'selected', true);
        }
      }
    }
  }, [selectedNodeId]);

  if (loading) {
    return (
      <Box 
        width={width} 
        height={height} 
        display="flex" 
        alignItems="center" 
        justifyContent="center"
        bg="gray.50"
        borderRadius="md"
      >
        <Spinner size="xl" color="blue.500" />
      </Box>
    );
  }

  if (error) {
    return (
      <Box width={width} height={height}>
        <Alert status="error">
          <AlertIcon />
          Failed to load graph data: {error}
        </Alert>
      </Box>
    );
  }

  if (graphData.nodes.length === 0) {
    return (
      <Box 
        width={width} 
        height={height} 
        display="flex" 
        alignItems="center" 
        justifyContent="center"
        bg="gray.50"
        borderRadius="md"
        border="2px dashed"
        borderColor="gray.300"
      >
        <Box textAlign="center">
          <Box fontSize="lg" fontWeight="bold" color="gray.600" mb={2}>
            No Graph Data Available
          </Box>
          <Box fontSize="sm" color="gray.500">
            Start a repository analysis to see the graph visualization
          </Box>
        </Box>
      </Box>
    );
  }

  return (
    <Box 
      ref={containerRef}
      width={width} 
      height={height}
      border="1px solid"
      borderColor="gray.200"
      borderRadius="md"
      overflow="hidden"
      position="relative"
    />
  );
};

export default GraphCanvas;