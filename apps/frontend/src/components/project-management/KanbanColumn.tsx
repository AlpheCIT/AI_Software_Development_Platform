/**
 * Kanban Column Component
 * Represents a single column in the Kanban board (e.g., To Do, In Progress, Done)
 */

import React from 'react';
import { Droppable } from 'react-beautiful-dnd';
import { 
  VStack, 
  Box, 
  Heading, 
  Badge, 
  Text, 
  HStack,
  Divider
} from '@chakra-ui/react';
import IssueCard from './IssueCard';

interface Column {
  id: string;
  title: string;
  color: string;
  description?: string;
}

interface Issue {
  id: string;
  key: string;
  summary: string;
  issueType: {
    name: string;
    iconUrl?: string;
  };
  priority: {
    name: string;
    iconUrl?: string;
  };
  status: {
    name: string;
    categoryKey: string;
  };
  assignee?: {
    accountId: string;
    displayName: string;
    avatarUrls: { '24x24': string };
  };
  labels: string[];
  updated: string;
  created: string;
  storyPoints?: number;
}

interface KanbanColumnProps {
  column: Column;
  issues: Issue[];
  onIssueClick: (issue: Issue) => void;
  isConnected: boolean;
}

export function KanbanColumn({ 
  column, 
  issues, 
  onIssueClick, 
  isConnected 
}: KanbanColumnProps) {
  
  const getTotalStoryPoints = () => {
    return issues.reduce((total, issue) => {
      return total + (issue.storyPoints || 0);
    }, 0);
  };

  const getColumnStats = () => {
    const totalPoints = getTotalStoryPoints();
    const issueCount = issues.length;
    
    return { totalPoints, issueCount };
  };

  const { totalPoints, issueCount } = getColumnStats();

  return (
    <Box
      w="320px"
      bg="white"
      borderRadius="lg"
      border="1px solid"
      borderColor="gray.200"
      shadow="sm"
      _hover={{ shadow: 'md' }}
      transition="box-shadow 0.2s"
    >
      {/* Column Header */}
      <Box p={4} borderBottom="1px solid" borderColor="gray.100">
        <VStack spacing={2} align="stretch">
          <HStack justify="space-between">
            <Heading size="sm" color="gray.700">
              {column.title}
            </Heading>
            <HStack spacing={2}>
              <Badge
                colorScheme={column.color}
                borderRadius="full"
                px={2}
                fontSize="xs"
              >
                {issueCount}
              </Badge>
              {totalPoints > 0 && (
                <Badge
                  variant="outline"
                  colorScheme={column.color}
                  borderRadius="full"
                  px={2}
                  fontSize="xs"
                >
                  {totalPoints} pts
                </Badge>
              )}
            </HStack>
          </HStack>
          
          {column.description && (
            <Text fontSize="xs" color="gray.500">
              {column.description}
            </Text>
          )}
        </VStack>
      </Box>

      {/* Drop Zone */}
      <Droppable droppableId={column.id}>
        {(provided, snapshot) => (
          <Box
            ref={provided.innerRef}
            {...provided.droppableProps}
            minH="500px"
            maxH="70vh"
            overflowY="auto"
            p={3}
            bg={snapshot.isDraggingOver ? `${column.color}.50` : 'transparent'}
            borderRadius="0 0 lg lg"
            transition="background-color 0.2s"
          >
            <VStack spacing={3}>
              {issues.map((issue, index) => (
                <IssueCard
                  key={issue.id}
                  issue={issue}
                  onUpdate={async (issueId, updates) => {
                    onIssueClick(issue);
                  }}
                />
              ))}
              {provided.placeholder}
            </VStack>
            
            {/* Empty State */}
            {issues.length === 0 && (
              <Box
                textAlign="center"
                color="gray.400"
                fontSize="sm"
                mt={12}
                p={8}
                border="2px dashed"
                borderColor="gray.200"
                borderRadius="md"
              >
                <Text fontWeight="medium">
                  No issues in {column.title.toLowerCase()}
                </Text>
                <Text fontSize="xs" mt={1}>
                  {snapshot.isDraggingOver 
                    ? 'Drop issue here' 
                    : 'Drag issues here or create new ones'
                  }
                </Text>
              </Box>
            )}
          </Box>
        )}
      </Droppable>

      {/* Column Footer with Summary */}
      {issues.length > 0 && (
        <>
          <Divider />
          <Box p={3} bg="gray.50" borderRadius="0 0 lg lg">
            <HStack justify="space-between" fontSize="xs" color="gray.600">
              <Text>
                {issueCount} issue{issueCount !== 1 ? 's' : ''}
              </Text>
              {totalPoints > 0 && (
                <Text>
                  {totalPoints} story point{totalPoints !== 1 ? 's' : ''}
                </Text>
              )}
            </HStack>
          </Box>
        </>
      )}
    </Box>
  );
}

export default KanbanColumn;


