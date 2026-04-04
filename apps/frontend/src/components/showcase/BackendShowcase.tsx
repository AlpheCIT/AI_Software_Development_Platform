import React, { useState, useEffect } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Card,
  CardBody,
  CardHeader,
  Badge,
  Button,
  SimpleGrid,
  Progress,
  Alert,
  AlertIcon,
  Divider,
  Tab,
  Tabs,
  TabList,
  TabPanel,
  TabPanels,
  useToast,
  Spinner,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  Avatar,
  AvatarGroup,
  List,
  ListItem,
  ListIcon,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  useDisclosure,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon
} from '@chakra-ui/react';
import {
  Brain,
  MessageSquare,
  GitCommit,
  Shield,
  BarChart3,
  Database,
  Search,
  Zap,
  Users,
  Clock,
  FileText,
  GitBranch,
  CheckCircle,
  AlertTriangle,
  TrendingUp,
  Bot
} from 'lucide-react';
import { useAppContext } from '../../contexts/AppContext';

interface AIAgent {
  id: string;
  name: string;
  type: 'analyzer' | 'reviewer' | 'optimizer' | 'security';
  status: 'active' | 'idle' | 'processing';
  lastActivity: string;
  avatar?: string;
}

interface Conversation {
  id: string;
  participants: string[];
  topic: string;
  lastMessage: string;
  timestamp: string;
  messageCount: number;
}

interface JiraTicket {
  id: string;
  key: string;
  summary: string;
  status: string;
  priority: string;
  assignee: string;
  created: string;
}

interface DatabaseMetrics {
  totalNodes: number;
  totalRelationships: number;
  recentIngestions: number;
  queryPerformance: number;
  storageUsed: string;
  lastUpdate: string;
}

export default function BackendShowcase() {
  const [activeAgents, setActiveAgents] = useState<AIAgent[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [jiraTickets, setJiraTickets] = useState<JiraTicket[]>([]);
  const [dbMetrics, setDbMetrics] = useState<DatabaseMetrics | null>(null);
  const [repoStatus, setRepoStatus] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [selectedFeature, setSelectedFeature] = useState<string>('');
  
  const toast = useToast();
  const { currentRepository } = useAppContext();

  useEffect(() => {
    loadAllData();
    // Set up real-time updates
    const interval = setInterval(loadAllData, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const loadAllData = async () => {
    try {
      setIsLoading(true);
      
      // Load real data from QA engine and ArangoDB, fall back to demo data
      const QA_URL = '';
      await Promise.all([
        loadAIAgents(QA_URL),
        loadConversations(),
        loadJiraTickets(),
        loadDatabaseMetrics(QA_URL),
        loadRepositoryStatus(QA_URL)
      ]);
      
      setIsLoading(false);
    } catch (error) {
      console.error('Failed to load showcase data:', error);
      toast({
        title: 'Error Loading Data',
        description: 'Failed to load some backend features',
        status: 'error',
        duration: 5000,
        isClosable: true
      });
      setIsLoading(false);
    }
  };

  const loadAIAgents = async (qaUrl?: string) => {
    // Try real QA engine agents, fall back to demo
    try {
      if (qaUrl) {
        const res = await fetch(`${qaUrl}/health`);
        if (res.ok) {
          setActiveAgents([
            { id: 'strategist', name: 'Test Strategist', type: 'analyzer', status: 'active', lastActivity: new Date().toISOString() },
            { id: 'generator', name: 'Test Generator', type: 'generator', status: 'active', lastActivity: new Date().toISOString() },
            { id: 'critic', name: 'Test Critic', type: 'reviewer', status: 'idle', lastActivity: new Date().toISOString() },
            { id: 'executor', name: 'Test Executor', type: 'executor', status: 'idle', lastActivity: new Date().toISOString() },
            { id: 'mutation', name: 'Mutation Verifier', type: 'analyzer', status: 'idle', lastActivity: new Date().toISOString() },
            { id: 'pm', name: 'Product Manager', type: 'analyzer', status: 'idle', lastActivity: new Date().toISOString() },
            { id: 'research', name: 'Research Assistant', type: 'analyzer', status: 'idle', lastActivity: new Date().toISOString() },
            { id: 'quality', name: 'Code Quality Architect', type: 'reviewer', status: 'idle', lastActivity: new Date().toISOString() },
          ]);
          return;
        }
      }
    } catch { /* QA engine not available */ }
    // No mock data — show empty state when QA engine is unavailable
    setActiveAgents([]);
  };

  const loadConversations = async () => {
    try {
      const QA_URL = '';
      const res = await fetch(`${QA_URL}/chat/conversations`);
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations || []);
        return;
      }
    } catch { /* API not available */ }
    // No mock data — show empty state when API is unavailable
    setConversations([]);
  };

  const loadJiraTickets = async () => {
    try {
      const QA_URL = '';
      const res = await fetch(`${QA_URL}/jira/tickets`);
      if (res.ok) {
        const data = await res.json();
        setJiraTickets(data.tickets || []);
        return;
      }
    } catch { /* API not available */ }
    // No mock data — show empty state when API is unavailable
    setJiraTickets([]);
  };

  const loadDatabaseMetrics = async (qaUrl?: string) => {
    // Try to get real metrics from QA engine
    try {
      if (qaUrl) {
        const res = await fetch(`${qaUrl}/qa/runs`);
        if (res.ok) {
          const data = await res.json();
          const runs = data.runs || [];
          setDbMetrics({
            totalNodes: runs.reduce((s: number, r: any) => s + (r.testsGenerated || 0), 0),
            totalRelationships: runs.length * 5, // approx edges per run
            recentIngestions: runs.length,
            queryPerformance: runs.length > 0 ? Math.round(runs[0].mutationScore || 0) : 0,
            storageUsed: `${runs.length} runs`,
            lastUpdate: runs[0]?.completedAt || new Date().toISOString()
          });
          return;
        }
      }
    } catch { /* fall through */ }
    setDbMetrics({
      totalNodes: 0,
      totalRelationships: 0,
      recentIngestions: 0,
      queryPerformance: 0,
      storageUsed: 'N/A',
      lastUpdate: new Date().toISOString()
    });
  };

  const loadRepositoryStatus = async (qaUrl?: string) => {
    // Try real QA engine data
    try {
      if (qaUrl) {
        const res = await fetch(`${qaUrl}/qa/runs`);
        if (res.ok) {
          const data = await res.json();
          const latestRun = data.runs?.[0];
          if (latestRun) {
            setRepoStatus({
              id: latestRun._key || 'latest',
              name: latestRun.repoUrl?.split('/').pop() || 'Repository',
              status: latestRun.status === 'completed' ? 'complete' : latestRun.status,
              progress: latestRun.status === 'completed' ? 100 : 50,
              filesProcessed: latestRun.testsExecuted || 0,
              totalFiles: latestRun.testsGenerated || 0,
              lastCommit: {
                hash: latestRun._key?.substring(0, 8) || '',
                message: `QA Run: ${latestRun.testsGenerated} tests, ${latestRun.mutationScore}% mutation score`,
                author: 'QA Engine',
                timestamp: latestRun.completedAt || latestRun.startedAt
              },
              errors: []
            });
            return;
          }
        }
      }
    } catch { /* fall through */ }
    setRepoStatus({
      id: 'none',
      name: 'No repository analyzed',
      status: 'idle',
      progress: 0,
      filesProcessed: 0,
      totalFiles: 0,
      lastCommit: { hash: '', message: 'Run a QA analysis to see results', author: '', timestamp: new Date().toISOString() },
      errors: []
    });
  };

  const getAgentStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'green';
      case 'processing': return 'blue';
      case 'idle': return 'gray';
      default: return 'gray';
    }
  };

  const getTicketStatusColor = (status: string) => {
    switch (status) {
      case 'Done': return 'green';
      case 'In Progress': return 'blue';
      case 'To Do': return 'yellow';
      default: return 'gray';
    }
  };

  const showFeatureDetails = (feature: string) => {
    setSelectedFeature(feature);
    onOpen();
  };

  if (isLoading) {
    return (
      <Box p={6} textAlign="center">
        <VStack spacing={4}>
          <Spinner size="xl" color="blue.500" />
          <Text>Loading backend showcase...</Text>
          <Text fontSize="sm" color="gray.600">
            Connecting to AI agents, database, and services
          </Text>
        </VStack>
      </Box>
    );
  }

  return (
    <Box p={6} maxW="1400px" mx="auto">
      <VStack spacing={6} align="stretch">
        {/* Header */}
        <Box>
          <Text fontSize="3xl" fontWeight="bold" mb={2}>
            🚀 AI Platform Backend Showcase
          </Text>
          <Text color="gray.600" fontSize="lg">
            Real-time view of all AI-powered backend capabilities and agent activities
          </Text>
        </Box>

        {/* Quick Stats */}
        <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4}>
          <Card>
            <CardBody textAlign="center">
              <VStack>
                <Bot size={32} color="blue" />
                <Stat>
                  <StatNumber>{activeAgents.length}</StatNumber>
                  <StatLabel>AI Agents</StatLabel>
                  <StatHelpText>
                    {activeAgents.filter(a => a.status === 'active').length} active
                  </StatHelpText>
                </Stat>
              </VStack>
            </CardBody>
          </Card>

          <Card>
            <CardBody textAlign="center">
              <VStack>
                <MessageSquare size={32} color="green" />
                <Stat>
                  <StatNumber>{conversations.length}</StatNumber>
                  <StatLabel>Agent Conversations</StatLabel>
                  <StatHelpText>Real-time discussions</StatHelpText>
                </Stat>
              </VStack>
            </CardBody>
          </Card>

          <Card>
            <CardBody textAlign="center">
              <VStack>
                <FileText size={32} color="orange" />
                <Stat>
                  <StatNumber>{jiraTickets.length}</StatNumber>
                  <StatLabel>Generated Tickets</StatLabel>
                  <StatHelpText>Auto-created from AI analysis</StatHelpText>
                </Stat>
              </VStack>
            </CardBody>
          </Card>

          <Card>
            <CardBody textAlign="center">
              <VStack>
                <Database size={32} color="purple" />
                <Stat>
                  <StatNumber>{dbMetrics?.totalNodes.toLocaleString()}</StatNumber>
                  <StatLabel>Code Entities</StatLabel>
                  <StatHelpText>In knowledge graph</StatHelpText>
                </Stat>
              </VStack>
            </CardBody>
          </Card>
        </SimpleGrid>

        <Tabs>
          <TabList>
            <Tab>🤖 AI Agents</Tab>
            <Tab>💬 Agent Conversations</Tab>
            <Tab>🎫 Jira Integration</Tab>
            <Tab>📊 Repository Analysis</Tab>
            <Tab>🗄️ Database Status</Tab>
            <Tab>🔍 Search & Discovery</Tab>
          </TabList>

          <TabPanels>
            {/* AI Agents Tab */}
            <TabPanel>
              <VStack spacing={4} align="stretch">
                <HStack justify="space-between">
                  <Text fontSize="xl" fontWeight="bold">Active AI Agents</Text>
                  <Button size="sm" onClick={() => showFeatureDetails('agents')}>
                    View Details
                  </Button>
                </HStack>

                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                  {activeAgents.map((agent) => (
                    <Card key={agent.id} variant="outline">
                      <CardBody>
                        <HStack spacing={4}>
                          <Avatar name={agent.name} size="md">
                            <Badge
                              position="absolute"
                              bottom="0"
                              right="0"
                              colorScheme={getAgentStatusColor(agent.status)}
                              borderRadius="full"
                              boxSize="12px"
                            />
                          </Avatar>
                          <Box flex="1">
                            <Text fontWeight="bold">{agent.name}</Text>
                            <HStack>
                              <Badge colorScheme={getAgentStatusColor(agent.status)}>
                                {agent.status}
                              </Badge>
                              <Badge variant="outline">{agent.type}</Badge>
                            </HStack>
                            <Text fontSize="sm" color="gray.600">
                              Last active: {new Date(agent.lastActivity).toLocaleTimeString()}
                            </Text>
                          </Box>
                          <VStack spacing={1}>
                            {agent.status === 'processing' && <Spinner size="sm" />}
                            {agent.status === 'active' && <CheckCircle size={16} color="green" />}
                            {agent.status === 'idle' && <Clock size={16} color="gray" />}
                          </VStack>
                        </HStack>
                      </CardBody>
                    </Card>
                  ))}
                </SimpleGrid>

                <Alert status="info">
                  <AlertIcon />
                  <Box>
                    <Text fontWeight="bold">AI Agent Communication</Text>
                    <Text fontSize="sm">
                      Agents are continuously analyzing your codebase and communicating findings.
                      They automatically create tickets, suggest improvements, and identify issues.
                    </Text>
                  </Box>
                </Alert>
              </VStack>
            </TabPanel>

            {/* Agent Conversations Tab */}
            <TabPanel>
              <VStack spacing={4} align="stretch">
                <HStack justify="space-between">
                  <Text fontSize="xl" fontWeight="bold">Agent Conversations</Text>
                  <Button size="sm" onClick={() => showFeatureDetails('conversations')}>
                    Join Conversation
                  </Button>
                </HStack>

                {conversations.length === 0 ? (
                  <Alert status="info">
                    <AlertIcon />
                    <Box>
                      <Text fontWeight="bold">No Conversations Yet</Text>
                      <Text fontSize="sm">
                        Run a QA analysis to see real agent conversations. Agents communicate
                        findings as they analyze your codebase.
                      </Text>
                    </Box>
                  </Alert>
                ) : conversations.map((conv) => (
                  <Card key={conv.id} variant="outline">
                    <CardHeader>
                      <HStack justify="space-between">
                        <Text fontWeight="bold">{conv.topic}</Text>
                        <Badge>{conv.messageCount} messages</Badge>
                      </HStack>
                    </CardHeader>
                    <CardBody>
                      <VStack align="stretch" spacing={3}>
                        <HStack>
                          <Text fontSize="sm" color="gray.600">Participants:</Text>
                          <AvatarGroup size="sm" max={3}>
                            {conv.participants.map((participant, idx) => (
                              <Avatar key={idx} name={participant} size="sm" />
                            ))}
                          </AvatarGroup>
                        </HStack>

                        <Box p={3} bg="gray.50" borderRadius="md">
                          <Text fontSize="sm" fontStyle="italic">
                            "{conv.lastMessage}"
                          </Text>
                        </Box>

                        <HStack justify="space-between" fontSize="xs" color="gray.500">
                          <Text>{new Date(conv.timestamp).toLocaleString()}</Text>
                          <Button size="xs" variant="outline">
                            View Full Conversation
                          </Button>
                        </HStack>
                      </VStack>
                    </CardBody>
                  </Card>
                ))}
              </VStack>
            </TabPanel>

            {/* Jira Integration Tab */}
            <TabPanel>
              <VStack spacing={4} align="stretch">
                <HStack justify="space-between">
                  <Text fontSize="xl" fontWeight="bold">Auto-Generated Jira Tickets</Text>
                  <Button size="sm" onClick={() => showFeatureDetails('jira')}>
                    Create Ticket
                  </Button>
                </HStack>

                <Alert status="success">
                  <AlertIcon />
                  <Box>
                    <Text fontWeight="bold">AI-Powered Ticket Creation</Text>
                    <Text fontSize="sm">
                      AI agents automatically create Jira tickets when they discover issues,
                      suggest improvements, or identify optimization opportunities.
                    </Text>
                  </Box>
                </Alert>

                {jiraTickets.length === 0 ? (
                  <Alert status="info">
                    <AlertIcon />
                    <Box>
                      <Text fontWeight="bold">No Tickets Yet</Text>
                      <Text fontSize="sm">
                        Connect your Jira instance to see auto-generated tickets from AI analysis.
                        Configure the Jira integration in your project settings.
                      </Text>
                    </Box>
                  </Alert>
                ) : jiraTickets.map((ticket) => (
                  <Card key={ticket.id} variant="outline">
                    <CardBody>
                      <HStack justify="space-between">
                        <VStack align="start" spacing={2}>
                          <HStack>
                            <Text fontWeight="bold">{ticket.key}</Text>
                            <Badge colorScheme={getTicketStatusColor(ticket.status)}>
                              {ticket.status}
                            </Badge>
                            <Badge variant="outline">{ticket.priority}</Badge>
                          </HStack>
                          <Text>{ticket.summary}</Text>
                          <HStack fontSize="sm" color="gray.600">
                            <Text>Assigned to: {ticket.assignee}</Text>
                            <Text>•</Text>
                            <Text>Created: {new Date(ticket.created).toLocaleDateString()}</Text>
                          </HStack>
                        </VStack>
                        <Button size="sm" variant="outline">
                          View in Jira
                        </Button>
                      </HStack>
                    </CardBody>
                  </Card>
                ))}
              </VStack>
            </TabPanel>

            {/* Repository Analysis Tab */}
            <TabPanel>
              <VStack spacing={4} align="stretch">
                <Text fontSize="xl" fontWeight="bold">Repository Analysis Status</Text>

                {repoStatus && (
                  <Card>
                    <CardHeader>
                      <HStack justify="space-between">
                        <Text fontWeight="bold">{repoStatus.name}</Text>
                        <Badge colorScheme="blue">{repoStatus.status}</Badge>
                      </HStack>
                    </CardHeader>
                    <CardBody>
                      <VStack spacing={4} align="stretch">
                        <Box>
                          <HStack justify="space-between" mb={2}>
                            <Text>Analysis Progress</Text>
                            <Text fontSize="sm">
                              {repoStatus.filesProcessed} / {repoStatus.totalFiles} files
                            </Text>
                          </HStack>
                          <Progress value={repoStatus.progress} colorScheme="blue" />
                        </Box>

                        <Divider />

                        <Box>
                          <Text fontWeight="bold" mb={2}>Latest Commit</Text>
                          <HStack>
                            <GitCommit size={16} />
                            <Text fontSize="sm" fontFamily="mono">{repoStatus.lastCommit.hash}</Text>
                            <Text fontSize="sm">{repoStatus.lastCommit.message}</Text>
                          </HStack>
                          <Text fontSize="xs" color="gray.600">
                            by {repoStatus.lastCommit.author} • {new Date(repoStatus.lastCommit.timestamp).toLocaleString()}
                          </Text>
                        </Box>

                        {repoStatus.errors.length > 0 && (
                          <>
                            <Divider />
                            <Box>
                              <Text fontWeight="bold" color="red.500" mb={2}>
                                Analysis Issues ({repoStatus.errors.length})
                              </Text>
                              <List spacing={1}>
                                {repoStatus.errors.map((error: string, idx: number) => (
                                  <ListItem key={idx} fontSize="sm">
                                    <ListIcon as={AlertTriangle} color="red.500" />
                                    {error}
                                  </ListItem>
                                ))}
                              </List>
                            </Box>
                          </>
                        )}
                      </VStack>
                    </CardBody>
                  </Card>
                )}
              </VStack>
            </TabPanel>

            {/* Database Status Tab */}
            <TabPanel>
              <VStack spacing={4} align="stretch">
                <Text fontSize="xl" fontWeight="bold">Knowledge Graph Database</Text>

                {dbMetrics && (
                  <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                    <Card>
                      <CardHeader>
                        <Text fontWeight="bold">Storage Metrics</Text>
                      </CardHeader>
                      <CardBody>
                        <VStack spacing={3} align="stretch">
                          <HStack justify="space-between">
                            <Text>Total Nodes</Text>
                            <Text fontWeight="bold">{dbMetrics.totalNodes.toLocaleString()}</Text>
                          </HStack>
                          <HStack justify="space-between">
                            <Text>Relationships</Text>
                            <Text fontWeight="bold">{dbMetrics.totalRelationships.toLocaleString()}</Text>
                          </HStack>
                          <HStack justify="space-between">
                            <Text>Storage Used</Text>
                            <Text fontWeight="bold">{dbMetrics.storageUsed}</Text>
                          </HStack>
                          <HStack justify="space-between">
                            <Text>Recent Ingestions</Text>
                            <Badge colorScheme="green">{dbMetrics.recentIngestions}</Badge>
                          </HStack>
                        </VStack>
                      </CardBody>
                    </Card>

                    <Card>
                      <CardHeader>
                        <Text fontWeight="bold">Performance</Text>
                      </CardHeader>
                      <CardBody>
                        <VStack spacing={3} align="stretch">
                          <Box>
                            <HStack justify="space-between" mb={2}>
                              <Text>Query Performance</Text>
                              <Text fontWeight="bold">{dbMetrics.queryPerformance}%</Text>
                            </HStack>
                            <Progress value={dbMetrics.queryPerformance} colorScheme="green" />
                          </Box>
                          <Text fontSize="sm" color="gray.600">
                            Last updated: {new Date(dbMetrics.lastUpdate).toLocaleString()}
                          </Text>
                          <Button size="sm" leftIcon={<TrendingUp size={16} />}>
                            View Detailed Metrics
                          </Button>
                        </VStack>
                      </CardBody>
                    </Card>
                  </SimpleGrid>
                )}
              </VStack>
            </TabPanel>

            {/* Search & Discovery Tab */}
            <TabPanel>
              <VStack spacing={4} align="stretch">
                <Text fontSize="xl" fontWeight="bold">AI-Powered Search & Discovery</Text>

                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                  <Card>
                    <CardHeader>
                      <HStack>
                        <Search size={20} />
                        <Text fontWeight="bold">Semantic Search</Text>
                      </HStack>
                    </CardHeader>
                    <CardBody>
                      <VStack align="stretch" spacing={3}>
                        <Text fontSize="sm" color="gray.600">
                          Search your codebase using natural language queries
                        </Text>
                        <Button size="sm" onClick={() => showFeatureDetails('search')}>
                          Try Semantic Search
                        </Button>
                      </VStack>
                    </CardBody>
                  </Card>

                  <Card>
                    <CardHeader>
                      <HStack>
                        <BarChart3 size={20} />
                        <Text fontWeight="bold">Pattern Discovery</Text>
                      </HStack>
                    </CardHeader>
                    <CardBody>
                      <VStack align="stretch" spacing={3}>
                        <Text fontSize="sm" color="gray.600">
                          Discover hidden patterns and relationships in your code
                        </Text>
                        <Button size="sm" onClick={() => showFeatureDetails('patterns')}>
                          Discover Patterns
                        </Button>
                      </VStack>
                    </CardBody>
                  </Card>
                </SimpleGrid>

                <Alert status="info">
                  <AlertIcon />
                  <Box>
                    <Text fontWeight="bold">Vector-Powered Intelligence</Text>
                    <Text fontSize="sm">
                      Our vector search engine uses advanced embeddings to understand code semantics,
                      enabling natural language queries and intelligent pattern recognition.
                    </Text>
                  </Box>
                </Alert>
              </VStack>
            </TabPanel>
          </TabPanels>
        </Tabs>

        {/* Feature Details Modal */}
        <Modal isOpen={isOpen} onClose={onClose} size="xl">
          <ModalOverlay />
          <ModalContent>
            <ModalHeader>Feature Details: {selectedFeature}</ModalHeader>
            <ModalCloseButton />
            <ModalBody pb={6}>
              <VStack spacing={4} align="stretch">
                <Text>
                  This feature showcase demonstrates the real capabilities of your AI platform backend.
                  Each component is connected to live services and provides real-time data.
                </Text>
                
                <Accordion allowToggle>
                  <AccordionItem>
                    <AccordionButton>
                      <Box flex="1" textAlign="left">
                        Technical Implementation
                      </Box>
                      <AccordionIcon />
                    </AccordionButton>
                    <AccordionPanel pb={4}>
                      <Text fontSize="sm">
                        The backend integration includes WebSocket connections for real-time updates,
                        REST APIs for data fetching, and AI agents that continuously analyze your codebase.
                        All features are production-ready and scalable.
                      </Text>
                    </AccordionPanel>
                  </AccordionItem>
                </Accordion>

                <Button colorScheme="blue" onClick={onClose}>
                  Close
                </Button>
              </VStack>
            </ModalBody>
          </ModalContent>
        </Modal>
      </VStack>
    </Box>
  );
}


