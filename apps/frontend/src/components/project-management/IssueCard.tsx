/**
 * Issue Card Component
 * Individual Jira issue card for the Kanban board
 */

import React, { useState } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Badge,
  Card,
  CardBody,
  Avatar,
  IconButton,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  useColorModeValue,
  Tooltip,
  Link,
  useDisclosure,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  ModalFooter,
  Button,
  FormControl,
  FormLabel,
  Input,
  Textarea,
  Select
} from '@chakra-ui/react';
import {
  MoreHorizontal,
  Edit,
  Trash2,
  ExternalLink,
  Clock,
  User,
  AlertTriangle,
  CheckCircle,
  Circle,
  Zap
} from 'lucide-react';
import { format } from 'date-fns';

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

interface IssueCardProps {
  issue: JiraIssue;
  onUpdate: (issueId: string, updates: Partial<JiraIssue>) => Promise<void>;
}

export default function IssueCard({ issue, onUpdate }: IssueCardProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const { isOpen: isEditOpen, onOpen: onEditOpen, onClose: onEditClose } = useDisclosure();
  
  const cardBg = useColorModeValue('white', 'gray.700');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const textColor = useColorModeValue('gray.800', 'white');

  const getIssueTypeIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'bug':
        return <AlertTriangle size={16} color="red" />;
      case 'story':
        return <Circle size={16} color="green" />;
      case 'task':
        return <CheckCircle size={16} color="blue" />;
      case 'epic':
        return <Zap size={16} color="purple" />;
      default:
        return <Circle size={16} color="gray" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'highest':
      case 'high':
        return 'red';
      case 'medium':
        return 'orange';
      case 'low':
      case 'lowest':
        return 'green';
      default:
        return 'gray';
    }
  };

  const handleQuickEdit = async (field: string, value: string) => {
    setIsUpdating(true);
    try {
      await onUpdate(issue.id, { [field]: value });
    } catch (error) {
      console.error('Failed to update issue:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const jiraUrl = `https://your-domain.atlassian.net/browse/${issue.key}`;

  return (
    <>
      <Card
        bg={cardBg}
        borderColor={borderColor}
        borderWidth="1px"
        _hover={{ 
          borderColor: 'blue.300',
          transform: 'translateY(-1px)',
          boxShadow: 'md'
        }}
        transition="all 0.2s"
        cursor="grab"
        _active={{ cursor: 'grabbing' }}
      >
        <CardBody p={4}>
          <VStack align="stretch" spacing={3}>
            {/* Header */}
            <HStack justify="space-between" align="start">
              <HStack spacing={2}>
                {getIssueTypeIcon(issue.issueType.name)}
                <Text 
                  fontSize="xs" 
                  fontWeight="bold" 
                  color="blue.500"
                  textTransform="uppercase"
                >
                  {issue.key}
                </Text>
              </HStack>
              
              <Menu size="sm">
                <MenuButton
                  as={IconButton}
                  icon={<MoreHorizontal size={14} />}
                  size="xs"
                  variant="ghost"
                  isLoading={isUpdating}
                />
                <MenuList fontSize="sm">
                  <MenuItem 
                    icon={<Edit size={14} />}
                    onClick={onEditOpen}
                  >
                    Edit
                  </MenuItem>
                  <MenuItem 
                    icon={<ExternalLink size={14} />}
                    as={Link}
                    href={jiraUrl}
                    isExternal
                  >
                    Open in Jira
                  </MenuItem>
                </MenuList>
              </Menu>
            </HStack>

            {/* Summary */}
            <Text 
              fontSize="sm" 
              fontWeight="medium" 
              color={textColor}
              lineHeight="1.4"
              noOfLines={3}
            >
              {issue.summary}
            </Text>

            {/* Labels */}
            {issue.labels && issue.labels.length > 0 && (
              <HStack spacing={1} flexWrap="wrap">
                {issue.labels.slice(0, 3).map((label, index) => (
                  <Badge 
                    key={index}
                    size="sm" 
                    colorScheme="gray" 
                    variant="subtle"
                    fontSize="xs"
                  >
                    {label}
                  </Badge>
                ))}
                {issue.labels.length > 3 && (
                  <Badge size="sm" colorScheme="gray" variant="outline">
                    +{issue.labels.length - 3}
                  </Badge>
                )}
              </HStack>
            )}

            {/* Footer */}
            <HStack justify="space-between" align="center">
              <HStack spacing={2}>
                {/* Priority */}
                <Tooltip label={`Priority: ${issue.priority.name}`}>
                  <Badge 
                    size="sm" 
                    colorScheme={getPriorityColor(issue.priority.name)}
                    variant="subtle"
                  >
                    {issue.priority.name.charAt(0)}
                  </Badge>
                </Tooltip>

                {/* Story Points */}
                {issue.storyPoints && (
                  <Tooltip label={`Story Points: ${issue.storyPoints}`}>
                    <Badge size="sm" colorScheme="purple" variant="outline">
                      {issue.storyPoints}SP
                    </Badge>
                  </Tooltip>
                )}

                {/* Updated Time */}
                <Tooltip label={`Updated: ${format(new Date(issue.updated), 'MMM d, yyyy h:mm a')}`}>
                  <HStack spacing={1}>
                    <Clock size={12} />
                    <Text fontSize="xs" color="gray.500">
                      {format(new Date(issue.updated), 'MMM d')}
                    </Text>
                  </HStack>
                </Tooltip>
              </HStack>

              {/* Assignee */}
              {issue.assignee ? (
                <Tooltip label={issue.assignee.displayName}>
                  <Avatar 
                    size="xs" 
                    name={issue.assignee.displayName}
                    src={issue.assignee.avatarUrls['24x24']}
                  />
                </Tooltip>
              ) : (
                <Tooltip label="Unassigned">
                  <Box
                    w={6}
                    h={6}
                    borderRadius="full"
                    border="2px dashed"
                    borderColor="gray.300"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                  >
                    <User size={12} color="gray" />
                  </Box>
                </Tooltip>
              )}
            </HStack>
          </VStack>
        </CardBody>
      </Card>

      {/* Edit Modal */}
      <Modal isOpen={isEditOpen} onClose={onEditClose} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Edit Issue - {issue.key}</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4}>
              <FormControl>
                <FormLabel>Summary</FormLabel>
                <Input defaultValue={issue.summary} />
              </FormControl>
              
              <FormControl>
                <FormLabel>Description</FormLabel>
                <Textarea 
                  defaultValue={issue.description || ''} 
                  rows={4}
                  placeholder="Add a description..."
                />
              </FormControl>

              <HStack spacing={4} width="100%">
                <FormControl>
                  <FormLabel>Priority</FormLabel>
                  <Select defaultValue={issue.priority.name}>
                    <option value="Highest">Highest</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                    <option value="Lowest">Lowest</option>
                  </Select>
                </FormControl>

                <FormControl>
                  <FormLabel>Story Points</FormLabel>
                  <Input 
                    type="number" 
                    defaultValue={issue.storyPoints || ''}
                    placeholder="0"
                    min="0"
                    max="100"
                  />
                </FormControl>
              </HStack>
            </VStack>
          </ModalBody>
          
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onEditClose}>
              Cancel
            </Button>
            <Button colorScheme="blue" isLoading={isUpdating}>
              Update Issue
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
