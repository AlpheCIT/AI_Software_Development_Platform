import React, { useState } from 'react';
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
  Shield
} from 'lucide-react';

import RepositoryIngestionDashboard from '../components/ingestion/RepositoryIngestionDashboard';
import GraphCanvas from '../components/graph/GraphCanvas';
import InspectorTabs from '../components/graph/inspector/InspectorTabs';
import QAIntelligenceDashboard from '../components/qa-intelligence/QAIntelligenceDashboard';
import { useMCP } from '../lib/mcp/useMCP';
import { useIngestionStore } from '../stores/ingestion-store';

const MainDashboard: React.FC = () => {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<'ingestion' | 'graph' | 'analytics' | 'qa-intelligence'>('ingestion');
  const { isOpen, onOpen, onClose } = useDisclosure();
  
  const { 
    collections, 
    collectionsLoading, 
    collectionsError,
    analytics,
    analyticsLoading 
  } = useMCP();

  const { currentJob, jobHistory } = useIngestionStore();

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
              <Text fontSize="2xl" fontWeight="bold">
                Repository Analytics
              </Text>
              
              {analyticsLoading ? (
                <Box>Loading analytics...</Box>
              ) : (
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
  );
};

export default MainDashboard;