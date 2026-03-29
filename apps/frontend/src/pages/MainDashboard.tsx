import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  GridItem,
  VStack,
  HStack,
  Text,
  Button,
  Badge,
  useDisclosure,
  Drawer,
  DrawerBody,
  DrawerHeader,
  DrawerOverlay,
  DrawerContent,
  DrawerCloseButton,
  useColorModeValue,
  useColorMode,
  IconButton,
  Tooltip,
  useBreakpointValue
} from '@chakra-ui/react';
import {
  Database,
  Activity,
  Settings,
  Menu,
  BarChart3,
  Search,
  Shield,
  BookOpen,
  List,
  Moon,
  Sun,
} from 'lucide-react';

import RepositoryIngestionDashboard from '../components/ingestion/RepositoryIngestionDashboard';
import GraphCanvas from '../components/graph/GraphCanvas';
import InspectorTabs from '../components/graph/inspector/InspectorTabs';
import QAIntelligenceDashboard from '../components/qa-intelligence/QAIntelligenceDashboard';
import RunManager from '../components/qa-intelligence/RunManager';
import RepoWiki from '../components/wiki/RepoWiki';
import { RoleProvider } from '../context/RoleContext';
import { useMCP } from '../lib/mcp/useMCP';
import { useIngestionStore } from '../stores/ingestion-store';

const MainDashboard: React.FC = () => {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<'ingestion' | 'graph' | 'analytics' | 'qa-intelligence' | 'wiki' | 'run-manager'>('qa-intelligence');
  const { isOpen, onOpen, onClose } = useDisclosure();
  
  const { 
    collections, 
    collectionsLoading, 
    collectionsError,
    analytics,
    analyticsLoading 
  } = useMCP();

  const { currentJob, jobHistory } = useIngestionStore();

  // When RunManager dispatches qa-view-run, switch to QA Intelligence view
  // (the QAIntelligenceDashboard will pick up the event and load the run)
  useEffect(() => {
    const handleViewRun = () => {
      setCurrentView('qa-intelligence');
    };
    window.addEventListener('qa-view-run', handleViewRun);
    return () => window.removeEventListener('qa-view-run', handleViewRun);
  }, []);

  const { colorMode, toggleColorMode } = useColorMode();
  const bgColor = useColorModeValue('gray.50', 'gray.900');
  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');

  const isMobile = useBreakpointValue({ base: true, lg: false });

  const handleNodeSelect = (nodeId: string | null) => {
    setSelectedNodeId(nodeId);
    if (nodeId && currentView !== 'graph') {
      setCurrentView('graph');
    }
  };

  const handleNodeDoubleClick = (nodeId: string) => {
    console.log('Node double clicked:', nodeId);
    // Could expand node or show additional details
  };

  const getCollectionStatusSummary = () => {
    if (collectionsLoading) return { total: 0, populated: 0, populating: 0 };
    
    const total = collections.length;
    const populated = collections.filter(c => c.count > 0).length;
    const populating = collections.filter(c => c.status === 'populating').length;
    
    return { total, populated, populating };
  };

  const statusSummary = getCollectionStatusSummary();

  const renderMainContent = () => {
    switch (currentView) {
      case 'qa-intelligence':
        return (
          <Box height="100%">
            <QAIntelligenceDashboard />
          </Box>
        );

      case 'wiki':
        return (
          <Box height="100%">
            <RepoWiki />
          </Box>
        );

      case 'run-manager':
        return (
          <Box height="100%">
            <RunManager />
          </Box>
        );

      case 'ingestion':
        return (
          <Box height="100%">
            <RepositoryIngestionDashboard />
          </Box>
        );
      
      case 'graph':
        return (
          <Grid 
            templateColumns={{ base: '1fr', xl: '1fr 400px' }} 
            gap={4} 
            height="100%"
            minHeight="600px"
          >
            <GridItem>
              <Box height="100%" minHeight="600px">
                <GraphCanvas
                  selectedNodeId={selectedNodeId}
                  onNodeSelect={handleNodeSelect}
                  onNodeDoubleClick={handleNodeDoubleClick}
                  width={isMobile ? window.innerWidth - 40 : 800}
                  height={600}
                  layout="force"
                />
              </Box>
            </GridItem>
            {!isMobile && (
              <GridItem>
                <InspectorTabs
                  nodeId={selectedNodeId}
                  width={400}
                  height={600}
                />
              </GridItem>
            )}
          </Grid>
        );
      
      case 'analytics':
        return (
          <Box height="100%" p={6}>
            <VStack spacing={6} align="stretch">
              <VStack align="start" spacing={1}>
                <Text fontSize="2xl" fontWeight="bold">
                  Repository Analytics
                </Text>
                {(analytics as any)?._qaDetails?.repoUrl && (
                  <HStack spacing={2} fontSize="sm" color="gray.500">
                    <Database size={14} />
                    <Text fontWeight="medium" color="gray.700">
                      {(analytics as any)._qaDetails.repoName}
                    </Text>
                    <Text>({(analytics as any)._qaDetails.branch})</Text>
                    <Badge colorScheme="blue" variant="outline" fontSize="xs">
                      {(analytics as any)._qaDetails.repoUrl}
                    </Badge>
                  </HStack>
                )}
              </VStack>
              
              {analyticsLoading ? (
                <Box>Loading analytics...</Box>
              ) : !analytics ? (
                <Box bg={cardBg} p={8} borderRadius="lg" border="1px solid" borderColor={borderColor} textAlign="center">
                  <Text fontSize="lg" color="gray.500" mb={2}>No Analysis Data Available</Text>
                  <Text fontSize="sm" color="gray.400">
                    Run a QA analysis from the QA Intelligence tab, or ingest a repository to see real metrics here.
                  </Text>
                </Box>
              ) : (analytics as any)?._source === 'qa-engine' ? (
                /* QA Engine data — rich analytics from all runs */
                <VStack spacing={6} align="stretch">
                  {/* Summary Cards */}
                  <Grid templateColumns="repeat(auto-fit, minmax(180px, 1fr))" gap={4}>
                    <Box bg={cardBg} p={4} borderRadius="lg" border="1px solid" borderColor={borderColor} textAlign="center">
                      <Text fontSize="3xl" fontWeight="bold" color="blue.500">{(analytics as any)?._qaDetails?.totalTests || 0}</Text>
                      <Text fontSize="xs" color="gray.500">Tests Generated</Text>
                    </Box>
                    <Box bg={cardBg} p={4} borderRadius="lg" border="1px solid" borderColor={borderColor} textAlign="center">
                      <Text fontSize="3xl" fontWeight="bold" color="green.500">{(analytics as any)?._qaDetails?.totalPassed || 0}</Text>
                      <Text fontSize="xs" color="gray.500">Tests Passed</Text>
                    </Box>
                    <Box bg={cardBg} p={4} borderRadius="lg" border="1px solid" borderColor={borderColor} textAlign="center">
                      <Text fontSize="3xl" fontWeight="bold" color={(analytics as any)?._qaDetails?.avgMutationScore >= 80 ? 'green.500' : 'orange.500'}>{(analytics as any)?._qaDetails?.avgMutationScore || 0}%</Text>
                      <Text fontSize="xs" color="gray.500">Avg Mutation Score</Text>
                    </Box>
                    <Box bg={cardBg} p={4} borderRadius="lg" border="1px solid" borderColor={borderColor} textAlign="center">
                      <Text fontSize="3xl" fontWeight="bold" color="teal.500">{(analytics as any)?._qaDetails?.completedRuns || 0}</Text>
                      <Text fontSize="xs" color="gray.500">Completed Runs</Text>
                    </Box>
                    <Box bg={cardBg} p={4} borderRadius="lg" border="1px solid" borderColor={borderColor} textAlign="center">
                      <Text fontSize="3xl" fontWeight="bold" color="purple.500">{(analytics as any)?._qaDetails?.totalIterations || 0}</Text>
                      <Text fontSize="xs" color="gray.500">Total Iterations</Text>
                    </Box>
                    <Box bg={cardBg} p={4} borderRadius="lg" border="1px solid" borderColor={borderColor} textAlign="center">
                      <Text fontSize="sm" fontWeight="bold" color="blue.600">{(analytics as any)?._qaDetails?.repoName || 'Unknown'}</Text>
                      <Text fontSize="xs" color="gray.500">{(analytics as any)?._qaDetails?.branch || '—'} branch</Text>
                    </Box>
                  </Grid>

                  {/* Mutation Score Trend */}
                  {(analytics as any)?._qaDetails?.runs?.length > 1 && (
                    <Box bg={cardBg} p={6} borderRadius="lg" border="1px solid" borderColor={borderColor}>
                      <Text fontSize="lg" fontWeight="bold" mb={4}>Mutation Score Trend</Text>
                      <HStack spacing={2} align="flex-end" h="120px">
                        {((analytics as any)?._qaDetails?.runs || []).map((run: any, i: number) => {
                          const score = run.mutationScore || 0;
                          const color = score >= 80 ? 'green' : score >= 60 ? 'yellow' : 'red';
                          return (
                            <Tooltip key={i} label={`Run ${i + 1}: ${score}% (${run.tests} tests, ${new Date(run.date).toLocaleDateString()})`}>
                              <Box
                                flex={1}
                                bg={`${color}.400`}
                                h={`${Math.max(score, 5)}%`}
                                borderRadius="sm"
                                minH="4px"
                                transition="all 0.3s"
                                _hover={{ opacity: 0.8 }}
                              />
                            </Tooltip>
                          );
                        })}
                      </HStack>
                      <HStack justify="space-between" mt={2}>
                        <Text fontSize="2xs" color="gray.400">Run 1</Text>
                        <Text fontSize="2xs" color="gray.400">Run {(analytics as any)?._qaDetails?.runs?.length}</Text>
                      </HStack>
                    </Box>
                  )}

                  {/* Per-Run Breakdown Table */}
                  <Box bg={cardBg} p={6} borderRadius="lg" border="1px solid" borderColor={borderColor}>
                    <Text fontSize="lg" fontWeight="bold" mb={4}>Run-by-Run Breakdown</Text>
                    <Box overflowX="auto">
                      <Box as="table" w="full" fontSize="sm">
                        <Box as="thead">
                          <Box as="tr" borderBottom="2px solid" borderColor={borderColor}>
                            <Box as="th" p={2} textAlign="left">Run</Box>
                            <Box as="th" p={2} textAlign="left">Date</Box>
                            <Box as="th" p={2} textAlign="right">Tests</Box>
                            <Box as="th" p={2} textAlign="right">Passed</Box>
                            <Box as="th" p={2} textAlign="right">Mutation</Box>
                            <Box as="th" p={2} textAlign="right">Iterations</Box>
                            <Box as="th" p={2} textAlign="right">Duration</Box>
                          </Box>
                        </Box>
                        <Box as="tbody">
                          {((analytics as any)?._qaDetails?.runs || []).map((run: any, i: number) => (
                            <Box as="tr" key={i} borderBottom="1px solid" borderColor={borderColor} _hover={{ bg: bgColor }}>
                              <Box as="td" p={2} fontFamily="mono" fontSize="xs">{run.id?.substring(0, 8)}</Box>
                              <Box as="td" p={2}>{new Date(run.date).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</Box>
                              <Box as="td" p={2} textAlign="right"><Badge colorScheme="blue">{run.tests}</Badge></Box>
                              <Box as="td" p={2} textAlign="right"><Badge colorScheme="green">{run.passed}</Badge></Box>
                              <Box as="td" p={2} textAlign="right"><Badge colorScheme={run.mutationScore >= 80 ? 'green' : run.mutationScore >= 60 ? 'yellow' : 'red'}>{run.mutationScore}%</Badge></Box>
                              <Box as="td" p={2} textAlign="right">{run.iterations}</Box>
                              <Box as="td" p={2} textAlign="right" fontSize="xs" color="gray.500">{run.duration > 60 ? `${Math.floor(run.duration / 60)}m ${run.duration % 60}s` : `${run.duration}s`}</Box>
                            </Box>
                          ))}
                        </Box>
                      </Box>
                    </Box>
                  </Box>
                </VStack>
              ) : (
                /* Real MCP analytics data — original labels */
                <Grid templateColumns="repeat(auto-fit, minmax(300px, 1fr))" gap={6}>
                  <Box key="security" bg={cardBg} p={6} borderRadius="lg" border="1px solid" borderColor={borderColor}>
                    <Text fontSize="lg" fontWeight="bold" mb={4}>Security Overview</Text>
                    <VStack align="stretch" spacing={3}>
                      <HStack justify="space-between">
                        <Text>Total Vulnerabilities:</Text>
                        <Badge colorScheme="red">
                          {analytics?.security?.totalVulnerabilities || 0}
                        </Badge>
                      </HStack>
                      <HStack justify="space-between">
                        <Text>Critical Issues:</Text>
                        <Badge colorScheme="red" variant="solid">
                          {analytics?.security?.criticalIssues || 0}
                        </Badge>
                      </HStack>
                      <HStack justify="space-between">
                        <Text>High Issues:</Text>
                        <Badge colorScheme="orange">
                          {analytics?.security?.highIssues || 0}
                        </Badge>
                      </HStack>
                    </VStack>
                  </Box>

                  <Box key="performance" bg={cardBg} p={6} borderRadius="lg" border="1px solid" borderColor={borderColor}>
                    <Text fontSize="lg" fontWeight="bold" mb={4}>Performance Metrics</Text>
                    <VStack align="stretch" spacing={3}>
                      <HStack justify="space-between">
                        <Text>Average Complexity:</Text>
                        <Badge colorScheme="blue">
                          {analytics?.performance?.averageComplexity?.toFixed(1) || '0.0'}
                        </Badge>
                      </HStack>
                      <HStack justify="space-between">
                        <Text>Total Functions:</Text>
                        <Badge colorScheme="green">
                          {analytics?.performance?.totalFunctions || 0}
                        </Badge>
                      </HStack>
                      <HStack justify="space-between">
                        <Text>Test Coverage:</Text>
                        <Badge colorScheme="purple">
                          {analytics?.performance?.testCoverage || 0}%
                        </Badge>
                      </HStack>
                    </VStack>
                  </Box>

                  <Box key="repository" bg={cardBg} p={6} borderRadius="lg" border="1px solid" borderColor={borderColor}>
                    <Text fontSize="lg" fontWeight="bold" mb={4}>Repository Info</Text>
                    <VStack align="stretch" spacing={3}>
                      <HStack justify="space-between">
                        <Text>Total Files:</Text>
                        <Badge colorScheme="teal">
                          {analytics?.repository?.totalFiles || 0}
                        </Badge>
                      </HStack>
                      <HStack justify="space-between">
                        <Text>Total Lines:</Text>
                        <Badge colorScheme="cyan">
                          {analytics?.repository?.totalLines?.toLocaleString() || '0'}
                        </Badge>
                      </HStack>
                      <HStack justify="space-between">
                        <Text>Last Analyzed:</Text>
                        <Text fontSize="sm" color="gray.500">
                          {analytics?.repository?.lastAnalyzed ?
                            new Date(analytics.repository.lastAnalyzed).toLocaleDateString() :
                            'Never'
                          }
                        </Text>
                      </HStack>
                    </VStack>
                  </Box>
                </Grid>
              )}
            </VStack>
          </Box>
        );
      
      default:
        return null;
    }
  };

  return (
    <RoleProvider>
    <Box bg={bgColor} minHeight="100vh">
      {/* Header */}
      <Box 
        bg={cardBg} 
        borderBottom="1px solid" 
        borderColor={borderColor}
        px={6} 
        py={4}
        position="sticky"
        top={0}
        zIndex={10}
      >
        <HStack justify="space-between" align="center">
          <HStack spacing={4}>
            <HStack spacing={2}>
              <Database size={24} color="blue" />
              <Text fontSize="xl" fontWeight="bold" color="blue.600">
                AI Software Development Platform
              </Text>
            </HStack>
            
            {!isMobile && (
              <HStack spacing={2}>
                <Badge colorScheme="blue" variant="subtle">
                  Collections: {statusSummary.populated}/{statusSummary.total}
                </Badge>
                {statusSummary.populating > 0 && (
                  <Badge colorScheme="orange" variant="subtle">
                    <Activity size={12} style={{ marginRight: '4px' }} />
                    Processing: {statusSummary.populating}
                  </Badge>
                )}
                {currentJob && (
                  <Badge colorScheme="green" variant="subtle">
                    {currentJob.status === 'running' ? '🔄' : '✅'} 
                    {currentJob.repositoryUrl.split('/').pop()}
                  </Badge>
                )}
              </HStack>
            )}
          </HStack>

          <HStack spacing={2}>
            <Tooltip label={colorMode === 'light' ? 'Dark mode' : 'Light mode'}>
              <IconButton
                aria-label="Toggle color mode"
                icon={colorMode === 'light' ? <Moon size={16} /> : <Sun size={16} />}
                size="sm"
                variant="ghost"
                onClick={toggleColorMode}
              />
            </Tooltip>
            <Button
              variant={currentView === 'ingestion' ? 'solid' : 'ghost'}
              colorScheme="blue"
              size="sm"
              onClick={() => setCurrentView('ingestion')}
              leftIcon={<Database size={16} />}
            >
              Ingestion
            </Button>
            <Button
              variant={currentView === 'graph' ? 'solid' : 'ghost'}
              colorScheme="blue"
              size="sm"
              onClick={() => setCurrentView('graph')}
              leftIcon={<Activity size={16} />}
            >
              Graph
            </Button>
            <Button
              variant={currentView === 'analytics' ? 'solid' : 'ghost'}
              colorScheme="blue"
              size="sm"
              onClick={() => setCurrentView('analytics')}
              leftIcon={<BarChart3 size={16} />}
            >
              Analytics
            </Button>
            <Button
              variant={currentView === 'qa-intelligence' ? 'solid' : 'ghost'}
              colorScheme="purple"
              size="sm"
              onClick={() => setCurrentView('qa-intelligence')}
              leftIcon={<Shield size={16} />}
            >
              QA Intelligence
            </Button>
            <Button
              variant={currentView === 'run-manager' ? 'solid' : 'ghost'}
              colorScheme="teal"
              size="sm"
              onClick={() => setCurrentView('run-manager')}
              leftIcon={<List size={16} />}
            >
              Run Manager
            </Button>
            <Button
              variant={currentView === 'wiki' ? 'solid' : 'ghost'}
              colorScheme="orange"
              size="sm"
              onClick={() => setCurrentView('wiki')}
              leftIcon={<BookOpen size={16} />}
            >
              Wiki
            </Button>

            {isMobile && (
              <IconButton
                aria-label="Menu"
                icon={<Menu />}
                variant="ghost"
                onClick={onOpen}
              />
            )}
          </HStack>
        </HStack>
      </Box>

      {/* Main Content */}
      <Box flex="1" p={6}>
        {renderMainContent()}
      </Box>

      {/* Mobile Drawer for Inspector */}
      {isMobile && selectedNodeId && (
        <Drawer isOpen={!!selectedNodeId} placement="bottom" onClose={() => setSelectedNodeId(null)}>
          <DrawerOverlay />
          <DrawerContent maxHeight="70vh">
            <DrawerCloseButton />
            <DrawerHeader>Node Inspector</DrawerHeader>
            <DrawerBody>
              <InspectorTabs
                nodeId={selectedNodeId}
                width={window.innerWidth - 40}
                height={window.innerHeight * 0.6}
              />
            </DrawerBody>
          </DrawerContent>
        </Drawer>
      )}

      {/* Status Drawer */}
      <Drawer isOpen={isOpen} placement="right" onClose={onClose}>
        <DrawerOverlay />
        <DrawerContent>
          <DrawerCloseButton />
          <DrawerHeader>System Status</DrawerHeader>
          <DrawerBody>
            <VStack spacing={4} align="stretch">
              <Box>
                <Text fontSize="lg" fontWeight="bold" mb={3}>Database Collections</Text>
                <VStack spacing={2} align="stretch">
                  <HStack justify="space-between">
                    <Text>Total Collections:</Text>
                    <Badge colorScheme="blue">{statusSummary.total}</Badge>
                  </HStack>
                  <HStack justify="space-between">
                    <Text>Populated:</Text>
                    <Badge colorScheme="green">{statusSummary.populated}</Badge>
                  </HStack>
                  <HStack justify="space-between">
                    <Text>Processing:</Text>
                    <Badge colorScheme="orange">{statusSummary.populating}</Badge>
                  </HStack>
                </VStack>
              </Box>

              {currentJob && (
                <Box key="current-job">
                  <Text fontSize="lg" fontWeight="bold" mb={3}>Current Job</Text>
                  <VStack spacing={2} align="stretch">
                    <HStack justify="space-between">
                      <Text>Repository:</Text>
                      <Text fontSize="sm">{currentJob.repositoryUrl.split('/').pop()}</Text>
                    </HStack>
                    <HStack justify="space-between">
                      <Text>Status:</Text>
                      <Badge colorScheme={currentJob.status === 'running' ? 'blue' : 'gray'}>
                        {currentJob.status}
                      </Badge>
                    </HStack>
                    <HStack justify="space-between">
                      <Text>Progress:</Text>
                      <Text>{currentJob.progress}%</Text>
                    </HStack>
                    <HStack justify="space-between">
                      <Text>Phase:</Text>
                      <Text fontSize="sm">{currentJob.phase}</Text>
                    </HStack>
                  </VStack>
                </Box>
              )}

              {jobHistory.length > 0 && (
                <Box key="job-history">
                  <Text fontSize="lg" fontWeight="bold" mb={3}>Recent Jobs</Text>
                  <VStack spacing={2} align="stretch">
                    {jobHistory.slice(0, 5).map((job, index) => (
                      <Box key={job.id || `job-${index}`} p={3} bg={cardBg} borderRadius="md" border="1px solid" borderColor={borderColor}>
                        <HStack justify="space-between">
                          <Text fontSize="sm" fontWeight="medium">
                            {job.repositoryUrl.split('/').pop()}
                          </Text>
                          <Badge 
                            colorScheme={
                              job.status === 'completed' ? 'green' : 
                              job.status === 'running' ? 'blue' : 
                              job.status === 'failed' ? 'red' : 'gray'
                            }
                            size="sm"
                          >
                            {job.status}
                          </Badge>
                        </HStack>
                        <Text fontSize="xs" color="gray.500" mt={1}>
                          {new Date(job.startTime).toLocaleString()}
                        </Text>
                      </Box>
                    ))}
                  </VStack>
                </Box>
              )}
            </VStack>
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    </Box>
    </RoleProvider>
  );
};

export default MainDashboard;