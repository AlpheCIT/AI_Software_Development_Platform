import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Heading, 
  SimpleGrid, 
  Card, 
  CardBody, 
  Text, 
  Badge, 
  HStack, 
  VStack,
  Box,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  Divider,
  Alert,
  AlertIcon,
  Progress,
  useColorModeValue
} from '@chakra-ui/react';
import { fetchNodeDetails, createGraphQueryOptions } from '../../../lib/api/graph';
import { GraphNode } from '../../../types/graph';
import { formatDistanceToNow } from 'date-fns';

interface OverviewTabProps {
  nodeId: string;
}

export default function OverviewTab({ nodeId }: OverviewTabProps) {
  const bgColor = useColorModeValue('gray.50', 'gray.800');
  
  const { data, isLoading, error } = useQuery({
    queryKey: ['node', nodeId],
    queryFn: () => fetchNodeDetails(nodeId),
    enabled: !!nodeId,
    ...createGraphQueryOptions(),
  });

  if (isLoading) {
    return (
      <VStack spacing={4} align="stretch" p={4}>
        <Text>Loading node details...</Text>
      </VStack>
    );
  }

  if (error || !data) {
    return (
      <VStack spacing={4} align="stretch" p={4}>
        <Alert status="error">
          <AlertIcon />
          Unable to load node details. Please try again.
        </Alert>
      </VStack>
    );
  }

  const nodeData = data as GraphNode;
  const coveragePercentage = nodeData.coverage ? Math.round(nodeData.coverage * 100) : 0;
  const securityIssueCount = nodeData.security?.length || 0;
  const performanceMetricCount = nodeData.performance?.length || 0;
  const lastUpdated = nodeData.metadata?.lastUpdated || new Date().toISOString();

  const getLayerColor = (layer: string): string => {
    switch (layer) {
      case 'frontend': return 'blue';
      case 'backend': return 'green';
      case 'infra': return 'orange';
      case 'ci_cd': return 'purple';
      default: return 'gray';
    }
  };

  const getCoverageColor = (coverage: number): string => {
    if (coverage >= 80) return 'green';
    if (coverage >= 60) return 'yellow';
    return 'red';
  };

  return (
    <VStack spacing={6} align="stretch" p={4}>
      {/* Node Header */}
      <Card>
        <CardBody>
          <VStack spacing={3} align="stretch">
            <HStack justify="space-between">
              <Heading size="md">{nodeData.name || nodeData.id}</Heading>
              <Badge colorScheme={getLayerColor(nodeData.layer)}>{nodeData.layer}</Badge>
            </HStack>
            <Text color="gray.600" fontSize="sm">Type: {nodeData.type}</Text>
            <Text color="gray.600" fontSize="sm">
              Last updated: {formatDistanceToNow(new Date(lastUpdated))} ago
            </Text>
          </VStack>
        </CardBody>
      </Card>

      {/* Key Metrics */}
      <SimpleGrid columns={3} spacing={4}>
        <Card>
          <CardBody>
            <Stat>
              <StatLabel>Security Issues</StatLabel>
              <StatNumber color={securityIssueCount > 0 ? 'red.500' : 'green.500'}>
                {securityIssueCount}
              </StatNumber>
              <StatHelpText>
                {securityIssueCount === 0 ? 'No issues found' : 'Issues detected'}
              </StatHelpText>
            </Stat>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <Stat>
              <StatLabel>Performance Metrics</StatLabel>
              <StatNumber>{performanceMetricCount}</StatNumber>
              <StatHelpText>Active monitors</StatHelpText>
            </Stat>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <Stat>
              <StatLabel>Test Coverage</StatLabel>
              <StatNumber color={coveragePercentage >= 80 ? 'green.500' : 'yellow.500'}>
                {coveragePercentage}%
              </StatNumber>
              <StatHelpText>Code coverage</StatHelpText>
            </Stat>
          </CardBody>
        </Card>
      </SimpleGrid>

      {/* Coverage Progress Bar */}
      <VStack spacing={2} align="stretch">
        <Text fontWeight="medium">Test Coverage</Text>
        <Progress 
          value={coveragePercentage} 
          colorScheme={getCoverageColor(coveragePercentage)}
          size="lg"
          bg={bgColor}
        />
        <Text fontSize="sm" color="gray.600">
          {coveragePercentage}% of code covered by tests
        </Text>
      </VStack>

      <Divider />

      {/* Metadata Cards */}
      <SimpleGrid columns={2} spacing={3}>
        <Card size="sm">
          <CardBody>
            <Text fontSize="sm" fontWeight="medium" mb={1}>Dependencies</Text>
            <Text fontSize="sm" color="gray.600">
              {nodeData.metadata?.dependencies?.length || 0} dependencies
            </Text>
          </CardBody>
        </Card>

        <Card size="sm">
          <CardBody>
            <Text fontSize="sm" fontWeight="medium" mb={1}>Last Updated</Text>
            <Text fontSize="sm" color="gray.600">
              {nodeData.metadata?.lastUpdated 
                ? new Date(nodeData.metadata.lastUpdated).toLocaleString()
                : 'Unknown'
              }
            </Text>
          </CardBody>
        </Card>

        {nodeData.metadata?.language && (
          <Card size="sm">
            <CardBody>
              <Text fontSize="sm" fontWeight="medium" mb={1}>Language</Text>
              <Text fontSize="sm" color="gray.600">{nodeData.metadata.language}</Text>
            </CardBody>
          </Card>
        )}

        {nodeData.metadata?.codeLines && (
          <Card size="sm">
            <CardBody>
              <Text fontSize="sm" fontWeight="medium" mb={1}>Lines of Code</Text>
              <Text fontSize="sm" color="gray.600">
                {nodeData.metadata.codeLines.toLocaleString()}
              </Text>
            </CardBody>
          </Card>
        )}

        {nodeData.metadata?.framework && (
          <Card size="sm">
            <CardBody>
              <Text fontSize="sm" fontWeight="medium" mb={1}>Framework</Text>
              <Text fontSize="sm" color="gray.600">{nodeData.metadata.framework}</Text>
            </CardBody>
          </Card>
        )}

        {nodeData.metadata?.version && (
          <Card size="sm">
            <CardBody>
              <Text fontSize="sm" fontWeight="medium" mb={1}>Version</Text>
              <Text fontSize="sm" color="gray.600">{nodeData.metadata.version}</Text>
            </CardBody>
          </Card>
        )}
      </SimpleGrid>

      {/* Ownership Information */}
      {nodeData.ownership && (
        <Card>
          <CardBody>
            <VStack spacing={2} align="stretch">
              <Text fontWeight="medium">Ownership</Text>
              <SimpleGrid columns={2} spacing={3}>
                <Box>
                  <Text fontSize="sm" fontWeight="medium">Team</Text>
                  <Text fontSize="sm" color="gray.600">{nodeData.ownership.team}</Text>
                </Box>
                <Box>
                  <Text fontSize="sm" fontWeight="medium">Owner</Text>
                  <Text fontSize="sm" color="gray.600">{nodeData.ownership.owner}</Text>
                </Box>
                <Box>
                  <Text fontSize="sm" fontWeight="medium">Contact</Text>
                  <Text fontSize="sm" color="gray.600">{nodeData.ownership.contact}</Text>
                </Box>
                {nodeData.ownership.slackChannel && (
                  <Box>
                    <Text fontSize="sm" fontWeight="medium">Slack Channel</Text>
                    <Text fontSize="sm" color="gray.600">{nodeData.ownership.slackChannel}</Text>
                  </Box>
                )}
              </SimpleGrid>
            </VStack>
          </CardBody>
        </Card>
      )}
    </VStack>
  );
}
