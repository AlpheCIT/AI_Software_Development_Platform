import React, { useState, useEffect, useCallback } from 'react';
import { 
  Box, VStack, HStack, Text, Button, Badge, Card, CardBody, CardHeader, 
  Heading, Grid, GridItem, Modal, ModalOverlay, ModalContent, ModalHeader, 
  ModalBody, ModalFooter, ModalCloseButton, useDisclosure, FormControl, 
  FormLabel, Input, Textarea, Select, NumberInput, NumberInputField, 
  useToast, Progress, Divider, IconButton, Flex, useColorModeValue, 
  Stat, StatLabel, StatNumber, StatHelpText, Tag, TagLabel, TagLeftIcon, 
  Accordion, AccordionItem, AccordionButton, AccordionPanel, AccordionIcon,
  Container, Alert, AlertIcon, Spinner, Checkbox, Switch, Tooltip, 
  Avatar, AvatarGroup, SimpleGrid, CircularProgress, CircularProgressLabel,
  Tabs, TabList, TabPanels, Tab, TabPanel, Table, Thead, Tbody, Tr, Th, Td,
  Menu, MenuButton, MenuList, MenuItem, MenuDivider, Input as SearchInput,
  InputGroup, InputLeftElement, Breadcrumb, BreadcrumbItem, BreadcrumbLink,
  useBreakpointValue, Skeleton, SkeletonText, Wrap, WrapItem, ButtonGroup
} from '@chakra-ui/react';
import {
  AddIcon, EditIcon, DeleteIcon, CalendarIcon, TimeIcon, ViewIcon, 
  DownloadIcon, RepeatIcon, StarIcon, WarningIcon, CheckCircleIcon, 
  ChevronDownIcon, ChevronUpIcon, ExternalLinkIcon, InfoIcon, 
  CheckIcon, SettingsIcon, SearchIcon, FilterIcon, BellIcon, 
  EmailIcon, AtSignIcon, ChevronRightIcon, DragHandleIcon,
  SunIcon, MoonIcon
} from '@chakra-ui/icons';

// Type definitions
interface TeamMember {
  id: string;
  name: string;
  role: string;
  avatar: string;
  capacity: number;
  skills: string[];
}

interface UserStory {
  id: string;
  title: string;
  description: string;
  priority: 'Critical' | 'High' | 'Medium' | 'Low';
  story_points: number;
  component: string;
  assignee: string;
  acceptance_criteria: string[];
  technical_notes: string;
  dependencies: string[];
  created: string;
  estimated_hours: number;
  status: string;
  tags: string[];
  risk_level: 'low' | 'medium' | 'high';
  business_value: 'low' | 'medium' | 'high' | 'critical';
  jira_key?: string;
  jira_sync_status?: 'not_synced' | 'synced' | 'conflict';
  sync_conflicts?: SyncConflict[];
}

interface SyncConflict {
  story_id: string;
  field: string;
  local_value: any;
  jira_value: any;
  timestamp: string;
  resolution?: 'local' | 'jira';
}

interface Milestone {
  id: string;
  name: string;
  date: string;
  description: string;
  story_ids: string[];
  status: 'planned' | 'in-progress' | 'completed' | 'at-risk';
  health: 'green' | 'yellow' | 'red';
}

interface KanbanColumn {
  id: string;
  name: string;
  color: string;
  order: number;
  wip_limit?: number;
}

interface ProjectData {
  project_info: {
    name: string;
    description: string;
    start_date: string;
    target_completion: string;
    team_size: number;
    sprint_duration: number;
  };
  team_members: TeamMember[];
  milestones: Milestone[];
  stories: UserStory[];
  board_config: {
    columns: KanbanColumn[];
    priority_colors: Record<string, string>;
    component_colors: Record<string, string>;
  };
}

// Mock project data - in real app this would come from JSON file or API
const mockProjectData: ProjectData = {
  project_info: {
    name: "Dynamic Code Analysis Implementation",
    description: "Advanced AST-based metrics, graph visualization, and real-time analysis dashboard",
    start_date: "2025-08-01",
    target_completion: "2025-09-30",
    team_size: 4,
    sprint_duration: 14
  },
  team_members: [
    {
      id: "backend-dev",
      name: "Backend Developer",
      role: "Senior Backend Developer",
      avatar: "👨‍💻",
      capacity: 40,
      skills: ["Node.js", "Python", "API Design", "Database"]
    },
    {
      id: "frontend-dev", 
      name: "Frontend Developer",
      role: "Senior Frontend Developer",
      avatar: "👩‍💻",
      capacity: 40,
      skills: ["React", "TypeScript", "UI/UX", "D3.js"]
    },
    {
      id: "data-engineer",
      name: "Data Engineer",
      role: "Senior Data Engineer", 
      avatar: "📊",
      capacity: 40,
      skills: ["ArangoDB", "Analytics", "Graph Algorithms", "ML"]
    },
    {
      id: "devops",
      name: "DevOps Engineer",
      role: "DevOps Engineer",
      avatar: "🚀", 
      capacity: 35,
      skills: ["CI/CD", "Docker", "AWS", "Monitoring"]
    }
  ],
  milestones: [
    {
      id: "milestone-1",
      name: "Infrastructure Foundation",
      date: "2025-08-15",
      description: "Core parsing and database infrastructure",
      story_ids: ["INFRA-001", "INFRA-002"],
      status: "planned",
      health: "green"
    },
    {
      id: "milestone-2", 
      name: "Core Metrics Engine",
      date: "2025-08-30",
      description: "Dead code detection, complexity analysis",
      story_ids: ["METRIC-001", "METRIC-003", "METRIC-005"],
      status: "planned",
      health: "green"
    },
    {
      id: "milestone-3",
      name: "Interactive Dashboard",
      date: "2025-09-30", 
      description: "Dynamic dashboard with visualizations",
      story_ids: ["UI-001", "UI-002", "UI-003"],
      status: "planned",
      health: "yellow"
    }
  ],
  stories: [
    {
      id: "INFRA-001",
      title: "Multi-Language AST Parser Infrastructure",
      description: "Create extensible parser system supporting JavaScript, TypeScript, and Python with unified AST node representation",
      priority: "Critical",
      story_points: 13,
      component: "Backend",
      assignee: "backend-dev",
      acceptance_criteria: [
        "Support parsing .js, .jsx, .ts, .tsx, .py files",
        "Unified AST node structure with type, name, location metadata",
        "Error handling for malformed code",
        "Configurable parsing options per language",
        "Performance: Parse 500+ files in < 30 seconds"
      ],
      technical_notes: "Use @babel/parser for JS/TS, Python ast module via subprocess",
      dependencies: [],
      created: "2025-08-01",
      estimated_hours: 32,
      status: "Backlog",
      tags: ["core", "infrastructure", "parsing"],
      risk_level: "medium",
      business_value: "high",
      jira_key: undefined,
      jira_sync_status: "not_synced"
    },
    {
      id: "INFRA-002",
      title: "ArangoDB Graph Schema Enhancement", 
      description: "Extend database schema to support AST nodes, semantic relationships, and cross-file dependencies",
      priority: "Critical",
      story_points: 8,
      component: "Database",
      assignee: "data-engineer",
      acceptance_criteria: [
        "ast_nodes collection with optimized indexes",
        "relationships edge collection for semantic connections", 
        "Support for structural, semantic, and dependency edges",
        "Graph traversal performance < 100ms for typical queries",
        "Migration scripts for existing data"
      ],
      technical_notes: "Indexes on type, file_path, name. Edge types: contains, calls, references, imports",
      dependencies: [],
      created: "2025-08-01",
      estimated_hours: 20,
      status: "Backlog",
      tags: ["database", "schema", "performance"],
      risk_level: "low",
      business_value: "high",
      jira_key: undefined,
      jira_sync_status: "not_synced"
    },
    {
      id: "METRIC-001",
      title: "Dead Code Detection Engine",
      description: "Implement graph-based dead code detection for orphaned functions, unused variables, and unused imports",
      priority: "High",
      story_points: 8,
      component: "Analytics",
      assignee: "data-engineer",
      acceptance_criteria: [
        "Detect functions with zero incoming call edges",
        "Identify variables declared but never referenced",
        "Find import statements with no usage",
        "Calculate dead code percentage per file/project",
        "Exclude entry points (main, exported functions)"
      ],
      technical_notes: "AQL queries for graph traversal, consider entry points and exports",
      dependencies: ["INFRA-001", "INFRA-002"],
      created: "2025-08-01",
      estimated_hours: 18,
      status: "Backlog",
      tags: ["analytics", "quality", "optimization"],
      risk_level: "medium",
      business_value: "high",
      jira_key: undefined,
      jira_sync_status: "not_synced"
    },
    {
      id: "UI-001",
      title: "Dynamic Metrics Dashboard",
      description: "Create React-based dashboard with health indicators and interactive visualizations",
      priority: "High",
      story_points: 13,
      component: "Frontend",
      assignee: "frontend-dev",
      acceptance_criteria: [
        "Responsive grid layout with metric cards",
        "Health status indicators with color coding",
        "Interactive section navigation",
        "Real-time metric updates",
        "Export functionality for reports"
      ],
      technical_notes: "Use Chakra UI components, threshold-based color coding",
      dependencies: ["METRIC-001"],
      created: "2025-08-01",
      estimated_hours: 28,
      status: "In Progress",
      tags: ["ui", "dashboard", "visualization"],
      risk_level: "medium",
      business_value: "high",
      jira_key: "PROJ-101",
      jira_sync_status: "synced"
    }
  ],
  board_config: {
    columns: [
      { id: "backlog", name: "Backlog", color: "blue", order: 0, wip_limit: undefined },
      { id: "in-progress", name: "In Progress", color: "orange", order: 1, wip_limit: 6 },
      { id: "in-review", name: "In Review", color: "purple", order: 2, wip_limit: 4 },
      { id: "done", name: "Done", color: "green", order: 3, wip_limit: undefined }
    ],
    priority_colors: {
      "Critical": "red",
      "High": "orange", 
      "Medium": "yellow",
      "Low": "green"
    },
    component_colors: {
      "Backend": "blue",
      "Frontend": "purple",
      "Database": "teal",
      "Analytics": "cyan",
      "DevOps": "pink"
    }
  }
};

// Utility functions
const getPriorityColor = (priority: string): string => {
  const colors = {
    'Critical': 'red',
    'High': 'orange',
    'Medium': 'yellow',
    'Low': 'green'
  };
  return colors[priority as keyof typeof colors] || 'gray';
};

const getComponentColor = (component: string): string => {
  const colors = {
    'Backend': 'blue',
    'Frontend': 'purple',
    'Database': 'teal',
    'Analytics': 'cyan',
    'DevOps': 'pink'
  };
  return colors[component as keyof typeof colors] || 'gray';
};

const getRiskColor = (risk: string): string => {
  const colors = {
    'low': 'green',
    'medium': 'yellow',
    'high': 'red'
  };
  return colors[risk as keyof typeof colors] || 'gray';
};

const getBusinessValueColor = (value: string): string => {
  const colors = {
    'low': 'gray',
    'medium': 'blue',
    'high': 'purple',
    'critical': 'red'
  };
  return colors[value as keyof typeof colors] || 'gray';
};

// Enhanced Story Card Component
const EnhancedStoryCard: React.FC<{
  story: UserStory;
  onMove: (storyId: string, toColumn: string) => void;
  currentColumn: string;
  isSelected: boolean;
  onSelectionChange: (storyId: string, isSelected: boolean) => void;
  onEdit: (story: UserStory) => void;
  teamMembers: TeamMember[];
  viewMode: 'compact' | 'detailed';
}> = ({ 
  story, 
  onMove, 
  currentColumn, 
  isSelected, 
  onSelectionChange, 
  onEdit,
  teamMembers,
  viewMode 
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const assignee = teamMembers.find(m => m.id === story.assignee);
  
  const getSyncStatusBadge = () => {
    if (story.jira_key) {
      switch (story.jira_sync_status) {
        case 'synced':
          return (
            <Tooltip label={`Synced with Jira: ${story.jira_key}`}>
              <Badge colorScheme="green" variant="subtle" size="sm">
                <HStack spacing={1}>
                  <CheckCircleIcon boxSize="2" />
                  <Text fontSize="xs">Synced</Text>
                </HStack>
              </Badge>
            </Tooltip>
          );
        case 'conflict':
          return (
            <Tooltip label="Has sync conflicts">
              <Badge colorScheme="red" variant="subtle" size="sm">
                <HStack spacing={1}>
                  <WarningIcon boxSize="2" />
                  <Text fontSize="xs">Conflict</Text>
                </HStack>
              </Badge>
            </Tooltip>
          );
        default:
          return (
            <Tooltip label="Not synced with Jira">
              <Badge colorScheme="gray" variant="subtle" size="sm">
                <Text fontSize="xs">Local</Text>
              </Badge>
            </Tooltip>
          );
      }
    }
    return null;
  };

  return (
    <Card 
      mb={3} 
      variant="outline" 
      _hover={{ shadow: 'lg', transform: 'translateY(-2px)' }}
      transition="all 0.2s"
      borderColor={isSelected ? 'blue.500' : undefined}
      borderWidth={isSelected ? '2px' : '1px'}
      borderLeftColor={`${getPriorityColor(story.priority)}.400`}
      borderLeftWidth="4px"
      opacity={isDragging ? 0.7 : 1}
      cursor="pointer"
      bg={useColorModeValue('white', 'gray.800')}
    >
      <CardHeader pb={2}>
        <VStack align="start" spacing={2}>
          <HStack justify="space-between" w="full">
            <HStack spacing={2}>
              <Checkbox 
                isChecked={isSelected}
                onChange={(e) => onSelectionChange(story.id, e.target.checked)}
                colorScheme="blue"
                size="sm"
              />
              <Badge colorScheme={getPriorityColor(story.priority)} variant="solid" size="sm">
                {story.priority}
              </Badge>
              <Badge colorScheme={getComponentColor(story.component)} variant="outline" size="sm">
                {story.component}
              </Badge>
              {getSyncStatusBadge()}
            </HStack>
            <Menu>
              <MenuButton
                as={IconButton}
                icon={<DragHandleIcon />}
                variant="ghost"
                size="xs"
                onClick={(e) => e.stopPropagation()}
              />
              <MenuList>
                <MenuItem icon={<EditIcon />} onClick={() => onEdit(story)}>
                  Edit Story
                </MenuItem>
                <MenuItem icon={<ExternalLinkIcon />}>
                  View in Jira
                </MenuItem>
                <MenuDivider />
                <MenuItem icon={<DeleteIcon />} color="red.500">
                  Delete Story
                </MenuItem>
              </MenuList>
            </Menu>
          </HStack>
          
          <HStack justify="space-between" w="full">
            <Text fontWeight="bold" fontSize="sm" color="blue.600">
              {story.id}
            </Text>
            {story.jira_key && (
              <Text fontSize="xs" color="gray.500">
                {story.jira_key}
              </Text>
            )}
          </HStack>
          
          <Text fontWeight="semibold" fontSize="md" lineHeight="tight" noOfLines={2}>
            {story.title}
          </Text>
        </VStack>
      </CardHeader>
      
      <CardBody pt={0}>
        <VStack align="start" spacing={3}>
          {/* Metrics Row */}
          <HStack justify="space-between" w="full">
            <SimpleGrid columns={3} spacing={4} flex="1">
              <Stat size="sm">
                <StatLabel fontSize="xs">Points</StatLabel>
                <StatNumber fontSize="lg">{story.story_points}</StatNumber>
              </Stat>
              <Stat size="sm">
                <StatLabel fontSize="xs">Hours</StatLabel>
                <StatNumber fontSize="lg">{story.estimated_hours}</StatNumber>
              </Stat>
              <Stat size="sm">
                <StatLabel fontSize="xs">Risk</StatLabel>
                <StatNumber fontSize="sm">
                  <Badge colorScheme={getRiskColor(story.risk_level)} size="sm">
                    {story.risk_level}
                  </Badge>
                </StatNumber>
              </Stat>
            </SimpleGrid>
          </HStack>

          {/* Assignee */}
          <HStack spacing={2}>
            <Text fontSize="xs" color="gray.500">Assignee:</Text>
            <HStack spacing={1}>
              <Text fontSize="sm">{assignee?.avatar}</Text>
              <Text fontSize="sm" fontWeight="medium">{assignee?.name || story.assignee}</Text>
            </HStack>
          </HStack>

          {/* Tags */}
          <Wrap spacing={1}>
            {story.tags.slice(0, 3).map((tag, idx) => (
              <WrapItem key={idx}>
                <Tag size="sm" colorScheme="gray" variant="subtle">
                  {tag}
                </Tag>
              </WrapItem>
            ))}
            {story.tags.length > 3 && (
              <WrapItem>
                <Tag size="sm" colorScheme="gray" variant="outline">
                  +{story.tags.length - 3}
                </Tag>
              </WrapItem>
            )}
          </Wrap>
          
          {/* Description */}
          <Text fontSize="sm" color="gray.600" noOfLines={viewMode === 'compact' ? 2 : undefined}>
            {story.description}
          </Text>
          
          {viewMode === 'detailed' && (
            <Button 
              size="xs" 
              variant="link" 
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
              leftIcon={<InfoIcon />}
            >
              {isExpanded ? 'Show Less' : 'Show More'}
            </Button>
          )}
          
          {/* Expanded Details */}
          {isExpanded && viewMode === 'detailed' && (
            <VStack align="start" spacing={3} w="full">
              {story.acceptance_criteria.length > 0 && (
                <Box>
                  <Text fontWeight="semibold" fontSize="sm" mb={1}>Acceptance Criteria:</Text>
                  <VStack align="start" spacing={1}>
                    {story.acceptance_criteria.map((criteria, idx) => (
                      <HStack key={idx} spacing={2} align="start">
                        <CheckIcon color="green.500" boxSize="3" mt="1" />
                        <Text fontSize="xs" color="gray.600">{criteria}</Text>
                      </HStack>
                    ))}
                  </VStack>
                </Box>
              )}
              
              {story.technical_notes && (
                <Box>
                  <Text fontWeight="semibold" fontSize="sm" mb={1}>Technical Notes:</Text>
                  <Text fontSize="xs" color="gray.600" fontStyle="italic" bg="blue.50" p={2} rounded="md">
                    {story.technical_notes}
                  </Text>
                </Box>
              )}
              
              {story.dependencies.length > 0 && (
                <Box>
                  <Text fontWeight="semibold" fontSize="sm" mb={1}>Dependencies:</Text>
                  <HStack spacing={1} wrap="wrap">
                    {story.dependencies.map((dep, idx) => (
                      <Tag key={idx} size="sm" colorScheme="orange" variant="outline">
                        {dep}
                      </Tag>
                    ))}
                  </HStack>
                </Box>
              )}
            </VStack>
          )}
          
          {/* Action Buttons */}
          {currentColumn !== "Done" && (
            <ButtonGroup size="xs" variant="outline" spacing={1} w="full">
              {currentColumn !== "In Progress" && (
                <Button 
                  colorScheme="blue" 
                  flex="1"
                  onClick={(e) => {
                    e.stopPropagation();
                    onMove(story.id, "In Progress");
                  }}
                >
                  Start
                </Button>
              )}
              {currentColumn !== "In Review" && (
                <Button 
                  colorScheme="orange" 
                  flex="1"
                  onClick={(e) => {
                    e.stopPropagation();
                    onMove(story.id, "In Review");
                  }}
                >
                  Review
                </Button>
              )}
              <Button 
                colorScheme="green" 
                flex="1"
                onClick={(e) => {
                  e.stopPropagation();
                  onMove(story.id, "Done");
                }}
              >
                Done
              </Button>
            </ButtonGroup>
          )}
        </VStack>
      </CardBody>
    </Card>
  );
};

// Enhanced Kanban Column Component
const EnhancedKanbanColumn: React.FC<{
  column: KanbanColumn;
  stories: UserStory[];
  onMove: (storyId: string, toColumn: string) => void;
  selectedStories: Set<string>;
  onSelectionChange: (storyId: string, isSelected: boolean) => void;
  onEdit: (story: UserStory) => void;
  teamMembers: TeamMember[];
  viewMode: 'compact' | 'detailed';
}> = ({ 
  column, 
  stories, 
  onMove, 
  selectedStories, 
  onSelectionChange, 
  onEdit, 
  teamMembers,
  viewMode 
}) => {
  const totalPoints = stories.reduce((sum, story) => sum + story.story_points, 0);
  const isOverWipLimit = column.wip_limit && stories.length > column.wip_limit;
  
  const priorityBreakdown = stories.reduce((acc, story) => {
    acc[story.priority] = (acc[story.priority] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <Box>
      <VStack align="start" spacing={4}>
        <Box w="full">
          <HStack justify="space-between" mb={2}>
            <HStack spacing={2}>
              <Heading size="md" color={`${column.color}.600`}>
                {column.name}
              </Heading>
              <Badge 
                colorScheme={isOverWipLimit ? 'red' : column.color} 
                variant={isOverWipLimit ? 'solid' : 'outline'}
              >
                {stories.length}
                {column.wip_limit && ` / ${column.wip_limit}`}
              </Badge>
            </HStack>
            {isOverWipLimit && (
              <Tooltip label="WIP limit exceeded">
                <WarningIcon color="red.500" />
              </Tooltip>
            )}
          </HStack>
          
          <VStack align="start" spacing={1}>
            <Text fontSize="sm" color="gray.600">
              {totalPoints} story points
            </Text>
            
            {/* Priority breakdown */}
            <HStack spacing={1} wrap="wrap">
              {Object.entries(priorityBreakdown).map(([priority, count]) => (
                <Tag key={priority} size="sm" colorScheme={getPriorityColor(priority)} variant="subtle">
                  {priority}: {count}
                </Tag>
              ))}
            </HStack>
          </VStack>
        </Box>
        
        <Box w="full" maxH="70vh" overflowY="auto" pr={2}>
          {stories.length === 0 ? (
            <Box 
              p={8} 
              textAlign="center" 
              color="gray.400"
              border="2px dashed"
              borderColor="gray.200"
              borderRadius="md"
            >
              <Text fontSize="sm">No stories in {column.name}</Text>
            </Box>
          ) : (
            stories.map((story) => (
              <EnhancedStoryCard 
                key={story.id} 
                story={story} 
                onMove={onMove}
                currentColumn={column.name}
                isSelected={selectedStories.has(story.id)}
                onSelectionChange={onSelectionChange}
                onEdit={onEdit}
                teamMembers={teamMembers}
                viewMode={viewMode}
              />
            ))
          )}
        </Box>
      </VStack>
    </Box>
  );
};

// Team Overview Component
const TeamOverview: React.FC<{ teamMembers: TeamMember[]; stories: UserStory[] }> = ({ 
  teamMembers, 
  stories 
}) => {
  const getTeamMemberWorkload = (memberId: string) => {
    const memberStories = stories.filter(s => s.assignee === memberId && s.status !== 'Done');
    const totalPoints = memberStories.reduce((sum, s) => sum + s.story_points, 0);
    const member = teamMembers.find(m => m.id === memberId);
    return {
      stories: memberStories.length,
      points: totalPoints,
      capacity: member?.capacity || 0,
      utilization: member ? (totalPoints / member.capacity) * 100 : 0
    };
  };

  return (
    <SimpleGrid columns={useBreakpointValue({ base: 1, md: 2, lg: 4 })} spacing={4}>
      {teamMembers.map((member) => {
        const workload = getTeamMemberWorkload(member.id);
        return (
          <Card key={member.id} variant="outline">
            <CardBody>
              <VStack spacing={3}>
                <HStack spacing={3}>
                  <Text fontSize="2xl">{member.avatar}</Text>
                  <VStack align="start" spacing={0}>
                    <Text fontWeight="bold" fontSize="sm">{member.name}</Text>
                    <Text fontSize="xs" color="gray.500">{member.role}</Text>
                  </VStack>
                </HStack>
                
                <CircularProgress 
                  value={workload.utilization} 
                  color={workload.utilization > 100 ? 'red.400' : workload.utilization > 80 ? 'orange.400' : 'green.400'}
                  size="80px"
                >
                  <CircularProgressLabel fontSize="xs">
                    {Math.round(workload.utilization)}%
                  </CircularProgressLabel>
                </CircularProgress>
                
                <VStack spacing={1}>
                  <Text fontSize="sm">
                    <Text as="span" fontWeight="bold">{workload.stories}</Text> stories
                  </Text>
                  <Text fontSize="sm">
                    <Text as="span" fontWeight="bold">{workload.points}</Text> / {member.capacity} pts
                  </Text>
                </VStack>
                
                <Wrap spacing={1}>
                  {member.skills.slice(0, 3).map((skill, idx) => (
                    <WrapItem key={idx}>
                      <Tag size="xs" colorScheme="blue" variant="subtle">{skill}</Tag>
                    </WrapItem>
                  ))}
                </Wrap>
              </VStack>
            </CardBody>
          </Card>
        );
      })}
    </SimpleGrid>
  );
};

// Main Enhanced Project Management Component
export const EnhancedProjectManagement: React.FC = () => {
  // State management
  const [projectData, setProjectData] = useState<ProjectData>(mockProjectData);
  const [kanbanData, setKanbanData] = useState<Record<string, UserStory[]>>({});
  const [selectedStories, setSelectedStories] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState(0);
  const [viewMode, setViewMode] = useState<'compact' | 'detailed'>('compact');
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    priority: [] as string[],
    component: [] as string[],
    assignee: [] as string[],
    tags: [] as string[]
  });
  
  // Loading and sync states
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [autoSync, setAutoSync] = useState(false);
  const [conflicts, setConflicts] = useState<SyncConflict[]>([]);
  
  // Modal states
  const { isOpen: isJiraOpen, onOpen: onJiraOpen, onClose: onJiraClose } = useDisclosure();
  const { isOpen: isConflictOpen, onOpen: onConflictOpen, onClose: onConflictClose } = useDisclosure();
  const { isOpen: isStoryOpen, onOpen: onStoryOpen, onClose: onStoryClose } = useDisclosure();
  const { isOpen: isSettingsOpen, onOpen: onSettingsOpen, onClose: onSettingsClose } = useDisclosure();
  
  // Form states
  const [editingStory, setEditingStory] = useState<UserStory | null>(null);
  const [jiraConfig, setJiraConfig] = useState({
    project: 'CODEANALYSIS',
    issueType: 'Story',
    priority: 'Medium',
    assignee: '',
    labels: 'code-analysis,technical-debt'
  });
  
  const toast = useToast();
  const bg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');

  // Initialize kanban data from project stories
  useEffect(() => {
    const organized = projectData.board_config.columns.reduce((acc, column) => {
      acc[column.name] = projectData.stories.filter(story => story.status === column.name);
      return acc;
    }, {} as Record<string, UserStory[]>);
    setKanbanData(organized);
  }, [projectData]);

  // Filtering logic
  const filteredStories = useCallback(() => {
    return Object.values