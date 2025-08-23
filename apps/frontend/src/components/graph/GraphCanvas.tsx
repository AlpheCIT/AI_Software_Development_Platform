import React from 'react';
import { Box, Text, Spinner } from '@chakra-ui/react';
import type { GraphNode, GraphEdge, GraphMode, OverlayType } from '../../types/graph';

interface GraphCanvasProps {
  data: {
    nodes: GraphNode[];
    edges: GraphEdge[];
  };
  mode: GraphMode;
  overlay?: OverlayType | null;
  selectedNodeId?: string;
  onNodeSelect?: (nodeId?: string) => void;
  onNodeDoubleClick?: (nodeId: string) => void;
}

export default function GraphCanvas({
  data,
  mode,
  overlay,
  selectedNodeId,
  onNodeSelect,
  onNodeDoubleClick
}: GraphCanvasProps) {
  // This is a placeholder implementation
  // In a real implementation, you would integrate with Graphin or another graph library
  
  return (
    <Box 
      width="100%" 
      height="100%" 
      bg="white" 
      border="1px" 
      borderColor="gray.200"
      borderRadius="md"
      position="relative"
      display="flex"
      alignItems="center"
      justifyContent="center"
      flexDirection="column"
      gap={4}
    >
      <Spinner size="xl" color="blue.500" />
      <Text color="gray.600">
        Graph Canvas ({data.nodes.length} nodes, {data.edges.length} edges)
      </Text>
      <Text fontSize="sm" color="gray.500">
        Mode: {mode} {overlay && `| Overlay: ${overlay}`}
      </Text>
      {selectedNodeId && (
        <Text fontSize="sm" color="blue.600">
          Selected: {selectedNodeId}
        </Text>
      )}
      <Text fontSize="xs" color="gray.400" textAlign="center" maxW="300px">
        This is a placeholder. The real GraphCanvas will integrate with Graphin 
        for advanced graph visualization with all the features from your specs.
      </Text>
    </Box>
  );
}
