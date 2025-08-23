import React, { useState } from 'react';
import {
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Box,
  Text,
  VStack,
  HStack,
  Badge,
  Progress,
  Alert,
  AlertIcon,
  Spinner
} from '@chakra-ui/react';

interface InspectorTabsProps {
  nodeId: string;
}

export default function InspectorTabs({ nodeId }: InspectorTabsProps) {
  const [activeTab, setActiveTab] = useState(0);

  // Mock data - replace with real API calls
  const mockNodeData = {
    id: nodeId,
    name: nodeId.split(':')[1] || nodeId,
    type: nodeId.split(':')[0] || 'unknown',
    security: [
      {
        id: 'sec-001',
        severity: 'HIGH',
        type: 'SQL_INJECTION',
        description: 'Potential SQL injection vulnerability',
        file: 'user.controller.ts',
        line: 42
      }
    ],
    performance: [
      {
        name: 'Response Time',
        value: 250,
        unit: 'ms',
        threshold: 200,
        status: 'warning'
      }
    ],
    quality: [
      {
        name: 'Code Coverage',
        value: 75,
        maxValue: 100,
        threshold: 80,
        status: 'warning'
      }
    ],
    ownership: {
      team: 'Platform Team',
      owner: 'John Doe',
      contact: 'john.doe@company.com'
    },
    coverage: 0.75
  };

  return (
    <Box height="100%">
      <Tabs index={activeTab} onChange={setActiveTab} variant="enclosed" height="100%">
        <TabList>
          <Tab>Overview</Tab>
          <Tab>Code</Tab>
          <Tab>Security</Tab>
          <Tab>Performance</Tab>
          <Tab>CI/CD</Tab>
          <Tab>Ownership</Tab>
          <Tab>History</Tab>
        </TabList>

        <TabPanels height="calc(100% - 40px)" overflowY="auto">
          {/* Overview Tab */}
          <TabPanel>
            <VStack spacing={4} align="stretch">
              <Box>
                <Text fontSize="lg" fontWeight="bold">{mockNodeData.name}</Text>
                <HStack spacing={2}>
                  <Badge colorScheme="blue">{mockNodeData.type}</Badge>
                  <Badge colorScheme="green">Active</Badge>
                </HStack>
              </Box>
              
              <Box>
                <Text fontWeight="semibold" mb={2}>Test Coverage</Text>
                <Progress value={mockNodeData.coverage * 100} colorScheme="green" />
                <Text fontSize="sm" color="gray.600">
                  {Math.round(mockNodeData.coverage * 100)}%
                </Text>
              </Box>

              <Box>
                <Text fontWeight="semibold" mb={2}>Quick Stats</Text>
                <VStack spacing={2} align="stretch">
                  <HStack justify="space-between">
                    <Text>Security Issues:</Text>
                    <Badge colorScheme="red">{mockNodeData.security.length}</Badge>
                  </HStack>
                  <HStack justify="space-between">
                    <Text>Performance Issues:</Text>
                    <Badge colorScheme="yellow">{mockNodeData.performance.length}</Badge>
                  </HStack>
                  <HStack justify="space-between">
                    <Text>Quality Issues:</Text>
                    <Badge colorScheme="orange">{mockNodeData.quality.length}</Badge>
                  </HStack>
                </VStack>
              </Box>
            </VStack>
          </TabPanel>

          {/* Code Tab */}
          <TabPanel>
            <VStack spacing={4} align="stretch">
              <Text fontSize="md" fontWeight="semibold">Code Analysis</Text>
              <Text color="gray.600">
                Code viewer and analysis coming soon...
              </Text>
              <Alert status="info">
                <AlertIcon />
                This tab will show syntax-highlighted code with inline annotations.
              </Alert>
            </VStack>
          </TabPanel>

          {/* Security Tab */}
          <TabPanel>
            <VStack spacing={4} align="stretch">
              <Text fontSize="md" fontWeight="semibold">Security Issues</Text>
              {mockNodeData.security.map((issue) => (
                <Alert key={issue.id} status="error">
                  <AlertIcon />
                  <Box>
                    <Text fontWeight="bold">{issue.type}</Text>
                    <Text fontSize="sm">{issue.description}</Text>
                    <Text fontSize="xs" color="gray.600">
                      {issue.file}:{issue.line}
                    </Text>
                  </Box>
                </Alert>
              ))}
            </VStack>
          </TabPanel>

          {/* Performance Tab */}
          <TabPanel>
            <VStack spacing={4} align="stretch">
              <Text fontSize="md" fontWeight="semibold">Performance Metrics</Text>
              {mockNodeData.performance.map((metric, index) => (
                <Box key={index} p={3} border="1px" borderColor="gray.200" borderRadius="md">
                  <HStack justify="space-between" mb={2}>
                    <Text fontWeight="semibold">{metric.name}</Text>
                    <Badge colorScheme={metric.status === 'warning' ? 'yellow' : 'green'}>
                      {metric.status}
                    </Badge>
                  </HStack>
                  <Text fontSize="lg">
                    {metric.value} {metric.unit}
                  </Text>
                  <Text fontSize="sm" color="gray.600">
                    Threshold: {metric.threshold} {metric.unit}
                  </Text>
                </Box>
              ))}
            </VStack>
          </TabPanel>

          {/* CI/CD Tab */}
          <TabPanel>
            <VStack spacing={4} align="stretch">
              <Text fontSize="md" fontWeight="semibold">CI/CD Pipeline</Text>
              <Text color="gray.600">
                Pipeline information and deployment history coming soon...
              </Text>
              <Alert status="info">
                <AlertIcon />
                This tab will show build status, deployment history, and pipeline configuration.
              </Alert>
            </VStack>
          </TabPanel>

          {/* Ownership Tab */}
          <TabPanel>
            <VStack spacing={4} align="stretch">
              <Text fontSize="md" fontWeight="semibold">Ownership Information</Text>
              <Box p={3} border="1px" borderColor="gray.200" borderRadius="md">
                <VStack spacing={2} align="stretch">
                  <HStack justify="space-between">
                    <Text fontWeight="semibold">Team:</Text>
                    <Text>{mockNodeData.ownership.team}</Text>
                  </HStack>
                  <HStack justify="space-between">
                    <Text fontWeight="semibold">Owner:</Text>
                    <Text>{mockNodeData.ownership.owner}</Text>
                  </HStack>
                  <HStack justify="space-between">
                    <Text fontWeight="semibold">Contact:</Text>
                    <Text fontSize="sm" color="blue.600">
                      {mockNodeData.ownership.contact}
                    </Text>
                  </HStack>
                </VStack>
              </Box>
            </VStack>
          </TabPanel>

          {/* History Tab */}
          <TabPanel>
            <VStack spacing={4} align="stretch">
              <Text fontSize="md" fontWeight="semibold">Change History</Text>
              <Text color="gray.600">
                Git history and change tracking coming soon...
              </Text>
              <Alert status="info">
                <AlertIcon />
                This tab will show commit history, change frequency, and modification patterns.
              </Alert>
            </VStack>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </Box>
  );
}
