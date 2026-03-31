import React from 'react';
import { 
  Box, 
  HStack, 
  Text, 
  Badge, 
  Stat, 
  StatLabel, 
  StatNumber,
  StatGroup 
} from '@chakra-ui/react';
import type { GraphMode } from '../../types/graph';

interface GraphStatusBarProps {
  nodeCount: number;
  edgeCount: number;
  selectedNodeId?: string;
  mode: GraphMode;
}

export default function GraphStatusBar({
  nodeCount,
  edgeCount,
  selectedNodeId,
  mode
}: GraphStatusBarProps) {
  return (
    <Box
      position="absolute"
      bottom={0}
      left={0}
      right={0}
      bg="white"
      borderTop="1px"
      borderColor="gray.200"
      p={3}
      zIndex={10}
    >
      <HStack justify="space-between" align="center">
        <StatGroup>
          <Stat size="sm">
            <StatLabel>Nodes</StatLabel>
            <StatNumber>{nodeCount.toLocaleString()}</StatNumber>
          </Stat>
          
          <Stat size="sm">
            <StatLabel>Edges</StatLabel>
            <StatNumber>{edgeCount.toLocaleString()}</StatNumber>
          </Stat>
        </StatGroup>
        
        <HStack spacing={3}>
          <Badge colorScheme="blue" textTransform="capitalize">
            {mode} View
          </Badge>
          
          {selectedNodeId && (
            <Badge colorScheme="green">
              Selected: {selectedNodeId}
            </Badge>
          )}
          
          <Text fontSize="sm" color="gray.600">
            Double-click nodes to expand
          </Text>
        </HStack>
      </HStack>
    </Box>
  );
}


