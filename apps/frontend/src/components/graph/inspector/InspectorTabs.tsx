import React, { useState, useEffect } from 'react';
import {
  Box,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Text,
  Badge,
  Spinner,
  Alert,
  AlertIcon,
  VStack,
  HStack,
  Divider,
  Card,
  CardBody,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  StatArrow,
  SimpleGrid,
  Progress,
  Code,
  useColorModeValue
} from '@chakra-ui/react';
import {
  Info,
  Code2,
  Shield,
  Zap,
  GitBranch,
  Users,
  History,
  FileText,
  AlertTriangle,
  CheckCircle,
  Clock,
  Activity
} from 'lucide-react';
import { useMCP } from '../../../lib/mcp/useMCP';

interface InspectorTabsProps {
  nodeId: string | null;
  width?: number;
  height?: number;
}

interface NodeData {
  id: string;
  name: string;
  type: string;
  properties: Record<string, any>;
  metrics: {
    security: {
      vulnerabilities: any[];
      riskScore: number;
    };
    performance: {
      complexity: number;
      lines: number;
      testCoverage: number;
    };
    quality: {
      maintainabilityIndex: number;
      technicalDebt: number;
      codeSmells: number;
    };
  };
}

const tabConfigs = [
  {
    label: 'Overview',
    icon: Info,
    color: 'blue'
  },
  {
    label: 'Code',
    icon: Code2,
    color: 'green'
  },
  {
    label: 'Security',
    icon: Shield,
    color: 'red'
  },
  {
    label: 'Performance',
    icon: Zap,
    color: 'orange'
  },
  {
    label: 'CI/CD',
    icon: GitBranch,
    color: 'purple'
  },
  {
    label: 'Ownership',
    icon: Users,
    color: 'teal'
  },
  {
    label: 'History',
    icon: History,
    color: 'gray'
  }
];

export const InspectorTabs: React.FC<InspectorTabsProps> = ({
  nodeId,
  width = 400,
  height = 600
}) => {
  const [nodeData, setNodeData] = useState<NodeData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(0);

  const { loadNodeDetails, executeAQL } = useMCP();

  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');

  // Load node data when nodeId changes
  useEffect(() => {
    const loadData = async () => {
      if (!nodeId) {
        setNodeData(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // Load basic node details
        const details = await loadNodeDetails(nodeId);
        
        // Load additional metrics via AQL queries
        const securityQuery = `
          FOR vuln IN security_findings
            FILTER vuln.nodeId == @nodeId
            RETURN vuln
        `;

        const performanceQuery = `
          FOR metric IN performance_metrics
            FILTER metric.nodeId == @nodeId
            RETURN metric
        `;

        const qualityQuery = `
          FOR quality IN quality_metrics
            FILTER quality.nodeId == @nodeId
            RETURN quality
        `;

        const [securityResults, performanceResults, qualityResults] = await Promise.all([
          executeAQL(securityQuery, { nodeId }).catch(() => []),
          executeAQL(performanceQuery, { nodeId }).catch(() => []),
          executeAQL(qualityQuery, { nodeId }).catch(() => [])
        ]);

        const nodeDataWithMetrics: NodeData = {
          id: nodeId,
          name: details?.name || nodeId,
          type: details?.type || 'unknown',
          properties: details?.properties || {},
          metrics: {
            security: {
              vulnerabilities: securityResults || [],
              riskScore: calculateRiskScore(securityResults || [])
            },
            performance: {
              complexity: performanceResults?.[0]?.complexity || 0,
              lines: performanceResults?.[0]?.lines || 0,
              testCoverage: performanceResults?.[0]?.testCoverage || 0
            },
            quality: {
              maintainabilityIndex: qualityResults?.[0]?.maintainabilityIndex || 0,
              technicalDebt: qualityResults?.[0]?.technicalDebt || 0,
              codeSmells: qualityResults?.[0]?.codeSmells || 0
            }
          }
        };

        setNodeData(nodeDataWithMetrics);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load node data');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [nodeId, loadNodeDetails, executeAQL]);

  const calculateRiskScore = (vulnerabilities: any[]): number => {
    if (!vulnerabilities.length) return 0;
    
    const weights = { critical: 10, high: 7, medium: 4, low: 1 };
    const score = vulnerabilities.reduce((total, vuln) => {
      const severity = vuln.severity?.toLowerCase() || 'low';
      return total + (weights[severity as keyof typeof weights] || 1);
    }, 0);
    
    return Math.min(100, score);
  };

  const getSeverityColor = (severity: string): string => {
    switch (severity?.toLowerCase()) {
      case 'critical': return 'red';
      case 'high': return 'orange';
      case 'medium': return 'yellow';
      case 'low': return 'green';
      default: return 'gray';
    }
  };

  if (!nodeId) {
    return (
      <Box
        width={width}
        height={height}
        bg={bgColor}
        border="1px solid"
        borderColor={borderColor}
        borderRadius="md"
        display="flex"
        alignItems="center"
        justifyContent="center"
        p={6}
      >
        <VStack spacing={3}>
          <FileText size={48} color="gray" />
          <Text color="gray.500" textAlign="center">
            Select a node to view detailed information
          </Text>
        </VStack>
      </Box>
    );
  }

  if (loading) {
    return (
      <Box
        width={width}
        height={height}
        bg={bgColor}
        border="1px solid"
        borderColor={borderColor}
        borderRadius="md"
        display="flex"
        alignItems="center"
        justifyContent="center"
      >
        <VStack spacing={3}>
          <Spinner size="xl" />
          <Text>Loading node details...</Text>
        </VStack>
      </Box>
    );
  }

  if (error) {
    return (
      <Box
        width={width}
        height={height}
        bg={bgColor}
        border="1px solid"
        borderColor={borderColor}
        borderRadius="md"
        p={4}
      >
        <Alert status="error">
          <AlertIcon />
          <Box>
            <Text fontWeight="bold">Failed to load data</Text>
            <Text fontSize="sm">{error}</Text>
          </Box>
        </Alert>
      </Box>
    );
  }

  return (
    <Box
      width={width}
      height={height}
      bg={bgColor}
      border="1px solid"
      borderColor={borderColor}
      borderRadius="md"
      overflow="hidden"
    >
      <Tabs
        index={activeTab}
        onChange={setActiveTab}
        variant="enclosed"
        colorScheme="blue"
        height="100%"
        display="flex"
        flexDirection="column"
      >
        <TabList flexShrink={0} overflowX="auto">
          {tabConfigs.map((tab, index) => (
            <Tab key={index} fontSize="sm" minW="fit-content">
              <HStack spacing={1}>
                <tab.icon size={14} />
                <Text>{tab.label}</Text>
              </HStack>
            </Tab>
          ))}
        </TabList>

        <TabPanels flex="1" overflow="auto">
          {/* Overview Tab */}
          <TabPanel>
            <VStack spacing={4} align="stretch">
              <Box>
                <HStack justify="space-between" mb={2}>
                  <Text fontSize="lg" fontWeight="bold">
                    {nodeData?.name}
                  </Text>
                  <Badge colorScheme="blue" variant="subtle">
                    {nodeData?.type}
                  </Badge>
                </HStack>
                <Text fontSize="sm" color="gray.600">
                  ID: {nodeData?.id}
                </Text>
              </Box>

              <Divider />

              <SimpleGrid columns={2} spacing={4}>
                <Stat size="sm">
                  <StatLabel>Security Score</StatLabel>
                  <StatNumber color={nodeData?.metrics.security.riskScore > 50 ? 'red.500' : 'green.500'}>
                    {100 - (nodeData?.metrics.security.riskScore || 0)}%
                  </StatNumber>
                  <StatHelpText>
                    <StatArrow type={nodeData?.metrics.security.riskScore > 50 ? 'decrease' : 'increase'} />
                    Risk Level
                  </StatHelpText>
                </Stat>

                <Stat size="sm">
                  <StatLabel>Complexity</StatLabel>
                  <StatNumber>{nodeData?.metrics.performance.complexity || 0}</StatNumber>
                  <StatHelpText>Cyclomatic</StatHelpText>
                </Stat>

                <Stat size="sm">
                  <StatLabel>Lines of Code</StatLabel>
                  <StatNumber>{nodeData?.metrics.performance.lines || 0}</StatNumber>
                  <StatHelpText>Total</StatHelpText>
                </Stat>

                <Stat size="sm">
                  <StatLabel>Test Coverage</StatLabel>
                  <StatNumber>{nodeData?.metrics.performance.testCoverage || 0}%</StatNumber>
                  <StatHelpText>Coverage</StatHelpText>
                </Stat>
              </SimpleGrid>

              <Box>
                <Text fontSize="sm" fontWeight="medium" mb={2}>Properties</Text>
                <VStack spacing={1} align="stretch">
                  {Object.entries(nodeData?.properties || {}).slice(0, 5).map(([key, value]) => (
                    <HStack key={key} justify="space-between" fontSize="xs">
                      <Text color="gray.600">{key}:</Text>
                      <Text>{String(value)}</Text>
                    </HStack>
                  ))}
                </VStack>
              </Box>
            </VStack>
          </TabPanel>

          {/* Code Tab */}
          <TabPanel>
            <VStack spacing={4} align="stretch">
              <HStack justify="space-between">
                <Text fontSize="md" fontWeight="bold">Code Details</Text>
                <Badge>{nodeData?.properties?.language || 'Unknown'}</Badge>
              </HStack>

              <SimpleGrid columns={1} spacing={3}>
                <Card size="sm">
                  <CardBody>
                    <Stat size="sm">
                      <StatLabel>Lines of Code</StatLabel>
                      <StatNumber>{nodeData?.metrics.performance.lines || 0}</StatNumber>
                      <StatHelpText>Total lines</StatHelpText>
                    </Stat>
                  </CardBody>
                </Card>

                <Card size="sm">
                  <CardBody>
                    <Stat size="sm">
                      <StatLabel>Cyclomatic Complexity</StatLabel>
                      <StatNumber>{nodeData?.metrics.performance.complexity || 0}</StatNumber>
                      <StatHelpText>
                        {(nodeData?.metrics.performance.complexity || 0) > 10 ? 'High complexity' : 'Low complexity'}
                      </StatHelpText>
                    </Stat>
                  </CardBody>
                </Card>
              </SimpleGrid>

              {nodeData?.properties?.code && (
                <Box>
                  <Text fontSize="sm" fontWeight="medium" mb={2}>Code Preview</Text>
                  <Code 
                    display="block" 
                    whiteSpace="pre" 
                    overflow="auto" 
                    maxH="200px" 
                    fontSize="xs"
                    p={3}
                  >
                    {nodeData.properties.code.substring(0, 500)}
                    {nodeData.properties.code.length > 500 && '...'}
                  </Code>
                </Box>
              )}
            </VStack>
          </TabPanel>

          {/* Security Tab */}
          <TabPanel>
            <VStack spacing={4} align="stretch">
              <HStack justify="space-between">
                <Text fontSize="md" fontWeight="bold">Security Analysis</Text>
                <Badge 
                  colorScheme={nodeData?.metrics.security.riskScore > 50 ? 'red' : 'green'}
                  variant="solid"
                >
                  Risk: {nodeData?.metrics.security.riskScore || 0}
                </Badge>
              </HStack>

              <Box>
                <Text fontSize="sm" fontWeight="medium" mb={2}>Risk Assessment</Text>
                <Progress 
                  value={nodeData?.metrics.security.riskScore || 0}
                  colorScheme={nodeData?.metrics.security.riskScore > 50 ? 'red' : 'green'}
                  size="lg"
                  borderRadius="md"
                />
              </Box>

              <Box>
                <Text fontSize="sm" fontWeight="medium" mb={3}>
                  Vulnerabilities ({nodeData?.metrics.security.vulnerabilities.length || 0})
                </Text>
                <VStack spacing={2} align="stretch">
                  {nodeData?.metrics.security.vulnerabilities.slice(0, 5).map((vuln, index) => (
                    <Card key={index} size="sm">
                      <CardBody>
                        <HStack justify="space-between">
                          <VStack align="start" spacing={1}>
                            <Text fontSize="sm" fontWeight="medium">
                              {vuln.title || vuln.type || 'Security Issue'}
                            </Text>
                            <Text fontSize="xs" color="gray.600">
                              {vuln.description?.substring(0, 100)}...
                            </Text>
                          </VStack>
                          <Badge 
                            colorScheme={getSeverityColor(vuln.severity)}
                            variant="solid"
                          >
                            {vuln.severity || 'Unknown'}
                          </Badge>
                        </HStack>
                      </CardBody>
                    </Card>
                  ))}
                  {(nodeData?.metrics.security.vulnerabilities.length || 0) === 0 && (
                    <Card size="sm">
                      <CardBody>
                        <HStack>
                          <CheckCircle size={16} color="green" />
                          <Text fontSize="sm" color="green.600">
                            No security vulnerabilities detected
                          </Text>
                        </HStack>
                      </CardBody>
                    </Card>
                  )}
                </VStack>
              </Box>
            </VStack>
          </TabPanel>

          {/* Performance Tab */}
          <TabPanel>
            <VStack spacing={4} align="stretch">
              <Text fontSize="md" fontWeight="bold">Performance Metrics</Text>

              <SimpleGrid columns={1} spacing={3}>
                <Card size="sm">
                  <CardBody>
                    <Stat size="sm">
                      <StatLabel>Cyclomatic Complexity</StatLabel>
                      <StatNumber color={nodeData?.metrics.performance.complexity > 10 ? 'orange.500' : 'green.500'}>
                        {nodeData?.metrics.performance.complexity || 0}
                      </StatNumber>
                      <StatHelpText>
                        {nodeData?.metrics.performance.complexity > 10 ? 'High complexity' : 'Low complexity'}
                      </StatHelpText>
                    </Stat>
                  </CardBody>
                </Card>

                <Card size="sm">
                  <CardBody>
                    <Stat size="sm">
                      <StatLabel>Test Coverage</StatLabel>
                      <StatNumber color={nodeData?.metrics.performance.testCoverage < 80 ? 'red.500' : 'green.500'}>
                        {nodeData?.metrics.performance.testCoverage || 0}%
                      </StatNumber>
                      <StatHelpText>
                        {nodeData?.metrics.performance.testCoverage < 80 ? 'Below threshold' : 'Good coverage'}
                      </StatHelpText>
                    </Stat>
                  </CardBody>
                </Card>

                <Card size="sm">
                  <CardBody>
                    <Stat size="sm">
                      <StatLabel>Maintainability Index</StatLabel>
                      <StatNumber color={nodeData?.metrics.quality.maintainabilityIndex < 70 ? 'orange.500' : 'green.500'}>
                        {nodeData?.metrics.quality.maintainabilityIndex || 0}
                      </StatNumber>
                      <StatHelpText>
                        {nodeData?.metrics.quality.maintainabilityIndex < 70 ? 'Needs improvement' : 'Good maintainability'}
                      </StatHelpText>
                    </Stat>
                  </CardBody>
                </Card>
              </SimpleGrid>
            </VStack>
          </TabPanel>

          {/* CI/CD Tab */}
          <TabPanel>
            <VStack spacing={4} align="stretch">
              <Text fontSize="md" fontWeight="bold">CI/CD Pipeline</Text>
              
              <Card size="sm">
                <CardBody>
                  <HStack>
                    <Activity size={16} color="gray" />
                    <Text fontSize="sm" color="gray.600">
                      No CI/CD data available for this node
                    </Text>
                  </HStack>
                </CardBody>
              </Card>
            </VStack>
          </TabPanel>

          {/* Ownership Tab */}
          <TabPanel>
            <VStack spacing={4} align="stretch">
              <Text fontSize="md" fontWeight="bold">Code Ownership</Text>
              
              <Card size="sm">
                <CardBody>
                  <HStack>
                    <Users size={16} color="gray" />
                    <Text fontSize="sm" color="gray.600">
                      No ownership data available for this node
                    </Text>
                  </HStack>
                </CardBody>
              </Card>
            </VStack>
          </TabPanel>

          {/* History Tab */}
          <TabPanel>
            <VStack spacing={4} align="stretch">
              <Text fontSize="md" fontWeight="bold">Change History</Text>
              
              <Card size="sm">
                <CardBody>
                  <HStack>
                    <History size={16} color="gray" />
                    <Text fontSize="sm" color="gray.600">
                      No history data available for this node
                    </Text>
                  </HStack>
                </CardBody>
              </Card>
            </VStack>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </Box>
  );
};

export default InspectorTabs;