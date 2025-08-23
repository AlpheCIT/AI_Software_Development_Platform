/**
 * Kanban Board Component
 * Displays and manages Jira issues in a drag-and-drop Kanban interface
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  HStack,
  VStack,
  Text,
  Badge,
  Card,
  CardBody,
  CardHeader,
  Avatar,
  Heading,
  Button,
  IconButton,
  useToast,
  Spinner,
  Alert,
  AlertIcon,
  Flex,
  useColorModeValue,
  Tooltip,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  useDisclosure,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  ModalFooter,
  FormControl,
  FormLabel,
  Input,
  Textarea,
  Select
} from '@chakra-ui/react';
import { 
  Plus, 
  MoreHorizontal, 
  AlertTriangle, 
  Clock,
  CheckCircle,
  RefreshCw,
  Settings,
  User,
  Calendar,
  Target
} from 'lucide-react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { useJiraIntegration } from '../../hooks/useJiraIntegration';
import IssueCard from './IssueCard';
import CreateIssueModal from './CreateIssueModal';

interface KanbanBoardProps {
  projectKey: string;
}

interface JiraIssue {
  id: string;
  key: string;
  summary: string;
  description?: string;
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

interface KanbanColumn {
  id: string;
  title: string;
  issues: JiraIssue[];
  color: string;
  limit?: number;
}

export default function KanbanBoard({ projectKey }: KanbanBoardProps) {
  const [columns, setColumns] = useState<KanbanColumn[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const toast = useToast();
  
  const { isOpen: isCreateOpen, onOpen: onCreateOpen, onClose: onCreateClose } = useDisclosure();
  
  const {
    issues,
    isConnected,
    syncStatus,
    moveIssue,
    createIssue,
    updateIssue,
    refreshIssues,
    error
  } = useJiraIntegration(projectKey);

  const bgColor = useColorModeValue('gray.50', 'gray.900');
  const cardBg = useColorModeValue('white', 'gray.800');

  // Initialize columns when issues load
  useEffect(() => {
    if (issues && issues.length > 0) {
      const statusColumns = {
        'To Do': { color: 'gray', issues: [] as JiraIssue[] },
        'In Progress': { color: 'blue', issues: [] as JiraIssue[] },
        'Code Review': { color: 'orange', issues: [] as JiraIssue[] },
        'Testing': { color: 'purple', issues: [] as JiraIssue[] },
        'Done': { color: 'green', issues: [] as JiraIssue[] }
      };

      // Group issues by status
      issues.forEach(issue => {
        const status = issue.status.name;
        if (statusColumns[status as keyof typeof statusColumns]) {
          statusColumns[status as keyof typeof statusColumns].issues.push(issue);
        } else {
          // Default to "To Do" for unknown statuses
          statusColumns['To Do'].issues.push(issue);
        }
      });

      const columnData: KanbanColumn[] = Object.entries(statusColumns).map(([status, data]) => ({
        id: status.toLowerCase().replace(' ', '-'),
        title: status,
        issues: data.issues,
        color: data.color
      }));

      setColumns(columnData);
      setIsLoading(false);
    } else if (issues && issues.length === 0) {
      // Initialize empty columns
      setColumns([
        { id: 'to-do', title: 'To Do', issues: [], color: 'gray' },
        { id: 'in-progress', title: 'In Progress', issues: [], color: 'blue' },
        { id: 'code-review', title: 'Code Review', issues: [], color: 'orange' },
        { id: 'testing', title: 'Testing', issues: [], color: 'purple' },
        { id: 'done', title: 'Done', issues: [], color: 'green' }
      ]);
      setIsLoading(false);
    }
  }, [issues]);

  const handleDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const sourceColumn = columns.find(col => col.id === source.droppableId);
    const destColumn = columns.find(col => col.id === destination.droppableId);
    
    if (!sourceColumn || !destColumn) return;

    const draggedIssue = sourceColumn.issues[source.index];
    if (!draggedIssue) return;

    // Update local state immediately for responsive UI
    const newColumns = columns.map(column => {
      if (column.id === source.droppableId) {
        const newIssues = [...column.issues];
        newIssues.splice(source.index, 1);
        return { ...column, issues: newIssues };
      }
      if (column.id === destination.droppableId) {
        const newIssues = [...column.issues];
        newIssues.splice(destination.index, 0, draggedIssue);
        return { ...column, issues: newIssues };
      }
      return column;
    });

    setColumns(newColumns);
    setIsSyncing(true);

    try {
      // Update Jira via API
      await moveIssue(draggedIssue.key, destColumn.title);
      
      toast({
        title: 'Issue Moved',
        description: `${draggedIssue.key} moved to ${destColumn.title}`,
        status: 'success',
        duration: 3000,
      });
    } catch (error) {
      // Revert local changes if API call fails
      setColumns(columns);
      
      toast({
        title: 'Move Failed',
        description: error instanceof Error ? error.message : 'Failed to move issue',
        status: 'error',
        duration: 5000,
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCreateIssue = async (issueData: Partial<JiraIssue>) => {
    try {
      await createIssue(issueData);
      onCreateClose();
      await refreshIssues();
      
      toast({
        title: 'Issue Created',
        description: `New issue created successfully`,
        status: 'success',
        duration: 3000,
      });
    } catch (error) {
      toast({
        title: 'Creation Failed',
        description: error instanceof Error ? error.message : 'Failed to create issue',
        status: 'error',
        duration: 5000,
      });
    }
  };

  const handleRefresh = async () => {
    setIsLoading(true);
    try {
      await refreshIssues();
      toast({
        title: 'Refreshed',
        description: 'Issues updated from Jira',
        status: 'success',
        duration: 2000,
      });
    } catch (error) {
      toast({
        title: 'Refresh Failed',
        description: 'Could not sync with Jira',
        status: 'error',
        duration: 5000,
      });
    }
  };

  if (isLoading) {
    return (
      <Box h="100vh" display="flex" alignItems="center" justifyContent="center">
        <VStack spacing={4}>
          <Spinner size="xl" color="blue.500" />
          <Text>Loading Kanban board...</Text>
        </VStack>
      </Box>
    );
  }

  if (!isConnected) {
    return (
      <Box p={6}>
        <Alert status="error">
          <AlertIcon />
          <VStack align="start" spacing={2}>
            <Text fontWeight="bold">Jira Connection Failed</Text>
            <Text>Unable to connect to Jira. Please check your configuration.</Text>
          </VStack>
        </Alert>
      </Box>
    );
  }

  return (
    <Box bg={bgColor} minH="100vh" p={6}>
      {/* Header */}
      <Flex justify="space-between" align="center" mb={6}>
        <HStack spacing={3}>
          <Target size={24} color="blue" />
          <Heading size="lg">Project {projectKey}</Heading>
          <Badge colorScheme={isConnected ? 'green' : 'red'}>
            {isConnected ? 'Connected' : 'Offline'}
          </Badge>
          {isSyncing && (
            <HStack>
              <Spinner size="sm" />
              <Text fontSize="sm" color="gray.600">Syncing...</Text>
            </HStack>
          )}
        </HStack>

        <HStack spacing={2}>
          <Button
            size="sm"
            leftIcon={<RefreshCw size={16} />}
            onClick={handleRefresh}
            variant="outline"
          >
            Refresh
          </Button>
          <Button
            size="sm"
            leftIcon={<Plus size={16} />}
            onClick={onCreateOpen}
            colorScheme="blue"
          >
            Create Issue
          </Button>
        </HStack>
      </Flex>

      {/* Error Alert */}
      {error && (
        <Alert status="error" mb={4}>
          <AlertIcon />
          <Text>{error.message}</Text>
        </Alert>
      )}

      {/* Kanban Board */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <HStack spacing={4} align="start" overflowX="auto" pb={4}>
          {columns.map(column => (
            <Box key={column.id} minW="300px" maxW="300px">
              {/* Column Header */}
              <Card mb={4} bg={cardBg}>
                <CardHeader pb={2}>
                  <HStack justify="space-between">
                    <HStack>
                      <Text fontWeight="bold">{column.title}</Text>
                      <Badge colorScheme={column.color} variant="subtle">
                        {column.issues.length}
                      </Badge>
                    </HStack>
                    <Menu>
                      <MenuButton
                        as={IconButton}
                        icon={<MoreHorizontal size={16} />}
                        size="sm"
                        variant="ghost"
                      />
                      <MenuList>
                        <MenuItem icon={<Settings size={16} />}>
                          Column Settings
                        </MenuItem>
                      </MenuList>
                    </Menu>
                  </HStack>
                </CardHeader>
              </Card>

              {/* Column Content */}
              <Droppable droppableId={column.id}>
                {(provided, snapshot) => (
                  <Box
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    bg={snapshot.isDraggingOver ? 'gray.100' : 'transparent'}
                    borderRadius="md"
                    p={2}
                    minH="400px"
                  >
                    <VStack spacing={3} align="stretch">
                      {column.issues.map((issue, index) => (
                        <Draggable key={issue.id} draggableId={issue.id} index={index}>
                          {(provided, snapshot) => (
                            <Box
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              style={{
                                ...provided.draggableProps.style,
                                opacity: snapshot.isDragging ? 0.8 : 1
                              }}
                            >
                              <IssueCard 
                                issue={issue} 
                                onUpdate={updateIssue}
                              />
                            </Box>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                      
                      {/* Add Issue Button */}
                      <Button
                        variant="ghost"
                        size="sm"
                        leftIcon={<Plus size={16} />}
                        onClick={onCreateOpen}
                        borderStyle="dashed"
                        borderWidth="2px"
                        borderColor="gray.300"
                      >
                        Add Issue
                      </Button>
                    </VStack>
                  </Box>
                )}
              </Droppable>
            </Box>
          ))}
        </HStack>
      </DragDropContext>

      {/* Create Issue Modal */}
      <CreateIssueModal
        isOpen={isCreateOpen}
        onClose={onCreateClose}
        onSubmit={handleCreateIssue}
        projectKey={projectKey}
      />
    </Box>
  );
}
